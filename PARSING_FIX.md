# Parsing Issues Fixed

## Problem Identified

The review output showed:
- ❌ "File: Unknown" for most findings
- ❌ Empty messages (just "SEVERITY: HIGH" with no description)
- ❌ No actual issue details
- ❌ Broken structured format

**Root Cause:** Claude wasn't following the structured output format specified in the system prompt.

## What Was Broken

### 1. Weak Prompt Instructions
**Before:**
```
For each finding, use this structured format:
```
FILE: path/to/file.ext:line_number
SEVERITY: HIGH|MEDIUM|LOW
CATEGORY: Category Name
MESSAGE: Description...
```
```

**Problem:** Format shown inside code blocks, treated as example rather than requirement.

### 2. Inadequate Fallback Parser
**Before:** Only looked for emoji markers (🔴🟡) and specific keywords, extracted wrong content.

**Problem:**
- Extracted headers like "SEVERITY: HIGH" as messages
- Couldn't handle narrative or markdown-formatted responses
- Poor file detection (only backticks with specific extensions)

### 3. No Debugging Visibility
**Before:** No way to see what Claude actually returned when parsing failed.

## Fixes Applied

### 1. Strengthened Prompt Instructions (`pattern-cache.js`)

**✅ Made format mandatory:**
```
**YOU MUST output findings in this EXACT format (no code blocks, no markdown formatting):**

FILE: path/to/file.ext:line_number
SEVERITY: HIGH|MEDIUM|LOW
CATEGORY: Category Name
MESSAGE: Detailed description of the issue and suggested fix.
```

**✅ Added multiple examples:**
```
FILE: ios/Services/AuthService.swift:42
SEVERITY: HIGH
CATEGORY: Security
MESSAGE: Hardcoded API key detected. This exposes sensitive credentials...
```

**✅ Added strict rules:**
```
1. Each finding MUST start with "FILE:" on a new line
2. Use EXACT field names: FILE, SEVERITY, CATEGORY, MESSAGE
3. Do NOT wrap findings in code blocks
4. Do NOT add extra headers between findings
```

**✅ Added enforcement language:**
```
Your responses will be parsed by a machine, so you MUST follow the exact format.
Your output will be parsed by regex. Follow the format exactly.
```

### 2. Enhanced Fallback Parser (`review-formatter.js`)

**✅ Improved structured format parser:**
- Better regex to handle edge cases
- Validates message content (not just "HIGH" or "SEVERITY")
- Filters out empty or too-short messages

**✅ Advanced fallback parser:**
- Detects sections by severity headers
- Extracts from bullets, numbered lists, and narrative text
- Multiple file reference patterns:
  - `File: path/to/file.swift`
  - `` `path/to/file.swift` ``
  - `**path/to/file.swift**`
- Looks ahead for multiline content
- Handles markdown formatting

**✅ Logging and diagnostics:**
```javascript
console.log(`[PARSE] Structured format found ${findings.length} findings`);
console.log(`[PARSE] Fallback parser found ${findings.length} findings`);
console.warn('[PARSE] ⚠ Failed to parse any findings from response');
console.warn('[PARSE] Response preview:', text.substring(0, 500));
```

### 3. Reinforced File Prompts (`prompt-builder.js`)

**✅ Added explicit format requirements to EVERY prompt:**

**Single file prompt:**
```
## Output Requirements

Provide findings in this EXACT format (one finding per block):

FILE: ios/path/to/file.swift:line_number
SEVERITY: HIGH|MEDIUM|LOW
CATEGORY: Category Name
MESSAGE: Detailed description and fix suggestion.

Do NOT use code blocks, markdown headers, or narrative format.
```

**Batch prompt:**
```
## Output Requirements

For each issue found, use this EXACT format:

FILE: path/to/file.ext
SEVERITY: HIGH|MEDIUM|LOW
CATEGORY: Category Name
MESSAGE: Detailed description.

Separate findings with blank lines.
```

### 4. Added Debug Mode (`claude-handler.js`)

**✅ New DEBUG_REVIEWS flag:**
```bash
DEBUG_REVIEWS=true
```

Logs first 500 chars of each review response:
```javascript
if (process.env.DEBUG_REVIEWS === 'true') {
  console.log(`[DEBUG] Review ${i + 1} preview:`, review.substring(0, 500));
}
```

Shows per-review parsing results:
```javascript
console.log(`[CLAUDE] Review ${i + 1}: Parsed ${findings.length} findings`);
```

## Testing the Fix

### 1. Enable Debug Mode
```bash
echo "DEBUG_REVIEWS=true" >> server/.env
```

### 2. Run a Review
```bash
cd server && npm start
# Trigger a webhook or test manually
```

### 3. Check Logs

**Look for:**
```
[PARSE] Structured format found 5 findings    ← Success!
[PARSE] Review 1: Parsed 3 findings
[PARSE] Review 2: Parsed 2 findings
[CLAUDE] ✓ Total findings: 5
```

**If still broken, you'll see:**
```
[PARSE] No structured findings, attempting fallback parsing...
[PARSE] Fallback parser found 0 findings
[PARSE] ⚠ Failed to parse any findings from response
[DEBUG] Review 1 preview: <Claude's actual response>
```

### 4. Verify Output

The GitHub comment should now show:
- ✅ Actual file paths (not "Unknown")
- ✅ Real issue descriptions (not just "SEVERITY: HIGH")
- ✅ Actionable findings with context

## Expected Behavior

### Successful Parse
```markdown
🔴 HIGH - Security

File: `ios/Services/AuthService.swift:42`

Hardcoded API key detected in line 42. This exposes sensitive
credentials in version control. Move to secure configuration...
```

### Fallback Parse (if Claude uses narrative format)
```markdown
🔴 HIGH - Multiple files

In AuthService.swift, line 42: Hardcoded API key detected.
This should be moved to environment variables...
```

### No Issues
```markdown
✅ No Issues Found

The code looks good! No significant issues were identified.
```

## If Still Broken

### Debug Steps

1. **Check logs for parse results:**
   ```bash
   grep "\[PARSE\]" server.log
   ```

2. **See Claude's raw output:**
   ```bash
   grep "\[DEBUG\]" server.log | head -5
   ```

3. **Check if Claude followed format:**
   Look for patterns like:
   ```
   FILE: path/to/file
   SEVERITY: HIGH
   MESSAGE: ...
   ```

4. **Manual test the parser:**
   ```javascript
   const { parseFindings } = require('./shared/review-formatter');
   const text = `<paste Claude's response here>`;
   const findings = parseFindings(text);
   console.log(findings);
   ```

### Possible Issues

1. **Claude still ignoring format** → Model is resistant, may need different approach (JSON output)
2. **Pattern analysis prompt confusing Claude** → Try disabling pattern analysis temporarily
3. **Context too large** → Claude truncating response, losing structure
4. **Caching causing old prompt** → Clear pattern cache: `clearCache(true)`

## Alternative Solutions if Format Still Fails

### Option 1: Use JSON Output
Change prompt to request JSON:
```javascript
Output findings as a JSON array:
[
  {
    "file": "path/to/file.swift",
    "line": 42,
    "severity": "HIGH",
    "category": "Security",
    "message": "Description..."
  }
]
```

### Option 2: Use XML Tags
```xml
<finding>
  <file>path/to/file.swift</file>
  <severity>HIGH</severity>
  <message>Description...</message>
</finding>
```

### Option 3: Simplify to Markdown
Accept markdown and improve parser to handle it natively.

## Files Changed

```
server/claude/pattern-cache.js      - Strengthened format requirements
server/claude/prompt-builder.js     - Added format to every prompt
server/shared/review-formatter.js   - Enhanced fallback parser
server/claude-handler.js            - Added debug logging
server/.env.example                 - Added DEBUG_REVIEWS flag
```

## Summary

The parsing failure was due to **weak prompt instructions** that Claude interpreted as suggestions rather than requirements. The fix includes:

1. ✅ **Mandatory format language** in system prompt
2. ✅ **Multiple clear examples** showing correct output
3. ✅ **Explicit anti-patterns** (what NOT to do)
4. ✅ **Per-prompt reinforcement** in every review request
5. ✅ **Robust fallback parser** for narrative responses
6. ✅ **Debug visibility** to diagnose failures

**Test the next review** and check if findings now have proper file paths and messages.
