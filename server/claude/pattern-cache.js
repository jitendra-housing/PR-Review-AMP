const fs = require('fs');
const path = require('path');

/**
 * Pattern cache for guidelines and code patterns
 * Implements one-time pattern analysis with prompt caching
 */
class PatternCache {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.guidelinesPath = path.join(__dirname, '../../.agents/guidelines');
    this.cachedSystemPrompt = null;
    this.cacheTimestamp = null;
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes (Claude cache TTL)
    // Separate cache for pattern analysis (longer duration since it's expensive)
    this.patternAnalysisCache = null;
    this.patternAnalysisHash = null;
  }

  /**
   * Load all guidelines from .agents/guidelines/
   * @returns {Object} { common, ios, web }
   */
  loadGuidelines() {
    const guidelines = {};

    try {
      // Load Common.md (always included)
      const commonPath = path.join(this.guidelinesPath, 'Common.md');
      if (fs.existsSync(commonPath)) {
        guidelines.common = fs.readFileSync(commonPath, 'utf8');
      }

      // Load iOS.md
      const iosPath = path.join(this.guidelinesPath, 'iOS.md');
      if (fs.existsSync(iosPath)) {
        guidelines.ios = fs.readFileSync(iosPath, 'utf8');
      }

      // Load Web.md
      const webPath = path.join(this.guidelinesPath, 'Web.md');
      if (fs.existsSync(webPath)) {
        guidelines.web = fs.readFileSync(webPath, 'utf8');
      }

      console.log(`[CACHE] Loaded guidelines: ${Object.keys(guidelines).join(', ')}`);
    } catch (error) {
      console.error(`[CACHE] Failed to load guidelines: ${error.message}`);
      throw error;
    }

    return guidelines;
  }

  /**
   * Detect platform from file extensions
   * @param {Array} files - Array of file objects
   * @returns {Array} Array of detected platforms
   */
  detectPlatforms(files) {
    const platforms = new Set();

    for (const file of files) {
      const ext = path.extname(file.filename);
      const filename = file.filename.toLowerCase();

      // iOS
      if (['.swift', '.m', '.mm', '.h'].includes(ext) || filename.includes('ios')) {
        platforms.add('ios');
      }

      // Android
      if (['.kt', '.java'].includes(ext) &&
          (filename.includes('android') || filename.includes('src/main'))) {
        platforms.add('android');
      }

      // Web
      if (['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'].includes(ext) ||
          ['.html', '.css', '.scss'].includes(ext)) {
        platforms.add('web');
      }
    }

    // Always include 'common'
    platforms.add('common');

    return Array.from(platforms);
  }

  /**
   * Build cached system prompt with guidelines and patterns
   * @param {Array} files - PR files for platform detection
   * @returns {Array} System prompt blocks with cache_control
   */
  async buildCachedSystemPrompt(files) {
    // Check if cache is still valid
    if (this.cachedSystemPrompt && this.cacheTimestamp) {
      const cacheAge = Date.now() - this.cacheTimestamp;
      if (cacheAge < this.cacheDuration) {
        console.log(`[CACHE] Using cached system prompt (age: ${Math.round(cacheAge / 1000)}s)`);
        return this.cachedSystemPrompt;
      }
    }

    console.log('[CACHE] Building new cached system prompt...');

    // Load guidelines
    const guidelines = this.loadGuidelines();

    // Detect platforms
    const platforms = this.detectPlatforms(files);
    console.log(`[CACHE] Detected platforms: ${platforms.join(', ')}`);

    // Build guidelines text
    let guidelinesText = '# Code Review Guidelines\n\n';

    if (guidelines.common) {
      guidelinesText += '## Universal Guidelines (All Platforms)\n\n';
      guidelinesText += guidelines.common + '\n\n';
    }

    if (platforms.includes('ios') && guidelines.ios) {
      guidelinesText += '## iOS-Specific Guidelines\n\n';
      guidelinesText += guidelines.ios + '\n\n';
    }

    if (platforms.includes('web') && guidelines.web) {
      guidelinesText += '## Web-Specific Guidelines\n\n';
      guidelinesText += guidelines.web + '\n\n';
    }

    // Analyze patterns once (replicate Amp RAG query)
    const patternsText = await this.analyzePatterns(guidelinesText);

    // Build system prompt blocks with caching
    const systemPrompt = [
      {
        type: 'text',
        text: guidelinesText,
        cache_control: { type: 'ephemeral' }
      },
      {
        type: 'text',
        text: patternsText,
        cache_control: { type: 'ephemeral' }
      },
      {
        type: 'text',
        text: this.getReviewInstructions()
      }
    ];

    // Cache for 5 minutes
    this.cachedSystemPrompt = systemPrompt;
    this.cacheTimestamp = Date.now();

    console.log('[CACHE] ✓ System prompt cached');

    return systemPrompt;
  }

  /**
   * Analyze patterns from guidelines (one-time analysis)
   * Replicates Amp's RAG query functionality
   * @param {string} guidelinesText - Combined guidelines text
   * @returns {string} Pattern analysis summary
   */
  async analyzePatterns(guidelinesText) {
    // Create a simple hash of guidelines to detect changes
    const hash = require('crypto').createHash('md5').update(guidelinesText).digest('hex');

    // Reuse cached analysis if guidelines haven't changed
    if (this.patternAnalysisCache && this.patternAnalysisHash === hash) {
      console.log('[CACHE] Using cached pattern analysis (guidelines unchanged)');
      return this.patternAnalysisCache;
    }

    console.log('[CACHE] Analyzing patterns from guidelines...');

    const analysisPrompt = [
      {
        role: 'user',
        content: `Analyze the following code review guidelines and extract key patterns, anti-patterns, and critical checks.

${guidelinesText}

Provide a structured summary of:
1. Most critical issues to check (HIGH severity)
2. Common anti-patterns by category
3. Platform-specific concerns
4. Security vulnerabilities to watch for
5. Architecture pattern requirements

Format as a concise reference guide for code review.`
      }
    ];

    try {
      const response = await this.apiClient.sendMessage(
        analysisPrompt,
        [],
        2048,
        false
      );

      const patternsText = response.content[0].text;
      const result = `# Pattern Analysis\n\n${patternsText}`;

      // Cache the analysis
      this.patternAnalysisCache = result;
      this.patternAnalysisHash = hash;

      console.log('[CACHE] ✓ Pattern analysis complete and cached');
      return result;
    } catch (error) {
      console.error(`[CACHE] Pattern analysis failed: ${error.message}`);
      // Return basic summary if analysis fails
      return `# Pattern Analysis\n\nFailed to analyze patterns. Using guidelines directly.`;
    }
  }

  /**
   * Get review instructions for the system prompt
   * @returns {string} Review instructions
   */
  getReviewInstructions() {
    return `# Review Instructions

You are a code review agent analyzing pull requests. Your responses will be parsed by a machine, so you MUST follow the exact format specified below.

## CRITICAL: Output Format Requirements

**YOU MUST output findings in this EXACT format (no code blocks, no markdown formatting around it):**

FILE: path/to/file.ext:line_number
SEVERITY: HIGH|MEDIUM|LOW
CATEGORY: Category Name
MESSAGE: Detailed description of the issue and suggested fix.

**Example of correct output:**

FILE: ios/Services/AuthService.swift:42
SEVERITY: HIGH
CATEGORY: Security
MESSAGE: Hardcoded API key detected. This exposes sensitive credentials in version control. Move to secure configuration or environment variables.

FILE: web/components/UserProfile.tsx:15
SEVERITY: MEDIUM
CATEGORY: Architecture
MESSAGE: Direct state mutation detected. Use setState() or proper state management to avoid race conditions and unpredictable behavior.

**IMPORTANT RULES:**
1. Each finding MUST start with "FILE:" on a new line
2. Use EXACT field names: FILE, SEVERITY, CATEGORY, MESSAGE
3. Separate findings with a blank line
4. Do NOT wrap findings in code blocks or markdown
5. Do NOT add extra headers or sections between findings
6. If no issues found, output: "No issues found."

## Severity Guidelines

- **HIGH**: Security vulnerabilities, data loss risks, critical bugs, architecture violations that break the system
- **MEDIUM**: Code quality issues, missing error handling, performance problems, maintainability concerns
- **LOW**: Style suggestions, minor optimizations, documentation improvements

## Review Focus

1. **Security**: Injection, auth bypass, exposed secrets, input validation
2. **Architecture**: DI violations, pattern violations, module boundaries
3. **Correctness**: Business logic errors, edge cases, error handling
4. **Performance**: N+1 queries, inefficient algorithms, memory leaks
5. **Code Quality**: Duplication, complexity, naming, testability

Focus on HIGH and MEDIUM severity. Only mention LOW if clearly beneficial.

**Remember: Your output will be parsed by regex. Follow the format exactly.**`;
  }

  /**
   * Clear cache (useful for testing)
   * @param {boolean} includePatternAnalysis - Also clear pattern analysis cache (default: false)
   */
  clearCache(includePatternAnalysis = false) {
    this.cachedSystemPrompt = null;
    this.cacheTimestamp = null;

    if (includePatternAnalysis) {
      this.patternAnalysisCache = null;
      this.patternAnalysisHash = null;
      console.log('[CACHE] All caches cleared (including pattern analysis)');
    } else {
      console.log('[CACHE] System prompt cache cleared (pattern analysis preserved)');
    }
  }
}

module.exports = PatternCache;
