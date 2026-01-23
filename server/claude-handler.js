const ClaudeAPIClient = require('./claude/api-client');
const PatternCache = require('./claude/pattern-cache');
const GitHubClient = require('./shared/github-client');
const { ContextFetcher } = require('./shared/context-fetcher');
const { classifyFiles } = require('./shared/file-classifier');
const { formatReview, parseFindings } = require('./shared/review-formatter');
const {
  buildFilePrompt,
  buildBatchPrompt,
  createBatches,
  truncatePatch
} = require('./claude/prompt-builder');
const {
  processStream,
  createConsoleProgressCallback
} = require('./claude/streaming-handler');
const { execSync } = require('child_process');

/**
 * Claude handler for PR reviews
 * Implements complete review workflow with Claude API
 */
class ClaudeHandler {
  constructor() {
    this.apiClient = new ClaudeAPIClient();
    this.patternCache = new PatternCache(this.apiClient);
    this.githubClient = new GitHubClient();
    // Pass shared GitHubClient to avoid duplicate authentication
    this.contextFetcher = new ContextFetcher(this.githubClient);

    // Safety limits to prevent runaway costs
    this.maxDeepFiles = parseInt(process.env.MAX_DEEP_FILES || '25');
    this.maxTotalFiles = parseInt(process.env.MAX_TOTAL_FILES || '50');
  }

  /**
   * Main handler function for PR review
   * @param {string} prUrl - GitHub PR URL
   * @returns {Promise<Object>} Review result
   */
  async handleReview(prUrl) {
    console.log(`\n[CLAUDE] ====================================`);
    console.log(`[CLAUDE] Starting review for: ${prUrl}`);
    console.log(`[CLAUDE] Model: ${this.apiClient.getModel()}`);
    console.log(`[CLAUDE] ====================================\n`);

    const startTime = Date.now();
    let totalUsage = {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0
    };

    try {
      // Step 1: Initialize context fetcher
      console.log('[CLAUDE] Step 1: Initializing context fetcher...');
      await this.contextFetcher.initialize();
      console.log(`[CLAUDE] ✓ Context strategy: ${this.contextFetcher.getStrategy()}`);

      // Step 2: Fetch PR data and files
      console.log('[CLAUDE] Step 2: Fetching PR data...');
      const prData = this.githubClient.getPRData(prUrl);
      console.log(`[CLAUDE] ✓ PR #${prData.number}: ${prData.title}`);

      console.log('[CLAUDE] Step 3: Fetching files...');
      const files = this.githubClient.getFiles(prUrl);
      console.log(`[CLAUDE] ✓ Fetched ${files.length} files`);

      // Step 3: Classify files
      console.log('[CLAUDE] Step 4: Classifying files...');
      const classified = classifyFiles(files);
      console.log(`[CLAUDE] ✓ AUTO_SKIP: ${classified.AUTO_SKIP.length}, QUICK: ${classified.QUICK.length}, DEEP: ${classified.DEEP.length}`);

      // Safety check: Limit total files to prevent runaway costs
      const totalReviewable = classified.QUICK.length + classified.DEEP.length;
      if (totalReviewable > this.maxTotalFiles) {
        console.warn(`[CLAUDE] ⚠ PR has ${totalReviewable} files, limiting to ${this.maxTotalFiles}`);
        // Prioritize DEEP files, then fill with QUICK
        if (classified.DEEP.length > this.maxDeepFiles) {
          classified.DEEP = classified.DEEP.slice(0, this.maxDeepFiles);
        }
        const remainingSlots = this.maxTotalFiles - classified.DEEP.length;
        if (classified.QUICK.length > remainingSlots) {
          classified.QUICK = classified.QUICK.slice(0, remainingSlots);
        }
        console.log(`[CLAUDE] ✓ Limited to: QUICK: ${classified.QUICK.length}, DEEP: ${classified.DEEP.length}`);
      }

      // Limit DEEP files specifically (they're most expensive)
      if (classified.DEEP.length > this.maxDeepFiles) {
        console.warn(`[CLAUDE] ⚠ Too many DEEP files (${classified.DEEP.length}), limiting to ${this.maxDeepFiles}`);
        classified.DEEP = classified.DEEP.slice(0, this.maxDeepFiles);
      }

      // Step 4: Fetch enriched context for reviewable files
      console.log('[CLAUDE] Step 5: Fetching enriched context...');
      const reviewableFiles = [...classified.QUICK, ...classified.DEEP];
      const { owner, repo, number } = this.githubClient.parsePRUrl(prUrl);
      // Use headRefOid (PR head commit) for fetching files, NOT baseRefName (target branch)
      const prInfo = { owner, repo, number, ref: prData.headRefOid || prData.headRefName || 'HEAD' };

      const enrichedFiles = await this.contextFetcher.fetchContext(reviewableFiles, prInfo);

      // Estimate token usage from context
      const tokenEstimate = this.contextFetcher.estimateTokens(enrichedFiles);
      console.log(`[CLAUDE] ✓ Context tokens: ${tokenEstimate.total.toLocaleString()} (patch: ${tokenEstimate.patch}, full: ${tokenEstimate.fullContent}, semantic: ${tokenEstimate.semantic})`);

      // Re-classify with enriched data
      const enrichedQuick = enrichedFiles.filter((_, idx) => idx < classified.QUICK.length);
      const enrichedDeep = enrichedFiles.filter((_, idx) => idx >= classified.QUICK.length);

      // Step 5: Build cached system prompt (ONE-TIME)
      console.log('[CLAUDE] Step 6: Building cached system prompt...');
      const systemPrompt = await this.patternCache.buildCachedSystemPrompt(files);
      console.log('[CLAUDE] ✓ System prompt ready with cached guidelines');

      // Step 6: Review files
      const allReviews = [];

      // Review QUICK files in batches
      if (enrichedQuick.length > 0) {
        console.log(`\n[CLAUDE] Step 7: Reviewing ${enrichedQuick.length} QUICK files in batches...`);
        const batches = createBatches(enrichedQuick, 8000);
        console.log(`[CLAUDE] Created ${batches.length} batches`);

        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          console.log(`[CLAUDE] Processing batch ${i + 1}/${batches.length} (${batch.length} files)...`);

          const prompt = buildBatchPrompt(batch);
          const messages = [{ role: 'user', content: prompt }];

          const response = await this.apiClient.sendMessage(messages, systemPrompt, 4096, false);
          const reviewText = response.content[0].text;
          allReviews.push(reviewText);

          // Track usage
          const usage = this.apiClient.getUsage(response);
          if (usage) {
            totalUsage.input_tokens += usage.input_tokens;
            totalUsage.output_tokens += usage.output_tokens;
            totalUsage.cache_creation_input_tokens += usage.cache_creation_input_tokens;
            totalUsage.cache_read_input_tokens += usage.cache_read_input_tokens;
          }

          console.log(`[CLAUDE] ✓ Batch ${i + 1} complete`);
        }
      }

      // Review DEEP files individually with streaming
      if (enrichedDeep.length > 0) {
        console.log(`\n[CLAUDE] Step 8: Reviewing ${enrichedDeep.length} DEEP files individually...`);

        for (let i = 0; i < enrichedDeep.length; i++) {
          const file = enrichedDeep[i];
          console.log(`[CLAUDE] [${i + 1}/${enrichedDeep.length}] Reviewing ${file.filename}...`);

          // Truncate large patches to avoid context overflow (but keep full content if available)
          file.patch = truncatePatch(file.patch, 500);

          const prompt = buildFilePrompt(file, 'DEEP');
          const messages = [{ role: 'user', content: prompt }];

          // Use streaming for DEEP files
          const stream = await this.apiClient.sendMessage(messages, systemPrompt, 4096, true);
          const progressCallback = createConsoleProgressCallback(file.filename);

          const { text: reviewText, usage } = await processStream(stream, progressCallback);
          allReviews.push(reviewText);

          // Track usage from streaming
          if (usage) {
            totalUsage.input_tokens += usage.input_tokens;
            totalUsage.output_tokens += usage.output_tokens;
            totalUsage.cache_creation_input_tokens += usage.cache_creation_input_tokens;
            totalUsage.cache_read_input_tokens += usage.cache_read_input_tokens;
          }

          console.log(`[CLAUDE] ✓ ${file.filename} complete`);
        }
      }

      // Step 7: Parse all findings
      console.log('\n[CLAUDE] Step 9: Compiling findings...');
      let allFindings = [];
      for (let i = 0; i < allReviews.length; i++) {
        const review = allReviews[i];

        // Debug: Log first 500 chars of each review
        if (process.env.DEBUG_REVIEWS === 'true') {
          console.log(`[DEBUG] Review ${i + 1} preview:`, review.substring(0, 500));
        }

        const findings = parseFindings(review);
        allFindings = allFindings.concat(findings);
        console.log(`[CLAUDE] Review ${i + 1}: Parsed ${findings.length} findings`);
      }

      console.log(`[CLAUDE] ✓ Total findings: ${allFindings.length}`);

      // Step 8: Format final review
      console.log('[CLAUDE] Step 10: Formatting review...');
      const stats = {
        filesReviewed: enrichedQuick.length + enrichedDeep.length,
        filesSkipped: classified.AUTO_SKIP.length,
        additions: prData.additions,
        deletions: prData.deletions,
        contextStrategy: this.contextFetcher.getStrategy()
      };

      const formattedReview = formatReview(allFindings, stats, prData);

      // Step 9: Post to GitHub
      console.log('[CLAUDE] Step 11: Posting review to GitHub...');
      this.githubClient.postComment(prUrl, formattedReview);
      console.log('[CLAUDE] ✓ Review posted');

      // Step 10: Send completion callback
      console.log('[CLAUDE] Step 12: Sending completion callback...');
      await this.sendCompletionCallback(prUrl, prData.number, 'success');
      console.log('[CLAUDE] ✓ Callback sent');

      // Step 11: Cleanup
      console.log('[CLAUDE] Step 13: Cleaning up...');
      await this.contextFetcher.disconnect();
      console.log('[CLAUDE] ✓ Cleanup complete');

      // Calculate totals
      const duration = Math.round((Date.now() - startTime) / 1000);
      const cost = this.apiClient.calculateCost(totalUsage);

      console.log(`\n[CLAUDE] ====================================`);
      console.log(`[CLAUDE] Review Complete!`);
      console.log(`[CLAUDE] Duration: ${duration}s`);
      console.log(`[CLAUDE] Findings: ${allFindings.length}`);
      console.log(`[CLAUDE] Input tokens: ${totalUsage.input_tokens.toLocaleString()}`);
      console.log(`[CLAUDE] Output tokens: ${totalUsage.output_tokens.toLocaleString()}`);
      console.log(`[CLAUDE] Cache write tokens: ${totalUsage.cache_creation_input_tokens.toLocaleString()}`);
      console.log(`[CLAUDE] Cache read tokens: ${totalUsage.cache_read_input_tokens.toLocaleString()}`);
      console.log(`[CLAUDE] Estimated cost: $${cost.toFixed(4)}`);
      console.log(`[CLAUDE] ====================================\n`);

      return {
        success: true,
        findings: allFindings.length,
        duration,
        cost,
        usage: totalUsage
      };

    } catch (error) {
      console.error(`[CLAUDE] ✗ Review failed: ${error.message}`);
      console.error(error.stack);

      // Try to post error comment
      try {
        const errorComment = `## ⚠️ Review Failed\n\nThe automated review encountered an error:\n\n\`\`\`\n${error.message}\n\`\`\`\n\nPlease check the server logs for details.`;
        this.githubClient.postComment(prUrl, errorComment);
      } catch (commentError) {
        console.error('[CLAUDE] Failed to post error comment:', commentError.message);
      }

      // Send failure callback
      try {
        const { number } = this.githubClient.parsePRUrl(prUrl);
        await this.sendCompletionCallback(prUrl, number, 'failure');
      } catch (callbackError) {
        console.error('[CLAUDE] Failed to send failure callback:', callbackError.message);
      }

      // Cleanup on error
      try {
        await this.contextFetcher.disconnect();
      } catch (cleanupError) {
        console.error('[CLAUDE] Failed to cleanup:', cleanupError.message);
      }

      throw error;
    }
  }

  /**
   * Send review completion callback to server
   * @param {string} prUrl - PR URL
   * @param {number} prNumber - PR number
   * @param {string} status - Review status (success/failure)
   */
  async sendCompletionCallback(prUrl, prNumber, status) {
    const callbackUrl = process.env.CALLBACK_URL || 'http://localhost:3000/review-complete';

    try {
      const payload = JSON.stringify({
        agent: 'claude',
        pr_url: prUrl,
        pr_number: prNumber,
        status: status
      });

      // Use http module instead of shell exec to avoid escaping issues
      const http = require('http');
      const url = new URL(callbackUrl);

      return new Promise((resolve) => {
        const req = http.request({
          hostname: url.hostname,
          port: url.port || 80,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        }, (res) => {
          resolve();
        });

        req.on('error', (error) => {
          console.warn('[CLAUDE] Callback failed (non-critical):', error.message);
          resolve();
        });

        req.write(payload);
        req.end();
      });

    } catch (error) {
      console.warn('[CLAUDE] Callback failed (non-critical):', error.message);
    }
  }
}

/**
 * Export handler function for queue manager
 */
async function handleClaudeReview(prUrl) {
  const handler = new ClaudeHandler();
  return handler.handleReview(prUrl);
}

module.exports = handleClaudeReview;
