---
name: pr-review-lite
description: Lightweight PR review using only diff patches. No librarian, no RAG, no local clone. Cheapest option for cost-conscious reviews.
---

# PR Review Lite Skill

**COST-OPTIMIZED**: Reviews PRs with full file context via GitHub API. No librarian queries, no RAG, no local clone.

## When to Use

- High-volume repositories where cost matters
- Budget-conscious environments
- When you need good context without librarian/RAG costs

## What This Mode Does

- ✅ Fetches **full file content** via GitHub API (can see complete code)
- ✅ Analyzes parameter usage, logic flow, imports
- ❌ No librarian queries (no codebase pattern learning)
- ❌ No RAG (no cross-file dependency analysis)
- ❌ No local clone

## Limitations

- No codebase pattern learning (no librarian/RAG)
- Cannot learn project conventions automatically
- May miss cross-file dependency issues

## Usage

```
review PR https://github.com/owner/repo/pull/123
```

## Workflow

### 1. Parse PR URL

Extract from URL:
- Repository owner
- Repository name  
- PR number

### 2. Fetch PR Data via GitHub API

```bash
echo "🔍 LITE: Fetching PR data"
gh api repos/OWNER/REPO/pulls/PR_NUMBER > pr_data.json
```

Extract: title, body, base.ref, head.ref, user.login

### 3. Get Changed Files with Patches

```bash
echo "📥 LITE: Fetching diff patches"
gh api repos/OWNER/REPO/pulls/PR_NUMBER/files > changed_files.json
```

Each file includes:
- `filename` (file path)
- `status` (added/modified/deleted)
- `additions` / `deletions`
- `patch` (the diff - THIS IS ALL WE USE)

### 4. Classify Files (Same as other skills)

**AUTO-SKIP:**
- Package locks: `package-lock.json`, `yarn.lock`, `Podfile.lock`
- Generated: `*.generated.*`, `*.g.dart`, `*.pb.go`
- Vendored: `vendor/`, `node_modules/`, `Pods/`
- Binary: `.png`, `.jpg`, `.gif`, `.svg`, `.ttf`

**QUICK REVIEW:**
- Config: `.json`, `.yaml`, `.yml`, `.xml`
- Docs: `.md`, `.txt`

**STANDARD REVIEW (diff-only):**
- Source code: `.swift`, `.kt`, `.java`, `.ts`, `.js`, `.py`, `.go`
- Tests: `*test*`, `*spec*`

### 5. Fetch Full File Content and Review

**IMPORTANT: NO librarian, NO RAG - but DO fetch full files**

For DEEP review files, fetch the complete file via GitHub API:

```bash
# Fetch full file content for context
gh api repos/OWNER/REPO/contents/PATH/TO/FILE?ref=HEAD_SHA --jq '.content' | base64 -d > temp_file.txt
```

With full file context, analyze:

1. **Logic Issues:**
   - Parameters accepted but not used (like serviceType example)
   - Hardcoded values that should use parameters
   - Method signature vs implementation mismatch
   - Return value inconsistencies

2. **Code Quality:**
   - Unused parameters in methods
   - Dead code paths
   - Missing error handling
   - Force unwraps (`!`) without nil checks
   - Magic numbers without context

3. **Security:**
   - Hardcoded secrets/credentials
   - SQL string concatenation
   - Unsafe type casts
   - Missing input validation

4. **Best Practices:**
   - Empty catch blocks
   - Commented-out code
   - TODO/FIXME/HACK comments
   - Console.log/print in production

### 6. Create TODO Checklist

```json
[
  {"id": "f1", "content": "REVIEW: src/auth/login.ts", "status": "todo"},
  {"id": "f2", "content": "REVIEW: src/utils/helper.js", "status": "todo"},
  {"id": "post", "content": "Post review to GitHub PR", "status": "todo"}
]
```

### 7. Review Each File Sequentially

For each DEEP file:
1. Mark as in-progress
2. Fetch full file via GitHub API
3. Read the patch from changed_files.json to know what changed
4. Analyze the full file with focus on changed areas
5. Check parameter usage, logic flow, method implementations
6. Note issues with line numbers
7. Mark as completed

For QUICK files:
1. Mark as in-progress
2. Analyze patch only (no full file fetch)
3. Check for obvious issues
4. Mark as completed

### 8. Compile Review

Group findings by severity:
- **HIGH**: Security issues, hardcoded secrets
- **MEDIUM**: Code quality issues, missing error handling  
- **LOW**: Style issues, minor improvements

### 9. Format Review Comment

```markdown
# 🔍 PR Review (Lite Mode)

**Repository**: `owner/repo`
**PR**: [#123](https://github.com/owner/repo/pull/123)
**Author**: @username
**Review Mode**: Lite (diff-only, no codebase context)

---

## ⚠️ Review Limitations

This review uses **Lite Mode** (diff-only analysis):
- No codebase pattern learning
- No dependency/import analysis
- May miss context-dependent issues

For deeper analysis, disable `LITE_MODE` in server config.

---

## 📊 Summary

| Severity | Count |
|----------|-------|
| 🔴 HIGH | X |
| 🟡 MEDIUM | X |
| 🟢 LOW | X |

**Files Reviewed**: X  
**Files Skipped**: X (generated/binary)

---

## 🔴 High Severity

### `path/to/file.ts`

**Line 45** - Hardcoded API key detected
```diff
+ const API_KEY = "sk-1234567890abcdef"
```
**Fix**: Use environment variables

---

## 🟡 Medium Severity
...

## 🟢 Low Severity
...

---

## ✅ Overall Assessment

[Brief summary - 1-2 sentences]

**Score**: X/10

---

*Review generated in Lite Mode - consider full review for complex PRs*
```

### 10. Post to GitHub

```bash
echo "📤 LITE: Posting review"
cat > review_comment.md << 'EOF'
[Review content]
EOF

gh pr comment PR_NUMBER --repo OWNER/REPO --body-file review_comment.md

echo "✅ LITE: Review complete"
rm -f review_comment.md pr_data.json changed_files.json
```

### 11. Notify Server

```bash
curl -s -X POST http://localhost:3000/review-complete \
  -H "Content-Type: application/json" \
  -d "{\"pr_url\":\"${PR_URL}\",\"pr_number\":${PR_NUMBER},\"status\":\"complete\"}"
```

## Cost Comparison

| Mode | Tools Used | Context | Relative Cost |
|------|------------|---------|---------------|
| **Lite** | GitHub API + Full Files | Good (single file) | 💰💰 |
| RAG | GitHub API + Librarian | Best (cross-file) | 💰💰💰💰 |
| Local Clone | Git + File reads + Sub-agents | Best | 💰💰💰 |

## Best Practices

1. **Fetch full files for DEEP review** - Enables catching logic bugs like unused parameters
2. **Focus on single-file issues** - Cross-file dependencies need RAG mode
3. **Be honest about limitations** - Include disclaimer about no codebase pattern knowledge
4. **Recommend RAG mode** for complex PRs with many dependencies

## Error Handling

1. **API rate limits** - Handle gracefully
2. **Missing patches** - Some files may not have patches (binary)
3. **Large PRs** - Still classify and skip appropriately
