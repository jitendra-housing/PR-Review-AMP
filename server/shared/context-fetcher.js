const GitHubClient = require('./github-client');
const DependencyParser = require('./dependency-parser');
const { execSync } = require('child_process');
const path = require('path');

/**
 * Context fetching strategies:
 * - DIFF_ONLY: Only patch/diff (fast but limited)
 * - FULL_FILES: Fetch complete file content from GitHub
 * - DEPENDENCY_AWARE: Full files + dependency analysis (recommended)
 * Note: SEMANTIC_SEARCH removed (Zilliz) - replaced by DEPENDENCY_AWARE
 */
const STRATEGIES = {
  DIFF_ONLY: 'DIFF_ONLY',
  FULL_FILES: 'FULL_FILES',
  DEPENDENCY_AWARE: 'DEPENDENCY_AWARE'
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
    // Default to DEPENDENCY_AWARE if SEMANTIC_SEARCH requested (no longer available)
    const requestedStrategy = process.env.CONTEXT_STRATEGY || STRATEGIES.DEPENDENCY_AWARE;
    this.strategy = requestedStrategy === 'SEMANTIC_SEARCH'
      ? STRATEGIES.DEPENDENCY_AWARE
      : requestedStrategy;

    if (requestedStrategy === 'SEMANTIC_SEARCH') {
      console.warn('[CONTEXT] SEMANTIC_SEARCH not available (Zilliz removed). Using DEPENDENCY_AWARE.');
    }

    this.fallbackStrategy = process.env.FALLBACK_STRATEGY || STRATEGIES.FULL_FILES;
    this.githubClient = githubClient || new GitHubClient();
    this.dependencyParser = new DependencyParser();

    // Max file size to fetch (100KB default - larger files get truncated)
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '102400');
    // Max chars to include in prompt (50K chars ~ 12.5K tokens)
    this.maxContentChars = parseInt(process.env.MAX_CONTENT_CHARS || '50000');

    // Dependency analysis settings
    this.maxDependentFiles = parseInt(process.env.MAX_DEPENDENT_FILES || '5');
    this.maxTestFiles = parseInt(process.env.MAX_TEST_FILES || '3');
    this.includeDependencyContext = process.env.INCLUDE_DEPENDENCY_CONTEXT !== 'false';

    console.log(`[CONTEXT] Strategy: ${this.strategy} (fallback: ${this.fallbackStrategy})`);

    // Validate strategy
    if (!Object.values(STRATEGIES).includes(this.strategy)) {
      console.warn(`[CONTEXT] Invalid strategy: ${this.strategy}, using DEPENDENCY_AWARE`);
      this.strategy = STRATEGIES.DEPENDENCY_AWARE;
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
        case STRATEGIES.DEPENDENCY_AWARE:
          return await this.fetchDependencyAwareContext(files, prInfo);

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
   * DEPENDENCY_AWARE strategy: Fetch files + their dependencies and dependents
   * Provides smart context by including related files
   * @param {Array} files - File objects
   * @param {Object} prInfo - PR info
   * @returns {Promise<Array>} Files with dependency context
   */
  async fetchDependencyAwareContext(files, prInfo) {
    console.log(`[CONTEXT] Using DEPENDENCY_AWARE - analyzing relationships for ${files.length} files`);

    // Step 1: Fetch full content for changed files
    const changedFiles = await this.fetchFullFilesContext(files, prInfo);

    if (!this.includeDependencyContext) {
      console.log('[CONTEXT] Dependency context disabled, returning full files only');
      return changedFiles;
    }

    // Step 2: Analyze dependencies
    const relatedFilesMap = new Map(); // filename -> file data
    const relationships = [];

    for (const file of changedFiles) {
      if (!file.fullContent) continue;

      try {
        // Parse imports/exports
        const { imports, exports } = this.dependencyParser.parseFile(
          file.filename,
          file.fullContent
        );

        relationships.push({
          file: file.filename,
          imports: imports.length,
          exports: exports.length
        });

        // Step 3: Find files that import this one (dependents)
        if (exports.length > 0) {
          const dependents = await this.findDependentFiles(
            file.filename,
            exports,
            prInfo
          );

          for (const dep of dependents) {
            if (!relatedFilesMap.has(dep.filename)) {
              relatedFilesMap.set(dep.filename, dep);
            }
          }
        }

        // Step 4: Find test files
        const tests = await this.findTestFiles(file.filename, prInfo);

        for (const test of tests) {
          if (!relatedFilesMap.has(test.filename)) {
            relatedFilesMap.set(test.filename, test);
          }
        }
      } catch (error) {
        console.warn(`[CONTEXT] Failed to analyze ${file.filename}: ${error.message}`);
      }
    }

    console.log(`[CONTEXT] Found ${relatedFilesMap.size} related files through dependency analysis`);
    if (relationships.length > 0) {
      console.log('[CONTEXT] Relationships:', JSON.stringify(relationships, null, 2));
    }

    // Step 5: Add dependency context to changed files
    const allContext = changedFiles.map(file => ({
      ...file,
      contextStrategy: 'DEPENDENCY_AWARE',
      dependencies: {
        relatedFiles: Array.from(relatedFilesMap.values())
          .filter(rf => rf.filename !== file.filename) // Don't include self
          .slice(0, this.maxDependentFiles + this.maxTestFiles) // Limit total related files
          .map(rf => ({
            filename: rf.filename,
            relationship: rf.relationship,
            excerpt: this.truncateContent(rf.fullContent || '', 1000) // 1000 chars max per related file
          }))
      }
    }));

    return allContext;
  }

  /**
   * Find files that depend on the target file
   * Uses GitHub Code Search via gh CLI - CONSERVATIVE to avoid false positives
   * @param {string} targetFilename - Target file path
   * @param {Array} exports - Exported symbols from target file
   * @param {Object} prInfo - PR info
   * @returns {Promise<Array>} Dependent files
   */
  async findDependentFiles(targetFilename, exports, prInfo) {
    const dependents = [];
    const basename = path.basename(targetFilename, path.extname(targetFilename));

    // Skip if no exports (nothing to depend on)
    if (!exports || exports.length === 0) {
      console.log(`[CONTEXT] Skipping dependent search for ${targetFilename} (no exports)`);
      return dependents;
    }

    try {
      // Search for import/require statements mentioning this file
      // More specific query to reduce false positives
      const searchQuery = `repo:${prInfo.owner}/${prInfo.repo} "import" "${basename}" OR "require" "${basename}"`;

      const result = execSync(
        `gh search code "${searchQuery}" --repo ${prInfo.owner}/${prInfo.repo} --json path --limit ${this.maxDependentFiles * 2}`,
        { encoding: 'utf8', stdio: 'pipe', timeout: 10000 }
      );

      const searchResults = JSON.parse(result);

      if (!searchResults || searchResults.length === 0) {
        console.log(`[CONTEXT] No potential dependents found for ${targetFilename}`);
        return dependents;
      }

      for (const item of searchResults) {
        // Skip the target file itself
        if (item.path === targetFilename) continue;

        // Skip if already at max dependents
        if (dependents.length >= this.maxDependentFiles) break;

        try {
          // Fetch file content to VERIFY it actually imports the target
          const content = this.githubClient.getFileContent(
            prInfo.owner,
            prInfo.repo,
            item.path,
            prInfo.ref || prInfo.headRefName || 'HEAD'
          );

          // Parse imports - strict verification
          const { imports } = this.dependencyParser.parseFile(item.path, content);

          // Verify actual import with strict matching
          let actuallyImports = false;
          for (const imp of imports) {
            const normalizedImport = this.dependencyParser.normalizeImportPath(imp);
            const normalizedTarget = this.dependencyParser.normalizeImportPath(targetFilename);

            // Must match basename AND be a relative import
            if (normalizedImport.includes(basename) &&
                (imp.startsWith('./') || imp.startsWith('../'))) {
              actuallyImports = true;
              break;
            }
          }

          if (actuallyImports) {
            console.log(`[CONTEXT] ✓ Verified dependent: ${item.path} imports ${targetFilename}`);
            dependents.push({
              filename: item.path,
              fullContent: content,
              relationship: 'dependent'
            });
          } else {
            console.log(`[CONTEXT] ✗ False positive: ${item.path} doesn't actually import ${targetFilename}`);
          }
        } catch (error) {
          console.warn(`[CONTEXT] Could not verify ${item.path}: ${error.message}`);
        }
      }
    } catch (error) {
      // Don't throw - just log and continue without dependents
      console.warn(`[CONTEXT] Dependent search failed for ${targetFilename}: ${error.message}`);
    }

    console.log(`[CONTEXT] Found ${dependents.length} verified dependents for ${targetFilename}`);
    return dependents;
  }

  /**
   * Find test files for the target file
   * Uses GitHub Code Search via gh CLI - CONSERVATIVE to avoid false positives
   * @param {string} targetFilename - Target file path
   * @param {Object} prInfo - PR info
   * @returns {Promise<Array>} Test files
   */
  async findTestFiles(targetFilename, prInfo) {
    const tests = [];
    const basename = path.basename(targetFilename, path.extname(targetFilename));
    const ext = path.extname(targetFilename);

    // Skip finding tests for test files themselves
    if (basename.includes('test') || basename.includes('spec') || basename.includes('Test')) {
      console.log(`[CONTEXT] Skipping test search for test file: ${targetFilename}`);
      return tests;
    }

    try {
      // Common test patterns - STRICT matching
      const testPatterns = [
        `${basename}.test${ext}`,
        `${basename}.spec${ext}`,
        `${basename}Test${ext}`,
        `${basename}Tests${ext}`
      ];

      for (const pattern of testPatterns) {
        if (tests.length >= this.maxTestFiles) break;

        try {
          // Exact filename match to avoid false positives
          const searchQuery = `repo:${prInfo.owner}/${prInfo.repo} filename:${pattern}`;

          const result = execSync(
            `gh search code "${searchQuery}" --repo ${prInfo.owner}/${prInfo.repo} --json path --limit 2`,
            { encoding: 'utf8', stdio: 'pipe', timeout: 10000 }
          );

          const searchResults = JSON.parse(result);

          for (const item of searchResults) {
            if (tests.length >= this.maxTestFiles) break;

            // Verify filename actually matches the pattern (exact match)
            const itemBasename = path.basename(item.path);
            if (itemBasename !== pattern) {
              console.log(`[CONTEXT] ✗ Skipping non-exact match: ${item.path} (wanted ${pattern})`);
              continue;
            }

            try {
              const content = this.githubClient.getFileContent(
                prInfo.owner,
                prInfo.repo,
                item.path,
                prInfo.ref || prInfo.headRefName || 'HEAD'
              );

              // Additional verification: check if test file actually imports or mentions the target
              const mentionsTarget = content.includes(basename);

              if (mentionsTarget) {
                console.log(`[CONTEXT] ✓ Verified test file: ${item.path} tests ${targetFilename}`);
                tests.push({
                  filename: item.path,
                  fullContent: content,
                  relationship: 'test'
                });
              } else {
                console.log(`[CONTEXT] ✗ False positive: ${item.path} doesn't mention ${basename}`);
              }
            } catch (error) {
              console.warn(`[CONTEXT] Could not verify test file ${item.path}: ${error.message}`);
            }
          }
        } catch (error) {
          // Search pattern not found, continue to next pattern
          continue;
        }
      }
    } catch (error) {
      // Don't throw - just log and continue without tests
      console.warn(`[CONTEXT] Test search failed for ${targetFilename}: ${error.message}`);
    }

    console.log(`[CONTEXT] Found ${tests.length} verified test files for ${targetFilename}`);
    return tests;
  }

  /**
   * Truncate content to max characters
   * @param {string} content - Content to truncate
   * @param {number} maxChars - Maximum characters
   * @returns {string} Truncated content
   */
  truncateContent(content, maxChars) {
    if (!content || content.length <= maxChars) return content;

    return content.substring(0, maxChars) + '\n... [truncated]';
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
