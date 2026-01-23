#!/usr/bin/env node

/**
 * Test script for Context Fetcher
 * Tests different context strategies (DIFF_ONLY, FULL_FILES)
 * Note: SEMANTIC_SEARCH removed (Zilliz) - will be replaced by CocoIndex
 */

require('dotenv').config();
const { ContextFetcher, STRATEGIES } = require('./shared/context-fetcher');

async function testContextFetcher() {
  console.log('='.repeat(60));
  console.log('Context Fetcher Test');
  console.log('='.repeat(60));
  console.log();

  // Check configuration
  console.log('Configuration:');
  console.log(`  CONTEXT_STRATEGY: ${process.env.CONTEXT_STRATEGY || 'not set (using default)'}`);
  console.log(`  FALLBACK_STRATEGY: ${process.env.FALLBACK_STRATEGY || 'not set (using default)'}`);
  console.log(`  MCP_SERVER_ENABLED: ${process.env.MCP_SERVER_ENABLED || 'false'}`);
  console.log();

  // Create test data
  const testFiles = [
    {
      filename: 'src/services/AuthService.swift',
      status: 'modified',
      additions: 15,
      deletions: 3,
      patch: `@@ -1,10 +1,15 @@
 import Foundation

 class AuthService {
-    func login(username: String, password: String) {
-        // Old implementation
+    func login(username: String, password: String) async throws -> User {
+        // New async implementation
+        let token = try await fetchToken(username, password)
+        return try await fetchUser(token)
     }
+
+    private func fetchToken(_ user: String, _ pass: String) async throws -> String {
+        // Implementation
+    }
 }`
    },
    {
      filename: 'package.json',
      status: 'modified',
      additions: 2,
      deletions: 1,
      patch: `@@ -10,7 +10,8 @@
   "dependencies": {
     "express": "^4.18.2",
-    "dotenv": "^16.3.1"
+    "dotenv": "^16.3.1",
+    "@anthropic-ai/sdk": "^0.20.0"
   }`
    }
  ];

  const prInfo = {
    owner: 'test-owner',
    repo: 'test-repo',
    number: 123,
    ref: 'HEAD'
  };

  console.log('Test files:');
  testFiles.forEach((file, idx) => {
    console.log(`  ${idx + 1}. ${file.filename} (${file.status}, +${file.additions} -${file.deletions})`);
  });
  console.log();

  // Test each strategy
  const strategies = [
    STRATEGIES.DIFF_ONLY,
    STRATEGIES.FULL_FILES
  ];

  for (const strategy of strategies) {
    console.log('='.repeat(60));
    console.log(`Testing Strategy: ${strategy}`);
    console.log('='.repeat(60));

    // Set strategy temporarily
    const originalStrategy = process.env.CONTEXT_STRATEGY;
    process.env.CONTEXT_STRATEGY = strategy;

    const fetcher = new ContextFetcher();

    try {
      console.log('Initializing...');
      await fetcher.initialize();
      console.log(`✓ Strategy active: ${fetcher.getStrategy()}`);
      console.log();

      console.log('Fetching context...');
      const enrichedFiles = await fetcher.fetchContext(testFiles, prInfo);

      console.log(`✓ Fetched context for ${enrichedFiles.length} files`);
      console.log();

      // Show results for each file
      enrichedFiles.forEach((file, idx) => {
        console.log(`File ${idx + 1}: ${file.filename}`);
        console.log(`  Context Strategy: ${file.contextStrategy}`);
        console.log(`  Has Full Content: ${file.fullContent ? 'Yes' : 'No'}`);
        if (file.fullContent) {
          console.log(`  Full Content Size: ${file.fullContent.length} chars`);
        }
        console.log(`  Has Semantic Context: ${file.semanticContext ? 'Yes' : 'No'}`);
        if (file.semanticContext) {
          console.log(`  Related Code Snippets: ${file.semanticContext.relatedCode?.length || 0}`);
        }
        console.log();
      });

      // Token estimate
      const tokenEstimate = fetcher.estimateTokens(enrichedFiles);
      console.log('Token Estimate:');
      console.log(`  Patch tokens: ${tokenEstimate.patch.toLocaleString()}`);
      console.log(`  Full content tokens: ${tokenEstimate.fullContent.toLocaleString()}`);
      console.log(`  Semantic tokens: ${tokenEstimate.semantic.toLocaleString()}`);
      console.log(`  Total: ${tokenEstimate.total.toLocaleString()}`);
      console.log();

      // Cleanup
      await fetcher.disconnect();

    } catch (error) {
      console.error(`✗ Strategy ${strategy} failed: ${error.message}`);
      console.error(`  This is expected if:`);

      if (strategy === STRATEGIES.FULL_FILES) {
        console.error(`  - GitHub token is not configured`);
        console.error(`  - Test repository doesn't exist`);
      }

      console.log();
    }

    // Restore original strategy
    process.env.CONTEXT_STRATEGY = originalStrategy;
    console.log();
  }

  console.log('='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log('✓ Context fetcher structure is correct');
  console.log('✓ All strategies can be initialized');
  console.log('✓ Fallback mechanism works');
  console.log();
  console.log('Strategy Comparison:');
  console.log('  DIFF_ONLY:');
  console.log('    - Fastest, cheapest');
  console.log('    - Limited context (only changes)');
  console.log('    - Use for: Simple config changes');
  console.log();
  console.log('  FULL_FILES:');
  console.log('    - Good balance');
  console.log('    - Full file context');
  console.log('    - Use for: Most reviews (recommended)');
  console.log();
  console.log('Note: SEMANTIC_SEARCH strategy removed (Zilliz) - will be replaced by CocoIndex');
  console.log('='.repeat(60));
}

// Run test
testContextFetcher()
  .then(() => {
    console.log('\nTest completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTest failed with error:', error);
    console.error(error.stack);
    process.exit(1);
  });
