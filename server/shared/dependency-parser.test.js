const DependencyParser = require('./dependency-parser');

/**
 * Simple test runner (no external dependencies needed)
 */
function runTests() {
  const parser = new DependencyParser();
  let passed = 0;
  let failed = 0;

  console.log('\n🧪 Running Dependency Parser Tests\n');

  // Test 1: JavaScript import statements
  function testJavaScriptImports() {
    const code = `
      import React from 'react';
      import { useState, useEffect } from 'react';
      import ProfileService from './services/ProfileService';
      const axios = require('axios');
      const helper = require('./utils/helper');
    `;

    const { imports } = parser.parseJavaScript(code);

    if (imports.includes('./services/ProfileService') && imports.includes('./utils/helper')) {
      console.log('✓ Test 1: JavaScript imports - PASSED');
      passed++;
    } else {
      console.log('✗ Test 1: JavaScript imports - FAILED');
      console.log('  Expected imports to include local paths');
      console.log('  Got:', imports);
      failed++;
    }
  }

  // Test 2: JavaScript export statements
  function testJavaScriptExports() {
    const code = `
      export class ProfileView extends React.Component {}
      export function fetchData() {}
      export const API_KEY = 'test';
      export default ProfileService;
    `;

    const { exports } = parser.parseJavaScript(code);

    if (exports.includes('ProfileView') && exports.includes('API_KEY')) {
      console.log('✓ Test 2: JavaScript exports - PASSED');
      passed++;
    } else {
      console.log('✗ Test 2: JavaScript exports - FAILED');
      console.log('  Expected exports to include ProfileView and API_KEY');
      console.log('  Got:', exports);
      failed++;
    }
  }

  // Test 3: Swift import statements
  function testSwiftImports() {
    const code = `
      import UIKit
      import Foundation
      import SwiftUI

      public class MyView: UIView {}
    `;

    const { imports, exports } = parser.parseSwift(code);

    if (imports.includes('UIKit') && imports.includes('Foundation') && exports.includes('MyView')) {
      console.log('✓ Test 3: Swift imports and exports - PASSED');
      passed++;
    } else {
      console.log('✗ Test 3: Swift imports and exports - FAILED');
      console.log('  Expected imports: UIKit, Foundation');
      console.log('  Expected exports: MyView');
      console.log('  Got imports:', imports);
      console.log('  Got exports:', exports);
      failed++;
    }
  }

  // Test 4: Python imports
  function testPythonImports() {
    const code = `
      import os
      import sys
      from django.db import models
      from .utils import helper
    `;

    const { imports } = parser.parsePython(code);

    if (imports.includes('os') && imports.includes('django.db') && imports.includes('.utils')) {
      console.log('✓ Test 4: Python imports - PASSED');
      passed++;
    } else {
      console.log('✗ Test 4: Python imports - FAILED');
      console.log('  Expected imports to include os, django.db, .utils');
      console.log('  Got:', imports);
      failed++;
    }
  }

  // Test 5: Find dependents
  function testFindDependents() {
    const targetFile = {
      filename: 'src/services/ProfileService.js',
      content: 'export class ProfileService { fetchData() {} }'
    };

    const allFiles = [
      targetFile,
      {
        filename: 'src/components/Profile.js',
        content: "import { ProfileService } from '../services/ProfileService';"
      },
      {
        filename: 'src/utils/helper.js',
        content: "const fs = require('fs');"
      }
    ];

    const dependents = parser.findDependents(targetFile, allFiles);

    if (dependents.length === 1 && dependents[0].filename === 'src/components/Profile.js') {
      console.log('✓ Test 5: Find dependents - PASSED');
      passed++;
    } else {
      console.log('✗ Test 5: Find dependents - FAILED');
      console.log('  Expected 1 dependent: Profile.js');
      console.log('  Got:', dependents.map(d => d.filename));
      failed++;
    }
  }

  // Test 6: Find related tests
  function testFindRelatedTests() {
    const targetFile = {
      filename: 'src/services/ProfileService.js',
      content: 'export class ProfileService {}'
    };

    const allFiles = [
      targetFile,
      {
        filename: 'src/services/__tests__/ProfileService.test.js',
        content: "import { ProfileService } from '../ProfileService';"
      },
      {
        filename: 'src/services/UserService.test.js',
        content: 'import { UserService } from "./UserService";'
      }
    ];

    const tests = parser.findRelatedTests(targetFile, allFiles);

    if (tests.length === 1 && tests[0].filename.includes('ProfileService.test.js')) {
      console.log('✓ Test 6: Find related tests - PASSED');
      passed++;
    } else {
      console.log('✗ Test 6: Find related tests - FAILED');
      console.log('  Expected 1 test file: ProfileService.test.js');
      console.log('  Got:', tests.map(t => t.filename));
      failed++;
    }
  }

  // Test 7: Language detection
  function testLanguageDetection() {
    const tests = [
      { file: 'app.js', expected: 'javascript' },
      { file: 'component.tsx', expected: 'typescript' },
      { file: 'ViewController.swift', expected: 'swift' },
      { file: 'MainActivity.kt', expected: 'kotlin' },
      { file: 'script.py', expected: 'python' }
    ];

    let allPassed = true;
    for (const test of tests) {
      const detected = parser.detectLanguage(test.file);
      if (detected !== test.expected) {
        console.log(`✗ Test 7: Language detection - FAILED for ${test.file}`);
        console.log(`  Expected: ${test.expected}, Got: ${detected}`);
        allPassed = false;
        break;
      }
    }

    if (allPassed) {
      console.log('✓ Test 7: Language detection - PASSED');
      passed++;
    } else {
      failed++;
    }
  }

  // Test 8: parseFile integration
  function testParseFile() {
    const jsCode = "import React from 'react'; export class App {}";
    const result = parser.parseFile('App.js', jsCode);

    if (result.imports.length >= 0 && result.exports.includes('App')) {
      console.log('✓ Test 8: parseFile integration - PASSED');
      passed++;
    } else {
      console.log('✗ Test 8: parseFile integration - FAILED');
      console.log('  Expected exports to include App');
      console.log('  Got:', result);
      failed++;
    }
  }

  // Run all tests
  try {
    testJavaScriptImports();
    testJavaScriptExports();
    testSwiftImports();
    testPythonImports();
    testFindDependents();
    testFindRelatedTests();
    testLanguageDetection();
    testParseFile();
  } catch (error) {
    console.error('\n❌ Test execution error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50) + '\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('✅ All tests passed!\n');
    process.exit(0);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };
