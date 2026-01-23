# Dependency-Aware Context Strategy

## Overview

The **Dependency-Aware** context strategy replaces semantic search with a simpler, more effective approach based on static code analysis. It provides better context at lower cost with dramatically less complexity.

## Why Dependency-Aware?

### Problems with Previous Approaches

**Semantic Search (CocoIndex)**:
- High complexity (Python service + PostgreSQL + pgvector)
- Expensive (10,228+ tokens per PR)
- Variable quality (0-4 results, often irrelevant)
- External dependencies
- Maintenance overhead

**Full Files Only**:
- Missing relationship context
- No awareness of dependent files
- Can miss breaking changes

### Benefits of Dependency-Aware

✅ **Lower Cost**: ~8,000 tokens/PR (vs 10,228 semantic search)
✅ **Higher Accuracy**: Real relationships, not fuzzy similarity
✅ **Zero Dependencies**: No external services required
✅ **Simple Maintenance**: ~300 lines of code
✅ **Actually Useful**: Imports/exports/tests matter more than semantic similarity

## Architecture

```
PR Changed Files
       ↓
Parse imports/exports (DependencyParser)
       ↓
Find dependent files (GitHub Code Search)
       ↓
Find related tests (pattern matching)
       ↓
Fetch full content for all files
       ↓
Build enriched context with relationships
       ↓
Claude API with Extended Thinking
       ↓
Post comprehensive review
```

**No databases. No embeddings. Just smart parsing.**

## Supported Languages

- **JavaScript/TypeScript**: `import`, `require`, `export`
- **Swift**: `import`, class/struct/protocol definitions
- **Python**: `import`, `from...import`
- **Kotlin/Java**: `import`, class/interface definitions

More languages can be added easily by extending the parser.

## How It Works

### 1. Parse Changed Files

When a PR is submitted, the system:
1. Fetches all changed files
2. Parses imports and exports from each file
3. Identifies what each file depends on and provides

Example:
```javascript
// ProfileService.js
import { API } from './api';
export class ProfileService { ... }
```

Parsed as:
- **Imports**: `['./api']`
- **Exports**: `['ProfileService']`

### 2. Find Dependent Files

For each changed file with exports, search the repository for files that import it:

```javascript
// Profile.js imports ProfileService
import { ProfileService } from '../services/ProfileService';
```

This file is identified as a **dependent** and included in the review context.

### 3. Find Related Tests

Search for test files using common patterns:
- `ProfileService.test.js`
- `ProfileService.spec.js`
- `ProfileServiceTest.swift`
- Files in `__tests__/` directory

These are identified as **test** files and included in context.

### 4. Build Context

The final context includes:
- **Changed files** (full content + diff)
- **Dependent files** (excerpt, max 1000 chars each)
- **Test files** (excerpt, max 1000 chars each)
- **Relationship metadata** (what imports what)

### 5. Extended Thinking

Claude reviews with extended thinking enabled:
- Deeper analysis of architectural implications
- Better understanding of breaking changes
- More thorough security analysis
- Catches subtle bugs requiring multi-step reasoning

## Configuration

### Environment Variables

Add to `.env`:

```bash
# Context Strategy (RECOMMENDED)
CONTEXT_STRATEGY=DEPENDENCY_AWARE

# Fallback if dependency analysis fails
FALLBACK_STRATEGY=FULL_FILES

# Dependency Analysis Settings
MAX_DEPENDENT_FILES=5        # Max files that import changed files
MAX_TEST_FILES=3            # Max test files to include
INCLUDE_DEPENDENCY_CONTEXT=true

# Extended Thinking (Claude Sonnet/Opus 4.5 only)
ENABLE_EXTENDED_THINKING=true
THINKING_TOKEN_BUDGET=10000
```

### Configuration Tuning

**For large repositories** (adjust limits to control token usage):
```bash
MAX_DEPENDENT_FILES=3
MAX_TEST_FILES=2
MAX_CONTENT_CHARS=40000
```

**For small repositories** (include more context):
```bash
MAX_DEPENDENT_FILES=10
MAX_TEST_FILES=5
MAX_CONTENT_CHARS=60000
```

**Disable dependency context** (fall back to full files only):
```bash
INCLUDE_DEPENDENCY_CONTEXT=false
```

## Token Economics

### Before (SEMANTIC_SEARCH)
- Patches: 980 tokens
- Full files: 7,231 tokens
- Semantic snippets: 10,228 tokens
- **Total: ~18,439 tokens**

### After (DEPENDENCY_AWARE)
- Patches: 980 tokens
- Full files: 7,231 tokens
- Related files (5 × 250 chars): ~500 tokens
- **Total: ~8,711 tokens**

**Savings: ~53% reduction in token usage**

## Testing

### Run Unit Tests

```bash
cd server
node shared/dependency-parser.test.js
```

### Run Integration Tests

```bash
cd server
node test-dependency-aware.js
```

### Test with Real PR

1. Start server:
   ```bash
   npm start
   ```

2. Trigger webhook for a test PR

3. Check logs:
   ```
   [CONTEXT] Using DEPENDENCY_AWARE - analyzing relationships for X files
   [CONTEXT] Found Y related files through dependency analysis
   [CLAUDE] Extended thinking enabled (10K token budget)
   [CLAUDE] Thinking tokens used: Z
   ```

4. Verify review:
   - Mentions dependent files
   - Suggests test updates if needed
   - Identifies potential breaking changes
   - References related code

## Implementation Details

### Core Files

**New Files:**
- `server/shared/dependency-parser.js` - Parse imports/exports
- `server/shared/dependency-parser.test.js` - Unit tests
- `server/test-dependency-aware.js` - Integration tests

**Modified Files:**
- `server/shared/context-fetcher.js` - Added DEPENDENCY_AWARE strategy
- `server/claude/api-client.js` - Added extended thinking support
- `server/claude/prompt-builder.js` - Format dependency context
- `server/.env` - Updated configuration

### Key Classes

**DependencyParser**
```javascript
class DependencyParser {
  parseFile(filename, content)      // Extract imports/exports
  findDependents(file, allFiles)    // Find files that import this file
  findRelatedTests(file, allFiles)  // Find test files
  detectLanguage(filename)           // Identify programming language
}
```

**ContextFetcher (Enhanced)**
```javascript
class ContextFetcher {
  async fetchDependencyAwareContext(files, prInfo)
  async findDependentFiles(filename, exports, prInfo)
  async findTestFiles(filename, prInfo)
}
```

## Troubleshooting

### No Dependent Files Found

**Possible causes:**
- Files use absolute imports (e.g., `@/services/...`)
- Monorepo with complex import paths
- GitHub Code Search rate limits

**Solutions:**
1. Check parser regex patterns
2. Add custom import resolution logic
3. Increase search timeout
4. Consider caching results

### GitHub API Rate Limits

If you hit rate limits:
1. Reduce `MAX_DEPENDENT_FILES` and `MAX_TEST_FILES`
2. Add caching for repository structure
3. Use authenticated requests (already configured)

### Extended Thinking Not Working

**Check:**
1. Model is Sonnet 4.5 or Opus 4.5 (Haiku doesn't support thinking)
2. `ENABLE_EXTENDED_THINKING=true` in `.env`
3. No API errors in logs

**To verify:**
Look for this in logs:
```
[CLAUDE] Extended thinking enabled (10000 token budget)
[CLAUDE] Thinking tokens used: 1234
```

### Token Usage Too High

**Reduce token usage:**
1. Lower `MAX_DEPENDENT_FILES` and `MAX_TEST_FILES`
2. Reduce `MAX_CONTENT_CHARS`
3. Disable `INCLUDE_DEPENDENCY_CONTEXT=false`
4. Use `CONTEXT_STRATEGY=FULL_FILES` instead

## Migration Guide

### From SEMANTIC_SEARCH (CocoIndex)

1. Update `.env`:
   ```bash
   # Change from:
   CONTEXT_STRATEGY=SEMANTIC_SEARCH

   # To:
   CONTEXT_STRATEGY=DEPENDENCY_AWARE
   ```

2. Remove CocoIndex configuration:
   ```bash
   # Remove these lines:
   ENABLE_SEMANTIC_SEARCH=...
   COCOINDEX_SERVICE_URL=...
   SEMANTIC_SEARCH_LIMIT=...
   SEMANTIC_SEARCH_THRESHOLD=...
   REPO_PATH_MAPPING=...
   ```

3. Add new configuration:
   ```bash
   MAX_DEPENDENT_FILES=5
   MAX_TEST_FILES=3
   ENABLE_EXTENDED_THINKING=true
   THINKING_TOKEN_BUDGET=10000
   ```

4. Restart server

5. No need to run Python service or maintain database

### From FULL_FILES

1. Update `.env`:
   ```bash
   # Change from:
   CONTEXT_STRATEGY=FULL_FILES

   # To:
   CONTEXT_STRATEGY=DEPENDENCY_AWARE
   ```

2. Add new configuration (see above)

3. Restart server

4. Reviews will now include relationship context

## Success Metrics

### Quality Indicators

✅ Reviews mention dependent files
✅ Breaking changes are identified
✅ Test updates are suggested
✅ Cross-file implications noted

### Performance Targets

✅ < 10 seconds to analyze dependencies
✅ Token usage < 10K per PR
✅ 90%+ success rate finding related files
✅ Zero external service dependencies

## Future Enhancements

**Potential improvements (not in current scope):**
1. **Call Graph Analysis** - Track function calls across files
2. **Type Reference Tracking** - Follow interface/protocol usage
3. **Git History Analysis** - Files frequently changed together
4. **Dependency Caching** - Cache graphs per commit
5. **Tree-sitter Integration** - Precise AST-based parsing

**Start simple. Get results. Iterate based on feedback.**

## Support

### Run Tests

```bash
# Unit tests
node server/shared/dependency-parser.test.js

# Integration tests
node server/test-dependency-aware.js
```

### Debug Mode

Enable detailed logging:
```bash
DEBUG_REVIEWS=true
```

Check logs for:
- `[CONTEXT]` - Context fetching details
- `[CLAUDE]` - API calls and thinking usage
- `[PARSER]` - Dependency analysis

### Common Issues

**Issue**: Parsing fails for certain files
**Fix**: Check language support, add new patterns to parser

**Issue**: Too many/few related files
**Fix**: Adjust `MAX_DEPENDENT_FILES` and `MAX_TEST_FILES`

**Issue**: Search timeouts
**Fix**: Increase timeout in `findDependentFiles` method

## Comparison to Alternatives

| Feature | DEPENDENCY_AWARE | SEMANTIC_SEARCH | FULL_FILES | DIFF_ONLY |
|---------|-----------------|-----------------|------------|-----------|
| **Token Cost** | ~8.7K | ~18.4K | ~8.2K | ~1K |
| **Context Quality** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| **External Services** | None | Python + DB | None | None |
| **Maintenance** | Low | High | Low | Low |
| **Relationship Aware** | Yes | Fuzzy | No | No |
| **Setup Complexity** | Minimal | High | Minimal | Minimal |

## Conclusion

The dependency-aware strategy provides:
- **Better context** through real code relationships
- **Lower cost** with ~53% fewer tokens
- **Zero complexity** - no external services
- **Easy maintenance** - simple, testable code

This is the recommended strategy for production use.
