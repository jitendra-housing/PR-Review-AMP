#!/usr/bin/env node

/**
 * Test script to verify both agent modes work
 * Tests that all modules can be loaded without errors
 */

console.log('🧪 Testing PR Review System\n');

// Test 1: Load shared modules
console.log('Test 1: Loading shared modules...');
try {
  require('./shared/webhook-validator');
  require('./shared/queue-manager');
  require('./shared/github-client');
  require('./shared/file-classifier');
  require('./shared/review-formatter');
  console.log('✅ Shared modules loaded successfully\n');
} catch (error) {
  console.error('❌ Failed to load shared modules:', error.message);
  process.exit(1);
}

// Test 2: Load Claude modules
console.log('Test 2: Loading Claude modules...');
try {
  require('./claude/api-client');
  require('./claude/pattern-cache');
  require('./claude/prompt-builder');
  require('./claude/streaming-handler');
  console.log('✅ Claude modules loaded successfully\n');
} catch (error) {
  console.error('❌ Failed to load Claude modules:', error.message);
  process.exit(1);
}

// Test 3: Load handlers
console.log('Test 3: Loading handlers...');
try {
  require('./amp-handler');
  require('./claude-handler');
  console.log('✅ Handlers loaded successfully\n');
} catch (error) {
  console.error('❌ Failed to load handlers:', error.message);
  process.exit(1);
}

// Test 4: Test file classification
console.log('Test 4: Testing file classification...');
try {
  const { classifyFile } = require('./shared/file-classifier');

  const tests = [
    { filename: 'package-lock.json', expected: 'AUTO_SKIP' },
    { filename: 'README.md', expected: 'QUICK' },
    { filename: 'src/index.js', expected: 'DEEP' },
    { filename: 'App.swift', expected: 'DEEP' },
    { filename: 'config.yml', expected: 'QUICK' }
  ];

  let passed = 0;
  for (const test of tests) {
    const file = { filename: test.filename, changes: 50, status: 'modified', patch: '' };
    const result = classifyFile(file);
    if (result === test.expected) {
      passed++;
      console.log(`  ✓ ${test.filename} → ${result}`);
    } else {
      console.log(`  ✗ ${test.filename} → ${result} (expected ${test.expected})`);
    }
  }

  if (passed === tests.length) {
    console.log(`✅ File classification: ${passed}/${tests.length} tests passed\n`);
  } else {
    console.error(`❌ File classification: ${passed}/${tests.length} tests passed\n`);
    process.exit(1);
  }
} catch (error) {
  console.error('❌ File classification test failed:', error.message);
  process.exit(1);
}

// Test 5: Test queue manager
console.log('Test 5: Testing queue manager...');
try {
  const QueueManager = require('./shared/queue-manager');
  const queueManager = new QueueManager();

  // Register mock handlers
  queueManager.registerHandler('amp', async (prUrl) => {
    return { success: true, message: 'Mock Amp review' };
  });

  queueManager.registerHandler('claude', async (prUrl) => {
    return { success: true, message: 'Mock Claude review' };
  });

  const status = queueManager.getStatus();
  if (status.queues.amp && status.queues.claude) {
    console.log('  ✓ Queue manager initialized');
    console.log('  ✓ Handlers registered: amp, claude');
    console.log('✅ Queue manager working\n');
  } else {
    throw new Error('Queue status missing expected queues');
  }
} catch (error) {
  console.error('❌ Queue manager test failed:', error.message);
  process.exit(1);
}

// Test 6: Test environment variables
console.log('Test 6: Checking environment configuration...');
const requiredVars = ['GITHUB_TOKEN', 'GITHUB_WEBHOOK_SECRET', 'GITHUB_USERNAME'];
const optionalVars = ['AGENT', 'MODEL', 'ANTHROPIC_API_KEY'];

let envWarnings = 0;
for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.log(`  ⚠️  ${varName} not set (required for production)`);
    envWarnings++;
  }
}

for (const varName of optionalVars) {
  if (!process.env[varName]) {
    console.log(`  ℹ️  ${varName} not set (using defaults)`);
  } else {
    console.log(`  ✓ ${varName} = ${varName === 'ANTHROPIC_API_KEY' ? '[REDACTED]' : process.env[varName]}`);
  }
}

if (envWarnings > 0) {
  console.log(`⚠️  ${envWarnings} required environment variables missing\n`);
} else {
  console.log('✅ Environment configuration OK\n');
}

// Summary
console.log('═══════════════════════════════════════');
console.log('✅ All tests passed!');
console.log('═══════════════════════════════════════');
console.log('\nThe PR Review System is ready to use.');
console.log('\nTo start the server:');
console.log('  npm start              # Use default agent (amp)');
console.log('  AGENT=claude npm start # Use Claude API');
console.log('  AGENT=amp npm start    # Use Amp CLI');
console.log('\nTo test the health endpoint:');
console.log('  curl http://localhost:3000/health\n');
