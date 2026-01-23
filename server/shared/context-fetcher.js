const GitHubClient = require('./github-client');

/**
 * Context fetching strategies:
 * - DIFF_ONLY: Only patch/diff (current, fast but limited)
 * - FULL_FILES: Fetch complete file content from GitHub
 * Note: SEMANTIC_SEARCH removed (Zilliz) - will be replaced by CocoIndex
 */
const STRATEGIES = {
  DIFF_ONLY: 'DIFF_ONLY',
  FULL_FILES: 'FULL_FILES'
};

/**
 * Multi-strategy context fetcher for code reviews
 * Provides different levels of context depth based on configuration
 */
class ContextFetcher {
  /**
   * @param {GitHubClient} githubClient - Optional shared GitHub client (avoids duplicate auth)
   */
  constructor(githubClient = null) {
    // Default to FULL_FILES if SEMANTIC_SEARCH requested (no longer available)
    const requestedStrategy = process.env.CONTEXT_STRATEGY || STRATEGIES.FULL_FILES;
    this.strategy = requestedStrategy === 'SEMANTIC_SEARCH'
      ? STRATEGIES.FULL_FILES
      : requestedStrategy;

    if (requestedStrategy === 'SEMANTIC_SEARCH') {
      console.warn('[CONTEXT] SEMANTIC_SEARCH not available (Zilliz removed). Using FULL_FILES.');
    }

    this.fallbackStrategy = process.env.FALLBACK_STRATEGY || STRATEGIES.FULL_FILES;
    this.githubClient = githubClient || new GitHubClient();

    // Max file size to fetch (100KB default - larger files get truncated)
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '102400');
    // Max chars to include in prompt (50K chars ~ 12.5K tokens)
    this.maxContentChars = parseInt(process.env.MAX_CONTENT_CHARS || '50000');

    console.log(`[CONTEXT] Strategy: ${this.strategy} (fallback: ${this.fallbackStrategy})`);

    // Validate strategy
    if (!Object.values(STRATEGIES).includes(this.strategy)) {
      console.warn(`[CONTEXT] Invalid strategy: ${this.strategy}, using FULL_FILES`);
      this.strategy = STRATEGIES.FULL_FILES;
    }
  }

  /**
   * Initialize context fetcher (no-op since semantic search removed)
   * @returns {Promise<void>}
   */
  async initialize() {
    // No initialization needed - semantic search removed
  }

  /**
   * Fetch context for files based on configured strategy
   * @param {Array<Object>} files - Array of file objects
   * @param {Object} prInfo - PR information { owner, repo, number, ref }
   * @returns {Promise<Array>} Files with enriched context
   */
  async fetchContext(files, prInfo) {
    console.log(`[CONTEXT] Fetching context for ${files.length} files using ${this.strategy} strategy`);

    try {
      switch (this.strategy) {
        case STRATEGIES.FULL_FILES:
          return await this.fetchFullFilesContext(files, prInfo);

        case STRATEGIES.DIFF_ONLY:
        default:
          return await this.fetchDiffOnlyContext(files, prInfo);
      }
    } catch (error) {
      console.error(`[CONTEXT] Strategy ${this.strategy} failed: ${error.message}`);

      // Try fallback if primary strategy fails
      if (this.strategy !== this.fallbackStrategy) {
        console.log(`[CONTEXT] Attempting fallback strategy: ${this.fallbackStrategy}`);
        this.strategy = this.fallbackStrategy;
        return await this.fetchContext(files, prInfo);
      }

      // If fallback also fails, return basic context
      console.error(`[CONTEXT] Fallback failed, returning diff-only context`);
      return files;
    }
  }

  /**
   * DIFF_ONLY strategy: Return files as-is (only patch data)
   * Fast, cheap, but limited context
   * @param {Array} files - File objects
   * @param {Object} prInfo - PR info
   * @returns {Promise<Array>} Files with patch only
   */
  async fetchDiffOnlyContext(files, prInfo) {
    console.log(`[CONTEXT] Using DIFF_ONLY - returning ${files.length} files with patches only`);
    return files.map(file => ({
      ...file,
      contextStrategy: 'DIFF_ONLY',
      fullContent: null,
      semanticContext: null
    }));
  }

  /**
   * FULL_FILES strategy: Fetch complete file content from GitHub
   * Good balance of context and cost
   * @param {Array} files - File objects
   * @param {Object} prInfo - PR info
   * @returns {Promise<Array>} Files with full content
   */
  async fetchFullFilesContext(files, prInfo) {
    console.log(`[CONTEXT] Using FULL_FILES - fetching complete content for ${files.length} files`);

    // Fetch all files in parallel for better performance
    const fetchPromises = files.map(async (file) => {
      try {
        // Skip removed files
        if (file.status === 'removed') {
          return {
            ...file,
            contextStrategy: 'FULL_FILES',
            fullContent: null,
            semanticContext: null
          };
        }

        // Fetch full file content from GitHub
        let fullContent = this.githubClient.getFileContent(
          prInfo.owner,
          prInfo.repo,
          file.filename,
          prInfo.ref || 'HEAD'
        );

        // Truncate large files to avoid context overflow
        if (fullContent.length > this.maxContentChars) {
          const truncatedLength = this.maxContentChars;
          const originalLength = fullContent.length;
          fullContent = fullContent.substring(0, truncatedLength);
          fullContent += `\n\n... [TRUNCATED: File too large (${originalLength} chars). Showing first ${truncatedLength} chars.]`;
          console.log(`[CONTEXT] ⚠ ${file.filename} truncated (${originalLength} → ${truncatedLength} chars)`);
        } else {
          console.log(`[CONTEXT] ✓ ${file.filename} (${fullContent.length} chars)`);
        }

        return {
          ...file,
          contextStrategy: 'FULL_FILES',
          fullContent: fullContent,
          semanticContext: null
        };

      } catch (error) {
        console.warn(`[CONTEXT] Failed to fetch ${file.filename}: ${error.message}`);
        // Fallback to diff-only for this file
        return {
          ...file,
          contextStrategy: 'DIFF_ONLY',
          fullContent: null,
          semanticContext: null
        };
      }
    });

    const enrichedFiles = await Promise.all(fetchPromises);

    console.log(`[CONTEXT] ✓ Fetched full content for ${enrichedFiles.filter(f => f.fullContent).length}/${files.length} files`);
    return enrichedFiles;
  }


  /**
   * Get current strategy name
   * @returns {string} Strategy name
   */
  getStrategy() {
    return this.strategy;
  }

  /**
   * Estimate token usage for context
   * @param {Array} files - Enriched files
   * @returns {Object} Token estimates
   */
  estimateTokens(files) {
    let patchTokens = 0;
    let fullContentTokens = 0;
    let semanticTokens = 0;

    for (const file of files) {
      // Patch tokens (always present)
      patchTokens += Math.ceil((file.patch?.length || 0) / 4);

      // Full content tokens (if FULL_FILES or SEMANTIC_SEARCH)
      if (file.fullContent) {
        fullContentTokens += Math.ceil(file.fullContent.length / 4);
      }

      // Semantic context tokens
      if (file.semanticContext?.relatedCode) {
        for (const snippet of file.semanticContext.relatedCode) {
          semanticTokens += Math.ceil((snippet.content?.length || 0) / 4);
        }
      }
    }

    const total = patchTokens + fullContentTokens + semanticTokens;

    return {
      patch: patchTokens,
      fullContent: fullContentTokens,
      semantic: semanticTokens,
      total: total
    };
  }

  /**
   * Disconnect and cleanup (no-op since semantic search removed)
   */
  async disconnect() {
    // No cleanup needed - semantic search removed
  }
}

module.exports = {
  ContextFetcher,
  STRATEGIES
};
