/**
 * Prompt builder for Claude code reviews
 */

/**
 * Build prompt for single file review
 * @param {Object} file - File object with filename, patch, status
 * @param {string} depth - Review depth: 'QUICK' or 'DEEP'
 * @returns {string} File review prompt
 */
function buildFilePrompt(file, depth) {
  const isDeep = depth === 'DEEP';

  let prompt = `# File Review Request\n\n`;
  prompt += `**File:** \`${file.filename}\`\n`;
  prompt += `**Status:** ${file.status}\n`;
  prompt += `**Changes:** +${file.additions} -${file.deletions}\n`;
  prompt += `**Review Depth:** ${depth}\n`;
  prompt += `**Context Strategy:** ${file.contextStrategy || 'DIFF_ONLY'}\n\n`;

  if (isDeep) {
    prompt += `## Instructions\n\n`;
    prompt += `Perform a thorough code review of this file:\n`;
    prompt += `- Check for security vulnerabilities\n`;
    prompt += `- Verify architecture patterns (DI, factories, singletons)\n`;
    prompt += `- Review business logic correctness\n`;
    prompt += `- Check error handling and edge cases\n`;
    prompt += `- Assess performance implications\n`;
    prompt += `- Verify test coverage needs\n\n`;
  } else {
    prompt += `## Instructions\n\n`;
    prompt += `Quick review focusing on:\n`;
    prompt += `- Configuration errors\n`;
    prompt += `- Obvious issues or typos\n`;
    prompt += `- Security concerns in configs\n\n`;
  }

  // Include full file content if available
  if (file.fullContent) {
    prompt += `## Full File Content\n\n`;
    prompt += `\`\`\`${getLanguageFromFilename(file.filename)}\n`;
    prompt += file.fullContent;
    prompt += `\n\`\`\`\n\n`;
  }

  prompt += `## Changes in This PR\n\n`;
  prompt += `\`\`\`diff\n${file.patch}\n\`\`\`\n\n`;

  // Include semantic context if available
  if (file.semanticContext && file.semanticContext.relatedCode && file.semanticContext.relatedCode.length > 0) {
    prompt += `## Related Context (Semantic Search)\n\n`;
    prompt += `The following code snippets were found to be related to this file:\n\n`;

    file.semanticContext.relatedCode.forEach((snippet, idx) => {
      prompt += `### ${idx + 1}. \`${snippet.path || 'unknown'}\``;
      if (snippet.score) {
        prompt += ` (relevance: ${(snippet.score * 100).toFixed(0)}%)`;
      }
      prompt += `\n\n`;

      if (snippet.content) {
        prompt += `\`\`\`${getLanguageFromFilename(snippet.path || '')}\n`;
        prompt += snippet.content;
        prompt += `\n\`\`\`\n\n`;
      }

      if (snippet.description) {
        prompt += `*${snippet.description}*\n\n`;
      }
    });
  }

  prompt += `## Output Requirements\n\n`;
  prompt += `Provide findings in this EXACT format (one finding per block, separated by blank lines):\n\n`;
  prompt += `FILE: ${file.filename}:line_number\n`;
  prompt += `SEVERITY: HIGH|MEDIUM|LOW\n`;
  prompt += `CATEGORY: Category Name\n`;
  prompt += `MESSAGE: Detailed description and fix suggestion.\n\n`;
  prompt += `If no issues found, respond with: "No issues found."\n\n`;
  prompt += `Do NOT use code blocks, markdown headers, or narrative format. Machine will parse your output.`;

  return prompt;
}

/**
 * Build prompt for batch review (multiple QUICK files)
 * @param {Array} files - Array of file objects
 * @returns {string} Batch review prompt
 */
function buildBatchPrompt(files) {
  let prompt = `# Batch Review Request\n\n`;
  prompt += `Reviewing ${files.length} configuration/documentation files.\n\n`;

  prompt += `## Instructions\n\n`;
  prompt += `Quick review of these files focusing on:\n`;
  prompt += `- Configuration errors or inconsistencies\n`;
  prompt += `- Security issues (exposed secrets, weak settings)\n`;
  prompt += `- Documentation accuracy\n`;
  prompt += `- Obvious mistakes\n\n`;

  prompt += `## Files\n\n`;

  files.forEach((file, idx) => {
    prompt += `### ${idx + 1}. \`${file.filename}\` (${file.status}, +${file.additions} -${file.deletions})\n\n`;

    // Include full content if available (FULL_FILES or SEMANTIC_SEARCH strategy)
    if (file.fullContent) {
      prompt += `**Full File Content:**\n`;
      prompt += `\`\`\`${getLanguageFromFilename(file.filename)}\n${file.fullContent}\n\`\`\`\n\n`;
      prompt += `**Changes:**\n`;
    }

    prompt += `\`\`\`diff\n${file.patch}\n\`\`\`\n\n`;
  });

  prompt += `## Output Requirements\n\n`;
  prompt += `For each issue found, use this EXACT format:\n\n`;
  prompt += `FILE: path/to/file.ext\n`;
  prompt += `SEVERITY: HIGH|MEDIUM|LOW\n`;
  prompt += `CATEGORY: Category Name\n`;
  prompt += `MESSAGE: Detailed description.\n\n`;
  prompt += `Separate findings with blank lines. If no issues, respond: "No issues found."`;

  return prompt;
}

/**
 * Build prompt for final review summary
 * @param {Array} reviews - Array of review responses
 * @param {Object} prData - PR metadata
 * @returns {string} Summary prompt
 */
function buildSummaryPrompt(reviews, prData) {
  let prompt = `# Review Compilation Request\n\n`;
  prompt += `**PR:** #${prData.number} - ${prData.title}\n`;
  prompt += `**Files Changed:** ${prData.changedFiles}\n`;
  prompt += `**Lines:** +${prData.additions} -${prData.deletions}\n\n`;

  prompt += `## Instructions\n\n`;
  prompt += `Compile the following individual file reviews into a cohesive final review:\n`;
  prompt += `1. Consolidate duplicate findings\n`;
  prompt += `2. Prioritize by severity (HIGH → MEDIUM → LOW)\n`;
  prompt += `3. Group related issues\n`;
  prompt += `4. Provide overall assessment\n`;
  prompt += `5. Highlight critical blockers\n\n`;

  prompt += `## Individual File Reviews\n\n`;

  reviews.forEach((review, idx) => {
    if (review && review.trim()) {
      prompt += `### Review ${idx + 1}\n\n`;
      prompt += review;
      prompt += `\n\n---\n\n`;
    }
  });

  prompt += `Provide a complete, well-organized review using the structured format.`;

  return prompt;
}

/**
 * Build prompt for streaming progress
 * @param {string} currentFile - Current file being reviewed
 * @param {number} progress - Progress percentage
 * @param {number} total - Total files
 * @returns {string} Progress message
 */
function buildProgressMessage(currentFile, progress, total) {
  return `Reviewing ${currentFile}... (${progress}/${total})`;
}

/**
 * Extract code blocks from markdown
 * @param {string} text - Markdown text
 * @returns {Array} Array of code blocks
 */
function extractCodeBlocks(text) {
  const codeBlockPattern = /```[\w]*\n([\s\S]*?)```/g;
  const blocks = [];
  let match;

  while ((match = codeBlockPattern.exec(text)) !== null) {
    blocks.push(match[1]);
  }

  return blocks;
}

/**
 * Truncate large diffs for context window management
 * @param {string} patch - Git patch
 * @param {number} maxLines - Maximum lines to include
 * @returns {string} Truncated patch
 */
function truncatePatch(patch, maxLines = 500) {
  const lines = patch.split('\n');

  if (lines.length <= maxLines) {
    return patch;
  }

  const truncated = lines.slice(0, maxLines);
  truncated.push(`\n... (truncated ${lines.length - maxLines} lines)`);

  return truncated.join('\n');
}

/**
 * Calculate batch size for files
 * @param {Array} files - Files to batch
 * @param {number} maxTokens - Maximum tokens per batch
 * @returns {Array} Array of file batches
 */
function createBatches(files, maxTokens = 8000) {
  const batches = [];
  let currentBatch = [];
  let currentTokens = 0;

  for (const file of files) {
    // Rough token estimation - include fullContent if available
    const patchTokens = Math.ceil((file.patch?.length || 0) / 4);
    const contentTokens = Math.ceil((file.fullContent?.length || 0) / 4);
    const fileTokens = patchTokens + contentTokens;

    if (currentTokens + fileTokens > maxTokens && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [file];
      currentTokens = fileTokens;
    } else {
      currentBatch.push(file);
      currentTokens += fileTokens;
    }

    // Max 10 files per batch (or fewer if files have full content)
    const maxFilesPerBatch = file.fullContent ? 5 : 10;
    if (currentBatch.length >= maxFilesPerBatch) {
      batches.push(currentBatch);
      currentBatch = [];
      currentTokens = 0;
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Get language identifier from filename for syntax highlighting
 * @param {string} filename - File name
 * @returns {string} Language identifier
 */
function getLanguageFromFilename(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const languageMap = {
    'js': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'jsx': 'javascript',
    'swift': 'swift',
    'kt': 'kotlin',
    'java': 'java',
    'py': 'python',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'php': 'php',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'md': 'markdown',
    'sh': 'bash',
    'sql': 'sql'
  };
  return languageMap[ext] || ext;
}

/**
 * Build enriched prompt with full context (for SEMANTIC_SEARCH or FULL_FILES)
 * @param {Object} file - File with fullContent and semanticContext
 * @param {string} depth - Review depth
 * @returns {string} Enriched prompt
 */
function buildEnrichedFilePrompt(file, depth) {
  // Use the updated buildFilePrompt which now handles enriched context
  return buildFilePrompt(file, depth);
}

module.exports = {
  buildFilePrompt,
  buildBatchPrompt,
  buildSummaryPrompt,
  buildProgressMessage,
  extractCodeBlocks,
  truncatePatch,
  createBatches,
  getLanguageFromFilename,
  buildEnrichedFilePrompt
};
