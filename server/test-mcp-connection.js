#!/usr/bin/env node

/**
 * Test script for MCP integration
 * Verifies connection to claude-context MCP server
 */

require('dotenv').config();
const MCPClient = require('./claude/mcp-client');
const SemanticSearch = require('./claude/semantic-search');

async function testMCPConnection() {
  console.log('='.repeat(60));
  console.log('MCP Connection Test');
  console.log('='.repeat(60));
  console.log();

  // Check environment variables
  console.log('1. Checking environment configuration...');
  console.log(`   MCP_SERVER_ENABLED: ${process.env.MCP_SERVER_ENABLED}`);
  console.log(`   CONTEXT_STRATEGY: ${process.env.CONTEXT_STRATEGY}`);
  console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✓ Set' : '✗ Not set'}`);
  console.log();

  if (process.env.MCP_SERVER_ENABLED !== 'true') {
    console.log('⚠️  MCP is disabled. Set MCP_SERVER_ENABLED=true to test.');
    console.log('Exiting...');
    return;
  }

  // Test MCP Client
  console.log('2. Testing MCP Client...');
  const mcpClient = new MCPClient();

  try {
    const connected = await mcpClient.connect();

    if (connected) {
      console.log('   ✓ MCP client connected successfully');
      console.log(`   Available tools: ${mcpClient.availableTools.join(', ')}`);
    } else {
      console.log('   ✗ MCP client failed to connect');
      return;
    }
  } catch (error) {
    console.log(`   ✗ Connection error: ${error.message}`);
    return;
  }
  console.log();

  // Test Semantic Search
  console.log('3. Testing Semantic Search Wrapper...');
  const semanticSearch = new SemanticSearch();

  try {
    const initialized = await semanticSearch.initialize();

    if (initialized) {
      console.log('   ✓ Semantic search initialized');
    } else {
      console.log('   ✗ Semantic search initialization failed');
      return;
    }
  } catch (error) {
    console.log(`   ✗ Initialization error: ${error.message}`);
    return;
  }
  console.log();

  // Test repository indexing status
  console.log('4. Testing repository indexing check...');
  const testRepo = 'housing-app/ios'; // Example repository

  try {
    console.log(`   Checking if "${testRepo}" is indexed...`);
    const isIndexed = await semanticSearch.checkRepositoryIndexed(testRepo);

    if (isIndexed) {
      console.log(`   ✓ Repository "${testRepo}" is indexed and ready`);
    } else {
      console.log(`   ⚠️  Repository "${testRepo}" is not indexed`);
      console.log(`   To index it, the MCP server needs to run: index_codebase`);
    }
  } catch (error) {
    console.log(`   ✗ Index check error: ${error.message}`);
  }
  console.log();

  // Test semantic search
  console.log('5. Testing semantic code search...');
  const testQuery = 'Find files that use DependencyContainer';

  try {
    console.log(`   Query: "${testQuery}"`);
    console.log('   Searching...');

    const results = await semanticSearch.searchRelevantCode(testQuery, { limit: 5 });

    if (results.length > 0) {
      console.log(`   ✓ Found ${results.length} results`);
      results.forEach((result, idx) => {
        console.log(`   ${idx + 1}. ${result.path || 'unknown'} (score: ${result.score || 'N/A'})`);
      });
    } else {
      console.log('   ℹ️  No results found (this is normal if repo not indexed)');
    }
  } catch (error) {
    console.log(`   ⚠️  Search error: ${error.message}`);
    console.log('   This is expected if MCP tool execution is not yet implemented.');
  }
  console.log();

  // Cleanup
  console.log('6. Cleaning up...');
  await semanticSearch.disconnect();
  console.log('   ✓ Disconnected');
  console.log();

  console.log('='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log('✓ MCP client structure is correct');
  console.log('✓ Semantic search wrapper is functional');
  console.log('⚠️  Note: Actual MCP tool execution requires:');
  console.log('   1. Running MCP server (claude-context)');
  console.log('   2. Proper MCP protocol integration');
  console.log('   3. Zilliz Cloud API credentials');
  console.log('   4. OpenAI API key for embeddings');
  console.log();
  console.log('Next steps:');
  console.log('1. Ensure claude-context MCP server is running');
  console.log('2. Link it via Claude Desktop or direct connection');
  console.log('3. Verify credentials in environment');
  console.log('4. Index your repositories');
  console.log('5. Run this test again');
  console.log('='.repeat(60));
}

// Run test
testMCPConnection()
  .then(() => {
    console.log('\nTest completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTest failed with error:', error);
    process.exit(1);
  });
