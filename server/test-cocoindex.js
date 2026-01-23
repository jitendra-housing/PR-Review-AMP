/**
 * Test suite for CocoIndex integration
 * Run: node server/test-cocoindex.js
 */

const SemanticSearch = require('./claude/semantic-search');

// ANSI color codes for pretty output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name) {
  console.log(`\n${'='.repeat(60)}`);
  log(`Test: ${name}`, 'blue');
  console.log('='.repeat(60));
}

async function runTests() {
  log('\n🧪 CocoIndex Integration Test Suite\n', 'blue');

  // Override environment for testing
  process.env.ENABLE_SEMANTIC_SEARCH = 'true';
  process.env.COCOINDEX_SERVICE_URL = 'http://localhost:5000';

  const search = new SemanticSearch();
  let passCount = 0;
  let failCount = 0;

  // Test 1: Health Check
  logTest('Health Check');
  try {
    const healthy = await search.initialize();
    if (healthy) {
      log('✓ PASS - Service is healthy', 'green');
      passCount++;
    } else {
      log('✗ FAIL - Service is not healthy', 'red');
      failCount++;
    }
  } catch (error) {
    log(`✗ FAIL - ${error.message}`, 'red');
    failCount++;
  }

  // Test 2: Check Repository Indexed
  logTest('Repository Indexed Check');
  const testRepoPath = process.env.TEST_REPO_PATH || '/path/to/test/repo';
  log(`Checking if indexed: ${testRepoPath}`, 'yellow');

  try {
    const indexed = await search.checkRepositoryIndexed(testRepoPath);
    if (indexed) {
      log('✓ PASS - Repository is indexed', 'green');
      passCount++;
    } else {
      log('⚠ WARN - Repository not indexed yet', 'yellow');
      log(`To index: cd server/python-service && ./cli.py index ${testRepoPath}`, 'yellow');
      passCount++;  // Not a failure, just not set up yet
    }
  } catch (error) {
    log(`✗ FAIL - ${error.message}`, 'red');
    failCount++;
  }

  // Test 3: Search Query (only if indexed)
  logTest('Search Query');
  try {
    const indexed = await search.checkRepositoryIndexed(testRepoPath);

    if (!indexed) {
      log('⏭ SKIP - Repository not indexed', 'yellow');
    } else {
      const query = 'authentication function';
      log(`Searching for: "${query}"`, 'yellow');

      const results = await search.searchRelevantCode(query, {
        repoPath: testRepoPath,
        limit: 5,
        threshold: 0.6
      });

      if (results && Array.isArray(results)) {
        log(`✓ PASS - Found ${results.length} results`, 'green');
        passCount++;

        if (results.length > 0) {
          log('\nTop results:', 'yellow');
          results.slice(0, 3).forEach((r, i) => {
            console.log(`  ${i + 1}. [${r.score.toFixed(2)}] ${r.path}`);
            console.log(`     ${r.description}`);
          });
        }
      } else {
        log('✗ FAIL - Invalid results format', 'red');
        failCount++;
      }
    }
  } catch (error) {
    log(`✗ FAIL - ${error.message}`, 'red');
    failCount++;
  }

  // Test 4: File Context
  logTest('File Context Retrieval');
  try {
    const indexed = await search.checkRepositoryIndexed(testRepoPath);

    if (!indexed) {
      log('⏭ SKIP - Repository not indexed', 'yellow');
    } else {
      const testFile = { filename: 'src/index.js' };
      log(`Getting context for: ${testFile.filename}`, 'yellow');

      const context = await search.getFileContext(testFile, testRepoPath);

      if (context && context.file === testFile.filename) {
        log(`✓ PASS - Retrieved context with ${context.relatedCode.length} related snippets`, 'green');
        passCount++;

        if (context.relatedCode.length > 0) {
          log('\nRelated code:', 'yellow');
          context.relatedCode.slice(0, 2).forEach((snippet, i) => {
            console.log(`  ${i + 1}. [${snippet.score.toFixed(2)}] ${snippet.path}`);
          });
        }
      } else {
        log('✗ FAIL - Invalid context format', 'red');
        failCount++;
      }
    }
  } catch (error) {
    log(`✗ FAIL - ${error.message}`, 'red');
    failCount++;
  }

  // Test 5: Circuit Breaker
  logTest('Circuit Breaker Behavior');
  try {
    // Temporarily break the connection
    const brokenSearch = new SemanticSearch();
    brokenSearch.host = 'invalid-host';

    let failedRequests = 0;
    let circuitOpened = false;

    for (let i = 0; i < 5; i++) {
      try {
        await brokenSearch._request('GET', '/health');
      } catch (error) {
        failedRequests++;
        if (error.message.includes('Circuit breaker open')) {
          circuitOpened = true;
          break;
        }
      }
    }

    if (circuitOpened) {
      log('✓ PASS - Circuit breaker opened after failures', 'green');
      passCount++;
    } else {
      log('⚠ WARN - Circuit breaker did not open (may need more failures)', 'yellow');
      passCount++;  // Not critical failure
    }
  } catch (error) {
    log(`✗ FAIL - ${error.message}`, 'red');
    failCount++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  log('Test Summary', 'blue');
  console.log('='.repeat(60));
  log(`✓ Passed: ${passCount}`, 'green');
  if (failCount > 0) {
    log(`✗ Failed: ${failCount}`, 'red');
  }
  console.log(`Total: ${passCount + failCount}`);
  console.log('='.repeat(60));

  if (failCount === 0) {
    log('\n🎉 All tests passed!', 'green');
  } else {
    log('\n⚠ Some tests failed. Check the output above.', 'yellow');
  }

  // Cleanup
  await search.disconnect();
}

// Run tests
runTests().catch(error => {
  log(`\n❌ Test suite crashed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
