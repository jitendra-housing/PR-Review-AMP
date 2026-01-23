const path = require('path');

/**
 * Dependency Parser - Extract imports/exports from code files
 * Supports JavaScript, TypeScript, Swift, Python, Kotlin, Java
 */
class DependencyParser {
  /**
   * Extract imports and exports from a file based on language
   * @param {string} filename - File name
   * @param {string} content - File content
   * @returns {Object} { imports: [], exports: [] }
   */
  parseFile(filename, content) {
    const lang = this.detectLanguage(filename);

    switch (lang) {
      case 'javascript':
      case 'typescript':
        return this.parseJavaScript(content);

      case 'swift':
        return this.parseSwift(content);

      case 'kotlin':
      case 'java':
        return this.parseJava(content);

      case 'python':
        return this.parsePython(content);

      default:
        return { imports: [], exports: [] };
    }
  }

  /**
   * Parse JavaScript/TypeScript imports and exports
   * Handles: import, require, export
   * @param {string} content - File content
   * @returns {Object} { imports: [], exports: [] }
   */
  parseJavaScript(content) {
    const imports = [];
    const exports = [];

    // Remove comments to avoid false matches
    const cleanContent = this.removeComments(content, 'javascript');

    // Match import statements
    // import X from 'path'
    // import { X, Y } from 'path'
    // import * as X from 'path'
    const importRegex = /import\s+(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(cleanContent)) !== null) {
      const importPath = match[1];
      // ONLY include relative imports (local files)
      if (importPath && (importPath.startsWith('./') || importPath.startsWith('../'))) {
        imports.push(importPath);
      }
    }

    // Match require statements
    // const X = require('path')
    // require('path')
    const requireRegex = /require\s*\(['"]([^'"]+)['"]\)/g;

    while ((match = requireRegex.exec(cleanContent)) !== null) {
      const requirePath = match[1];
      // ONLY include relative requires (local files)
      if (requirePath && (requirePath.startsWith('./') || requirePath.startsWith('../'))) {
        imports.push(requirePath);
      }
    }

    // Match export statements - be more conservative
    // Match actual export declarations (allow semicolons before for chained statements)
    const exportRegex = /(?:^|;)\s*export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+([A-Z]\w+)/gm;

    while ((match = exportRegex.exec(cleanContent)) !== null) {
      exports.push(match[1]);
    }

    return { imports: this.deduplicateArray(imports), exports: this.deduplicateArray(exports) };
  }

  /**
   * Parse Swift imports and exports
   * Handles: import statements and class/struct/protocol definitions
   * @param {string} content - File content
   * @returns {Object} { imports: [], exports: [] }
   */
  parseSwift(content) {
    const imports = [];
    const exports = [];

    // Match import statements
    // import UIKit
    // import Foundation
    const importRegex = /import\s+(\w+)/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Match Swift class/struct/protocol definitions
    // class X, public class X, struct X, protocol X, enum X
    const exportRegex = /(?:public\s+|private\s+|internal\s+|open\s+)?(?:class|struct|protocol|enum|actor)\s+(\w+)/g;

    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    return { imports: this.deduplicateArray(imports), exports: this.deduplicateArray(exports) };
  }

  /**
   * Parse Java/Kotlin imports and exports
   * Handles: import statements and class definitions
   * @param {string} content - File content
   * @returns {Object} { imports: [], exports: [] }
   */
  parseJava(content) {
    const imports = [];
    const exports = [];

    // Match import statements
    // import com.example.Foo
    const importRegex = /import\s+([\w.]+)/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Match class/interface definitions
    // class X, public class X, interface X
    const exportRegex = /(?:public\s+|private\s+|protected\s+)?(?:class|interface|enum|object)\s+(\w+)/g;

    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    return { imports: this.deduplicateArray(imports), exports: this.deduplicateArray(exports) };
  }

  /**
   * Parse Python imports
   * Handles: from X import Y, import X
   * @param {string} content - File content
   * @returns {Object} { imports: [], exports: [] }
   */
  parsePython(content) {
    const imports = [];

    // Match from X import Y
    // Match import X
    const importRegex = /(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1] || match[2]);
    }

    // Python doesn't have explicit exports, classes/functions are implicitly exported
    return { imports: this.deduplicateArray(imports), exports: [] };
  }

  /**
   * Find files that depend on the target file
   * (Search through allFiles to find dependents)
   * @param {Object} targetFile - Target file object { filename, content }
   * @param {Array} allFiles - All files to search through
   * @returns {Array} Dependent files
   */
  findDependents(targetFile, allFiles) {
    const dependents = [];
    const targetBasename = path.basename(targetFile.filename, path.extname(targetFile.filename));
    const targetPath = targetFile.filename;
    const targetDir = path.dirname(targetFile.filename);

    for (const file of allFiles) {
      if (file.filename === targetPath) continue;

      try {
        const { imports } = this.parseFile(file.filename, file.content || file.fullContent || '');

        // Check if this file imports our target
        for (const imp of imports) {
          // Normalize both paths for comparison
          const normalizedImport = this.normalizeImportPath(imp);
          const normalizedTarget = this.normalizeImportPath(targetPath);

          // Be strict: only match if basename matches AND path resolves correctly
          const importBasename = path.basename(normalizedImport);

          if (importBasename === targetBasename) {
            // Additional verification: check if import path can resolve to target
            // This reduces false positives significantly
            const hasMatch =
              normalizedImport.includes(targetBasename) &&
              (normalizedTarget.includes(normalizedImport) ||
               normalizedImport.includes(targetBasename));

            if (hasMatch) {
              dependents.push({
                ...file,
                relationship: 'dependent'
              });
              break;
            }
          }
        }
      } catch (error) {
        // Skip files that can't be parsed
        continue;
      }
    }

    return dependents;
  }

  /**
   * Find test files related to this file
   * @param {Object} targetFile - Target file object { filename, content }
   * @param {Array} allFiles - All files to search through
   * @returns {Array} Test files
   */
  findRelatedTests(targetFile, allFiles) {
    const tests = [];
    const basename = path.basename(targetFile.filename, path.extname(targetFile.filename));
    const targetLower = basename.toLowerCase();

    for (const file of allFiles) {
      const filename = file.filename.toLowerCase();

      // Common test patterns:
      // - filename.test.js, filename.spec.js
      // - filenameTest.swift, filenameTests.swift
      // - __tests__/filename.js
      const isTestFile = filename.includes('test') || filename.includes('spec') || filename.includes('__tests__');

      if (isTestFile && (filename.includes(targetLower) || (file.content || file.fullContent || '').includes(basename))) {
        tests.push({
          ...file,
          relationship: 'test'
        });
      }
    }

    return tests;
  }

  /**
   * Detect programming language from filename
   * @param {string} filename - File name
   * @returns {string} Language identifier
   */
  detectLanguage(filename) {
    const ext = path.extname(filename).toLowerCase();

    const langMap = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.kts': 'kotlin',
      '.java': 'java',
      '.py': 'python',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust'
    };

    return langMap[ext] || 'unknown';
  }

  /**
   * Remove comments from code to avoid false matches
   * @param {string} content - Code content
   * @param {string} language - Programming language
   * @returns {string} Content without comments
   */
  removeComments(content, language) {
    if (language === 'javascript' || language === 'typescript') {
      // Remove single-line comments
      content = content.replace(/\/\/.*$/gm, '');
      // Remove multi-line comments
      content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    } else if (language === 'python') {
      // Remove Python comments
      content = content.replace(/#.*$/gm, '');
      // Remove docstrings (triple quotes)
      content = content.replace(/"""[\s\S]*?"""/g, '');
      content = content.replace(/'''[\s\S]*?'''/g, '');
    } else if (language === 'swift') {
      // Remove Swift comments
      content = content.replace(/\/\/.*$/gm, '');
      content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    }

    return content;
  }

  /**
   * Normalize import path for comparison
   * Removes extensions, resolves relative paths
   * @param {string} importPath - Import path
   * @returns {string} Normalized path
   */
  normalizeImportPath(importPath) {
    // Remove file extensions
    let normalized = importPath.replace(/\.(js|jsx|ts|tsx|swift|kt|py)$/, '');

    // Remove leading ./
    normalized = normalized.replace(/^\.\//, '');

    return normalized;
  }

  /**
   * Helper: Remove duplicates from array
   * @param {Array} arr - Array to deduplicate
   * @returns {Array} Deduplicated array
   */
  deduplicateArray(arr) {
    return [...new Set(arr)];
  }
}

module.exports = DependencyParser;
