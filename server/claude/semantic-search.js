const MCPClient = require('./mcp-client');
const path = require('path');

/**
 * Semantic search wrapper for intelligent code context retrieval
 * Uses claude-context MCP server for RAG-style code search
 */
class SemanticSearch {
  constructor() {
    this.mcpClient = new MCPClient();
    this.indexedRepos = new Set();
    this.limit = parseInt(process.env.SEMANTIC_SEARCH_LIMIT || '10');
    this.threshold = parseFloat(process.env.SEMANTIC_SEARCH_THRESHOLD || '0.7');
  }

  /**
   * Initialize and connect to MCP server
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    return await this.mcpClient.connect();
  }

  /**
   * Check if repository is indexed
   * @param {string} repoPath - Repository path (e.g., "housing-app/ios")
   * @returns {Promise<boolean>} True if indexed
   */
  async checkRepositoryIndexed(repoPath) {
    if (!this.mcpClient.isConnected()) {
      console.log('[SEMANTIC] MCP not connected, skipping index check');
      return false;
    }

    try {
      const status = await this.mcpClient.getIndexingStatus(repoPath);
      const isIndexed = status.indexed === true;

      if (isIndexed) {
        console.log(`[SEMANTIC] ✓ Repository "${repoPath}" is indexed (${status.files || 0} files)`);
        this.indexedRepos.add(repoPath);
      } else {
        console.log(`[SEMANTIC] Repository "${repoPath}" is not indexed`);
      }

      return isIndexed;
    } catch (error) {
      console.warn(`[SEMANTIC] Failed to check index status: ${error.message}`);
      return false;
    }
  }

  /**
   * Index a repository (one-time operation)
   * @param {string} repoPath - Repository path
   * @returns {Promise<boolean>} Success status
   */
  async indexRepository(repoPath) {
    if (!this.mcpClient.isConnected()) {
      console.log('[SEMANTIC] MCP not connected, cannot index');
      return false;
    }

    try {
      console.log(`[SEMANTIC] Indexing repository: ${repoPath}...`);
      const result = await this.mcpClient.indexCodebase(repoPath);

      if (result.success) {
        console.log(`[SEMANTIC] ✓ Repository indexed successfully`);
        this.indexedRepos.add(repoPath);
        return true;
      } else {
        console.error(`[SEMANTIC] ✗ Indexing failed: ${result.error || 'Unknown error'}`);
        return false;
      }
    } catch (error) {
      console.error(`[SEMANTIC] ✗ Indexing error: ${error.message}`);
      return false;
    }
  }

  /**
   * Search for relevant code using semantic search
   * @param {string} query - Natural language query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results with code snippets
   */
  async searchRelevantCode(query, options = {}) {
    if (!this.mcpClient.isConnected()) {
      console.log('[SEMANTIC] MCP not connected, returning empty results');
      return [];
    }

    try {
      const searchOptions = {
        limit: options.limit || this.limit,
        threshold: options.threshold || this.threshold
      };

      console.log(`[SEMANTIC] Searching: "${query}" (limit: ${searchOptions.limit})`);

      const results = await this.mcpClient.searchCode(query, searchOptions);

      console.log(`[SEMANTIC] ✓ Found ${results.length} relevant code snippets`);
      return results;

    } catch (error) {
      console.error(`[SEMANTIC] Search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate intelligent search queries for a changed file
   * @param {Object} file - File object with filename, status, patch
   * @returns {Array<string>} Array of search queries
   */
  generateSearchQueries(file) {
    const queries = [];
    const filename = file.filename;
    const basename = path.basename(filename);
    const dirname = path.dirname(filename);

    // Query 1: Find files that import this file
    queries.push(`Find files that import ${basename}`);

    // Query 2: Find similar patterns based on file type
    const ext = path.extname(filename);
    if (['.swift', '.kt', '.java', '.ts', '.js'].includes(ext)) {
      queries.push(`Show similar functions to code in ${basename}`);
    }

    // Query 3: Find test files
    if (!filename.includes('Test') && !filename.includes('test')) {
      queries.push(`Find test files for ${basename}`);
    }

    // Query 4: Find related files in same directory
    if (dirname !== '.') {
      queries.push(`Show other files in ${dirname} directory`);
    }

    // Query 5: For modified files, find usages
    if (file.status === 'modified') {
      queries.push(`Find usages of classes or functions from ${basename}`);
    }

    return queries;
  }

  /**
   * Get contextual code for a changed file
   * This performs multiple semantic searches and aggregates results
   * @param {Object} file - File object
   * @param {string} repoPath - Repository path
   * @returns {Promise<Object>} Context with related code
   */
  async getFileContext(file, repoPath) {
    if (!this.mcpClient.isConnected()) {
      console.log('[SEMANTIC] MCP not connected, returning empty context');
      return { file: file.filename, relatedCode: [] };
    }

    // Ensure repo is indexed
    const isIndexed = this.indexedRepos.has(repoPath) || await this.checkRepositoryIndexed(repoPath);
    if (!isIndexed) {
      console.log(`[SEMANTIC] Repository not indexed: ${repoPath}`);
      return { file: file.filename, relatedCode: [] };
    }

    const queries = this.generateSearchQueries(file);
    const allResults = [];
    const seenPaths = new Set([file.filename]); // Don't include the file itself

    console.log(`[SEMANTIC] Getting context for ${file.filename}...`);

    // Execute all queries in parallel
    const searchPromises = queries.map(query =>
      this.searchRelevantCode(query, { limit: 3 }) // Limit 3 per query
    );

    try {
      const resultsArrays = await Promise.all(searchPromises);

      // Flatten and deduplicate results
      for (const results of resultsArrays) {
        for (const result of results) {
          if (!seenPaths.has(result.path)) {
            seenPaths.add(result.path);
            allResults.push(result);
          }
        }
      }

      // Sort by relevance score (if available)
      allResults.sort((a, b) => (b.score || 0) - (a.score || 0));

      // Limit total results
      const limitedResults = allResults.slice(0, this.limit);

      console.log(`[SEMANTIC] ✓ Found ${limitedResults.length} unique code snippets for context`);

      return {
        file: file.filename,
        relatedCode: limitedResults
      };

    } catch (error) {
      console.error(`[SEMANTIC] Failed to get file context: ${error.message}`);
      return { file: file.filename, relatedCode: [] };
    }
  }

  /**
   * Get context for multiple files (batch operation)
   * @param {Array<Object>} files - Array of file objects
   * @param {string} repoPath - Repository path
   * @returns {Promise<Array>} Array of context objects
   */
  async getFilesContext(files, repoPath) {
    if (!this.mcpClient.isConnected()) {
      console.log('[SEMANTIC] MCP not connected, skipping context fetch');
      return [];
    }

    console.log(`[SEMANTIC] Getting context for ${files.length} files...`);

    // Get context for all files in parallel
    const contextPromises = files.map(file =>
      this.getFileContext(file, repoPath)
    );

    const contexts = await Promise.all(contextPromises);

    const totalSnippets = contexts.reduce((sum, ctx) => sum + ctx.relatedCode.length, 0);
    console.log(`[SEMANTIC] ✓ Retrieved ${totalSnippets} total code snippets across ${files.length} files`);

    return contexts;
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect() {
    await this.mcpClient.disconnect();
    this.indexedRepos.clear();
  }
}

module.exports = SemanticSearch;
