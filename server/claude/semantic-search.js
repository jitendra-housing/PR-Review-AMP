/**
 * Semantic search client for CocoIndex service
 * Provides intelligent code context via HTTP API to Python service
 */

const http = require('http');

class SemanticSearch {
  constructor() {
    this.serviceUrl = process.env.COCOINDEX_SERVICE_URL || 'http://localhost:5000';
    this.enabled = process.env.ENABLE_SEMANTIC_SEARCH === 'true';
    this.timeout = parseInt(process.env.SEMANTIC_SEARCH_TIMEOUT || '30000');

    // Circuit breaker state
    this.failureCount = 0;
    this.maxFailures = 3;
    this.circuitOpen = false;
    this.resetTimeout = 60000; // 1 minute

    // Parse service URL
    const url = new URL(this.serviceUrl);
    this.host = url.hostname;
    this.port = parseInt(url.port) || 5000;

    if (this.enabled) {
      console.log(`[SEMANTIC] Initialized - service at ${this.serviceUrl}`);
      console.log(`[SEMANTIC] Timeout: ${this.timeout}ms, Circuit breaker: ${this.maxFailures} failures`);
    } else {
      console.log('[SEMANTIC] Semantic search disabled (ENABLE_SEMANTIC_SEARCH=false)');
    }
  }

  /**
   * Initialize and verify connection to CocoIndex service
   * @returns {Promise<boolean>} True if service is healthy
   */
  async initialize() {
    if (!this.enabled) {
      console.log('[SEMANTIC] Skipping initialization - semantic search disabled');
      return false;
    }

    try {
      console.log('[SEMANTIC] Checking service health...');
      const response = await this._request('GET', '/health');

      if (response.status === 'ok') {
        console.log(`[SEMANTIC] ✓ Service healthy - ${response.indexed_repos} repos, ${response.total_chunks} chunks`);
        return true;
      } else {
        console.warn(`[SEMANTIC] ⚠ Service degraded: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error(`[SEMANTIC] ✗ Health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if a repository is indexed
   * @param {string} repoPath - Absolute path to repository
   * @returns {Promise<boolean>} True if indexed
   */
  async checkRepositoryIndexed(repoPath) {
    if (!this.enabled) return false;

    try {
      const response = await this._request('POST', '/check-indexed', {
        repo_path: repoPath
      });

      const indexed = response.indexed || false;
      console.log(`[SEMANTIC] Repository ${repoPath}: ${indexed ? 'indexed' : 'not indexed'}`);
      return indexed;

    } catch (error) {
      console.error(`[SEMANTIC] Check indexed failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Search for relevant code
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {string} options.repoPath - Repository path
   * @param {number} options.limit - Max results (default: 10)
   * @param {number} options.threshold - Min similarity score 0-1 (default: 0.7)
   * @returns {Promise<Array>} Search results
   */
  async searchRelevantCode(query, options = {}) {
    if (!this.enabled) return [];

    const {
      repoPath,
      limit = parseInt(process.env.SEMANTIC_SEARCH_LIMIT || '10'),
      threshold = parseFloat(process.env.SEMANTIC_SEARCH_THRESHOLD || '0.7')
    } = options;

    if (!repoPath) {
      console.warn('[SEMANTIC] searchRelevantCode called without repoPath');
      return [];
    }

    try {
      const response = await this._request('POST', '/search', {
        query,
        repo_path: repoPath,
        limit,
        threshold
      });

      const results = (response.results || []).map(r => ({
        path: r.file_path,
        content: r.chunk_text,
        score: r.score,
        startLine: r.start_line,
        endLine: r.end_line,
        language: r.language,
        description: r.description
      }));

      console.log(`[SEMANTIC] Found ${results.length} results for "${query.substring(0, 50)}..." (${response.duration_ms}ms)`);

      return results;

    } catch (error) {
      console.error(`[SEMANTIC] Search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Get semantic context for a single file
   * @param {Object} file - File object with filename
   * @param {string} repoPath - Repository path
   * @returns {Promise<Object>} File context with related code
   */
  async getFileContext(file, repoPath) {
    if (!this.enabled) {
      return { file: file.filename, relatedCode: [] };
    }

    // Search for code related to this file
    const query = `file:${file.filename} ${file.filename.split('/').pop()}`;

    try {
      const relatedCode = await this.searchRelevantCode(query, {
        repoPath,
        limit: 5,
        threshold: 0.6  // Lower threshold for file context
      });

      return {
        file: file.filename,
        relatedCode: relatedCode
      };

    } catch (error) {
      console.error(`[SEMANTIC] getFileContext failed for ${file.filename}: ${error.message}`);
      return { file: file.filename, relatedCode: [] };
    }
  }

  /**
   * Get semantic context for multiple files
   * @param {Array<Object>} files - Array of file objects
   * @param {string} repoPath - Repository path
   * @returns {Promise<Array<Object>>} Array of file contexts
   */
  async getFilesContext(files, repoPath) {
    if (!this.enabled) {
      return files.map(file => ({ file: file.filename, relatedCode: [] }));
    }

    console.log(`[SEMANTIC] Fetching context for ${files.length} files`);

    // Fetch context for all files in parallel
    const promises = files.map(file => this.getFileContext(file, repoPath));

    try {
      const contexts = await Promise.all(promises);
      const totalSnippets = contexts.reduce((sum, ctx) => sum + ctx.relatedCode.length, 0);
      console.log(`[SEMANTIC] ✓ Fetched ${totalSnippets} related code snippets`);
      return contexts;

    } catch (error) {
      console.error(`[SEMANTIC] getFilesContext failed: ${error.message}`);
      // Return empty contexts on failure
      return files.map(file => ({ file: file.filename, relatedCode: [] }));
    }
  }

  /**
   * Disconnect (no-op for HTTP client)
   */
  async disconnect() {
    // No persistent connection to close
    console.log('[SEMANTIC] Disconnect called (no-op for HTTP client)');
  }

  /**
   * Internal: Make HTTP request to CocoIndex service
   * @private
   */
  async _request(method, path, body = null) {
    // Check circuit breaker
    if (this.circuitOpen) {
      throw new Error('Circuit breaker open - service unavailable');
    }

    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.host,
        port: this.port,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      };

      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);

            if (res.statusCode >= 200 && res.statusCode < 300) {
              // Success - reset failure count
              this.failureCount = 0;
              resolve(parsed);
            } else {
              // HTTP error
              const error = new Error(parsed.error || `HTTP ${res.statusCode}`);
              this._handleFailure();
              reject(error);
            }
          } catch (error) {
            this._handleFailure();
            reject(new Error(`Invalid JSON response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        this._handleFailure();
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        this._handleFailure();
        reject(new Error(`Request timeout after ${this.timeout}ms`));
      });

      // Write body if present
      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * Handle request failure and circuit breaker logic
   * @private
   */
  _handleFailure() {
    this.failureCount++;

    if (this.failureCount >= this.maxFailures) {
      console.error(`[SEMANTIC] ⚠ Circuit breaker opened after ${this.failureCount} failures`);
      this.circuitOpen = true;

      // Reset circuit breaker after timeout
      setTimeout(() => {
        console.log('[SEMANTIC] Circuit breaker reset - attempting reconnection');
        this.circuitOpen = false;
        this.failureCount = 0;
      }, this.resetTimeout);
    }
  }
}

module.exports = SemanticSearch;
