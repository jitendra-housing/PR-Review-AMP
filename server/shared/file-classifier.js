/**
 * File classification for review depth
 */

const AUTO_SKIP_PATTERNS = [
  // Lock files
  /package-lock\.json$/,
  /yarn\.lock$/,
  /Gemfile\.lock$/,
  /Podfile\.lock$/,
  /poetry\.lock$/,
  /Cargo\.lock$/,

  // Generated code
  /\.generated\./,
  /\.g\.dart$/,
  /\.pb\.go$/,
  /\.pb\.swift$/,

  // Minified files
  /\.min\.js$/,
  /\.min\.css$/,

  // Build artifacts
  /\/build\//,
  /\/dist\//,
  /\/out\//,
  /\/target\//,

  // Binary files
  /\.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|mp3|mp4|webm)$/i,

  // Large data files
  /\.(json|xml)$/ // Will be reclassified below if small
];

const QUICK_REVIEW_EXTENSIONS = [
  '.md', '.txt', '.yaml', '.yml', '.toml',
  '.ini', '.conf', '.config', '.env.example'
];

const DEEP_REVIEW_EXTENSIONS = [
  // JavaScript/TypeScript
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',

  // Mobile
  '.swift', '.kt', '.java', '.m', '.mm', '.dart',

  // Backend
  '.py', '.rb', '.go', '.rs', '.php',

  // Web
  '.vue', '.svelte', '.astro', '.html', '.css', '.scss', '.less',

  // Testing
  '.test.js', '.test.ts', '.spec.js', '.spec.ts'
];

/**
 * Classify file into AUTO_SKIP, QUICK, or DEEP
 * @param {Object} file - File object with filename, status, changes, patch
 * @returns {string} Classification: 'AUTO_SKIP', 'QUICK', or 'DEEP'
 */
function classifyFile(file) {
  const filename = file.filename;

  // Check AUTO_SKIP patterns
  for (const pattern of AUTO_SKIP_PATTERNS) {
    if (pattern.test(filename)) {
      // Exception: Small JSON/YAML files might need review (but not lock files)
      const isLockFile = filename.includes('lock') || filename.includes('Lock');
      if (!isLockFile && (filename.endsWith('.json') || filename.endsWith('.yaml') || filename.endsWith('.yml'))) {
        if (file.changes < 100) {
          return 'QUICK';
        }
      }
      return 'AUTO_SKIP';
    }
  }

  // Check QUICK review extensions
  for (const ext of QUICK_REVIEW_EXTENSIONS) {
    if (filename.endsWith(ext)) {
      return 'QUICK';
    }
  }

  // Check DEEP review extensions
  for (const ext of DEEP_REVIEW_EXTENSIONS) {
    if (filename.endsWith(ext)) {
      return 'DEEP';
    }
  }

  // Default to QUICK for unknown file types
  return 'QUICK';
}

/**
 * Classify all files in a PR
 * @param {Array} files - Array of file objects
 * @returns {Object} Classified files by category
 */
function classifyFiles(files) {
  const classified = {
    AUTO_SKIP: [],
    QUICK: [],
    DEEP: []
  };

  for (const file of files) {
    const category = classifyFile(file);
    classified[category].push(file);
  }

  return classified;
}

module.exports = { classifyFile, classifyFiles };
