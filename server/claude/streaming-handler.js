/**
 * Streaming handler for Claude API responses
 */

/**
 * Process streaming response from Claude
 * @param {Stream} stream - Claude API stream
 * @param {Function} onProgress - Progress callback (optional)
 * @returns {Promise<Object>} { text: string, usage: Object|null }
 */
async function processStream(stream, onProgress = null) {
  let fullText = '';
  let currentBlock = '';
  let usage = null;

  try {
    for await (const chunk of stream) {
      // Handle different chunk types
      if (chunk.type === 'content_block_start') {
        currentBlock = '';
      } else if (chunk.type === 'content_block_delta') {
        if (chunk.delta?.text) {
          const text = chunk.delta.text;
          currentBlock += text;
          fullText += text;

          // Call progress callback with current text
          if (onProgress) {
            onProgress(text, fullText);
          }
        }
      } else if (chunk.type === 'content_block_stop') {
        // Block complete
        if (currentBlock && onProgress) {
          onProgress(null, fullText, true); // Signal block completion
        }
      } else if (chunk.type === 'message_delta') {
        // Capture usage from final message delta
        if (chunk.usage) {
          usage = {
            input_tokens: chunk.usage.input_tokens || 0,
            output_tokens: chunk.usage.output_tokens || 0,
            cache_creation_input_tokens: chunk.usage.cache_creation_input_tokens || 0,
            cache_read_input_tokens: chunk.usage.cache_read_input_tokens || 0
          };
        }
      } else if (chunk.type === 'message_stop') {
        // Message complete
        break;
      }
    }

    // Try to get final usage from stream if available
    if (!usage && stream.finalMessage) {
      const finalMsg = await stream.finalMessage();
      if (finalMsg?.usage) {
        usage = {
          input_tokens: finalMsg.usage.input_tokens || 0,
          output_tokens: finalMsg.usage.output_tokens || 0,
          cache_creation_input_tokens: finalMsg.usage.cache_creation_input_tokens || 0,
          cache_read_input_tokens: finalMsg.usage.cache_read_input_tokens || 0
        };
      }
    }

    return { text: fullText, usage };
  } catch (error) {
    console.error('[STREAM] Error processing stream:', error.message);
    throw error;
  }
}

/**
 * Extract complete findings from partial stream
 * Useful for showing findings as they're generated
 * @param {string} partialText - Partial response text
 * @returns {Array} Array of complete findings
 */
function extractCompleteFindings(partialText) {
  const findings = [];

  // Look for complete FILE...MESSAGE blocks
  const findingPattern = /FILE:\s*(.+?)(?::(\d+))?\s*\nSEVERITY:\s*(HIGH|MEDIUM|LOW)\s*\n(?:CATEGORY:\s*(.+?)\s*\n)?MESSAGE:\s*([\s\S]+?)(?=\n\nFILE:|$)/gi;

  let match;
  while ((match = findingPattern.exec(partialText)) !== null) {
    // Only include if MESSAGE appears complete (ends with period or newline)
    const message = match[5].trim();
    if (message.endsWith('.') || message.endsWith('\n') || message.length > 50) {
      findings.push({
        file: match[1].trim(),
        line: match[2] ? parseInt(match[2]) : null,
        severity: match[3],
        category: match[4] ? match[4].trim() : null,
        message: message
      });
    }
  }

  return findings;
}

/**
 * Create a progress callback that logs to console
 * @param {string} fileContext - File being reviewed (for context)
 * @returns {Function} Progress callback
 */
function createConsoleProgressCallback(fileContext) {
  let lastLength = 0;

  return (deltaText, fullText, blockComplete) => {
    if (blockComplete) {
      console.log(`[STREAM] ✓ Block complete for ${fileContext}`);
    } else if (deltaText) {
      // Only log significant chunks to avoid spam
      if (fullText.length - lastLength > 100) {
        console.log(`[STREAM] Received ${fullText.length} chars for ${fileContext}...`);
        lastLength = fullText.length;
      }
    }
  };
}

/**
 * Create a progress callback that extracts and displays findings
 * @param {Function} onFindingComplete - Callback when finding is complete
 * @returns {Function} Progress callback
 */
function createFindingExtractorCallback(onFindingComplete) {
  let lastFindingCount = 0;

  return (deltaText, fullText, blockComplete) => {
    const findings = extractCompleteFindings(fullText);

    // Check if new complete findings appeared
    if (findings.length > lastFindingCount) {
      const newFindings = findings.slice(lastFindingCount);
      newFindings.forEach(finding => {
        if (onFindingComplete) {
          onFindingComplete(finding);
        }
      });
      lastFindingCount = findings.length;
    }
  };
}

/**
 * Process stream with finding extraction
 * @param {Stream} stream - Claude API stream
 * @param {Function} onFindingComplete - Callback for each complete finding
 * @returns {Promise<Object>} { text, findings }
 */
async function processStreamWithFindings(stream, onFindingComplete = null) {
  const progressCallback = onFindingComplete ?
    createFindingExtractorCallback(onFindingComplete) :
    null;

  const text = await processStream(stream, progressCallback);
  const findings = extractCompleteFindings(text);

  return { text, findings };
}

module.exports = {
  processStream,
  extractCompleteFindings,
  createConsoleProgressCallback,
  createFindingExtractorCallback,
  processStreamWithFindings
};
