---
name: pr-review
description: Reviews GitHub pull requests by analyzing the diff with full code context and providing detailed inline comments with severity levels. Use when asked to review a PR, analyze pull request, or check code changes.
---

# PR Review Skill

Analyzes GitHub pull requests using git diff and provides structured code review feedback with inline comments.

## Capabilities

- Uses repository in .temp/ directory (clones only if not exists)
- Checks out the actual feature branch
- Reads full files with complete code context (not just diffs)
- Analyzes imports and dependencies for deeper understanding
- Reviews like a senior developer with full codebase knowledge
- Provides severity-tagged feedback (HIGH/MEDIUM/LOW)
- Creates structured JSON output with file paths and line numbers
- Preserves .temp/ directory for reuse across reviews
- Generates comprehensive review summary

## Usage

```
review PR https://github.com/owner/repo/pull/123
```

Or:

```
review this PR: https://github.com/owner/repo/pull/123
```

## Workflow

### 1. Parse PR URL

Extract from URL (e.g., `https://github.com/owner/repo/pull/123`):
- Repository owner
- Repository name  
- PR number

### 2. Setup Temporary Directory

**Check if repository already exists to avoid re-cloning:**

```bash
# Only clone if repo doesn't exist
if [ ! -d ".temp/REPO/.git" ]; then
  mkdir -p .temp
  cd .temp
  # User will clone manually - DO NOT clone automatically
  echo "Repository not found. Please clone manually."
else
  echo "Repository already exists, using existing clone"
fi
cd .temp/REPO
```

**IMPORTANT:** Never remove .temp/ or the repository directory unless explicitly asked by the user.

### 3. Fetch PR Data and Checkout Feature Branch

Use GitHub API to get PR details:
```bash
gh api repos/OWNER/REPO/pulls/PR_NUMBER
```

Extract:
- `base.sha` (base commit)
- `head.sha` (head commit)
- `base.ref` (target branch, e.g., main)
- `head.ref` (feature branch)

Fetch and checkout the PR branch:
```bash
git fetch origin pull/PR_NUMBER/head:pr-PR_NUMBER
git checkout pr-PR_NUMBER
```

**IMPORTANT:** You are now on the feature branch with the full codebase context.

### 4. Get List of Changed Files and Create Checklist

Generate numbered list of all files changed in this PR:
```bash
git diff --name-only BASE_SHA HEAD_SHA | cat -n
```

**CRITICAL: Create a TODO checklist with ALL files before starting review:**

Use `todo_write` to create a checklist item for EVERY file PLUS the GitHub posting step:
```json
[
  {"id": "f1", "content": "Review: path/to/file1.swift", "status": "todo"},
  {"id": "f2", "content": "Review: path/to/file2.swift", "status": "todo"},
  {"id": "f3", "content": "Review: path/to/file3.xib", "status": "todo"},
  ...,
  {"id": "post", "content": "Post review to GitHub PR", "status": "todo"}
]
```

Also generate the diff for reference:
```bash
git diff BASE_SHA HEAD_SHA > pr_diff.txt
```

### 5. Review EVERY File Using Sub-Agents

**DO NOT SKIP ANY FILES.** Use parallel sub-agents for efficient review:

**Step 1: Group files into batches**

Group files by category for parallel processing:
- Swift/Kotlin/Java source files (batch size: 5-10 files)
- UI files (.xib, .storyboard, .xml)
- Resource files (strings, images, JSON)
- Generated files (quick verification only)
- Configuration files

**Step 2: Launch sub-agents in parallel**

For each batch, launch a Task sub-agent with:
- List of files to review
- Repository path
- Base and head commit SHAs
- Instructions on what to check

**Example:**
```
Task 1: Review Swift files f1-f10
Task 2: Review Swift files f11-f20
Task 3: Review UI and resource files f21-f30
Task 4: Review ViewModels f31-f38
```

**Step 3: Each sub-agent must:**

a. **Mark each file as in-progress** before reviewing:
   ```bash
   todo_write # update file status to "in-progress"
   ```

b. **Read the complete file** from the feature branch:
   ```bash
   Read tool with full file path
   ```

c. **Get the diff** to see what changed:
   ```bash
   git diff BASE_SHA HEAD_SHA -- path/to/file
   ```

d. **Analyze based on file type:**

**Swift/Kotlin/Java Files (.swift, .kt, .java):**
   - Read entire file with full context
   - Check for:
     - Thread safety (async operations, shared state)
     - Memory leaks (retain cycles, weak references)
     - Force unwraps and optional handling
     - Error handling completeness
     - API usage patterns
     - Delegate patterns and memory management
   - Read imported files for context
   - Check if changes follow existing patterns

**UI Files (.xib, .storyboard, .xml):**
   - Check for constraint conflicts
   - Verify outlet connections are valid
   - Check for accessibility labels
   - Ensure UI elements have proper identifiers
   - Look for hardcoded sizes vs adaptive layouts

**View Files (.swift for UIView subclasses, .jsx, .vue):**
   - Check delegate/callback patterns
   - Verify proper initialization
   - Check for UI updates on main thread
   - Look for accessibility support
   - Verify proper cleanup in deinit/componentWillUnmount

**ViewModel/Presenter Files:**
   - Check business logic correctness
   - Verify error handling
   - Check for proper separation of concerns
   - Look for testability issues
   - Verify Observable/binding patterns

**Model/Entity Files (.swift, .kt, .ts):**
   - Check Codable/Serializable implementation
   - Verify field types and optionality
   - Check for data validation
   - Look for migration impacts

**Generated Files:**
   - Quick scan to ensure generation is correct
   - Don't deep review auto-generated code
   - Flag if manual changes were made to generated files

**Resource Files (.json, .strings, .xml):**
   - Check for syntax errors
   - Verify no duplicate keys
   - Check for missing translations
   - Ensure proper formatting

**Configuration Files (project.pbxproj, build.gradle):**
   - Check for unintended changes
   - Verify new files are properly added
   - Check for dependency version changes
   - Flag any unusual modifications

e. **Mark file as completed** after review:
   ```bash
   todo_write # update file status to "completed"
   ```

f. **Return findings** to main agent with:
   - File path
   - Line numbers of issues
   - Severity (HIGH/MEDIUM/LOW)
   - Issue description
   - Suggested fix
   - Context (what other files were read)

**Step 4: Main agent coordinates**

The main agent:
1. Launches multiple Task sub-agents in parallel (group files into 4-6 batches)
2. Monitors progress via todo_read
3. Collects findings from all sub-agents
4. Compiles comprehensive review
5. Posts to GitHub

**Important:** Each sub-agent operates independently and updates the shared TODO checklist in real-time.

#### Review Focus Areas for Code Files

**Security (Critical Priority):**
- SQL injection, XSS, CSRF vulnerabilities
- Authentication/authorization bypasses
- Exposed secrets, API keys, tokens
- Insecure cryptography or password handling
- Input validation issues

**Test Coverage:**
- Are there tests for new functionality?
- Edge cases covered?
- Error scenarios tested?
- Integration tests for cross-module changes?

**Performance:**
- Database queries (N+1 problems, missing indexes)
- Algorithmic complexity (O(n²) where O(n) possible)
- Memory leaks or excessive allocations
- Unnecessary re-renders or re-computations
- Missing caching opportunities

**Code Quality:**
- Function/method complexity (too many responsibilities?)
- Code duplication
- Unclear naming conventions
- Missing error handling
- Poor separation of concerns

**Architecture & Design:**
- Does it follow existing patterns?
- Proper abstraction levels
- SOLID principles violations
- Breaking changes to APIs
- Backwards compatibility issues

**Language/Framework Best Practices:**
- Using deprecated APIs
- Not following framework conventions
- Missing TypeScript types (if applicable)
- Improper async/await usage
- Resource cleanup (closing connections, files, etc.)

### 6. Verify All Files Reviewed

Before generating output, **verify checklist is 100% complete**:
```bash
todo_read # Check all files are marked "completed"
```

If any files are still "todo" or "in-progress", **continue reviewing them**.

### 7. Generate Structured Review Output

After analyzing **ALL files** with full context, create a comprehensive review.

Output format (structured JSON for programmatic use):

```json
{
  "tool": "amp",
  "version": "0.1",
  "summary": "This PR implements JWT authentication. Code quality is good overall, but critical security issues must be addressed before merge.",
  "issues": [
    {
      "id": 1,
      "severity": "HIGH",
      "title": "Hardcoded JWT secret exposes security risk",
      "file": "src/auth/jwt.js",
      "line": 34,
      "description": "JWT secret is hardcoded as 'mysecret123'. After reviewing the full file and understanding the token generation flow, this secret is used for signing all tokens, making them trivially forgeable.",
      "suggestion": "Move to environment variable: const secret = process.env.JWT_SECRET || throw new Error('JWT_SECRET required'). Also reviewed config/index.js and it already has dotenv setup, so this integrates cleanly.",
      "context": "Reviewed: src/auth/jwt.js (full file), config/index.js (environment setup), src/middleware/auth.js (token verification)"
    },
    {
      "id": 2,
      "severity": "HIGH",
      "title": "Missing SQL parameterization allows injection",
      "file": "src/models/User.js",
      "line": 67,
      "description": "User login query directly interpolates email: `SELECT * FROM users WHERE email='${email}'`. After reading the full User model and database/connection.js, I see you're using raw SQL. This allows SQL injection.",
      "suggestion": "Use parameterized queries: `db.query('SELECT * FROM users WHERE email=$1', [email])`. I reviewed database/connection.js and it supports prepared statements via the pg library.",
      "context": "Reviewed: src/models/User.js (full model), database/connection.js (db setup), similar pattern in src/models/Post.js"
    },
    {
      "id": 3,
      "severity": "MEDIUM",
      "title": "Missing tests for authentication flow",
      "file": "tests/auth.test.js",
      "line": 0,
      "description": "The new authentication endpoints in src/routes/auth.js have no test coverage. After reviewing the test suite structure in tests/, I see you have Jest setup and example API tests in tests/api.test.js.",
      "suggestion": "Add integration tests covering: successful login, invalid credentials, expired tokens, missing headers. Reference tests/api.test.js for the testing pattern already in use.",
      "context": "Reviewed: tests/auth.test.js (empty), tests/api.test.js (existing patterns), src/routes/auth.js (endpoints needing tests)"
    }
  ]
}
```

**Critical requirements:**
- Use file paths from your file reads (you're on the feature branch)
- Use line numbers from the actual files you read
- Severity: `HIGH` (security, data loss), `MEDIUM` (quality, performance), `LOW` (style, minor)
- **Include context**: Show what other files you read to reach your conclusion
- **Be specific**: Reference exact function names, variable names, patterns you saw
- If no issues: `{"tool":"amp","version":"0.1","issues":[]}`

## File Review Summary

Include a summary of all files reviewed:

```markdown
## Files Reviewed: 30/30 ✅

**Swift Files (13):** All reviewed
**UI Files (7):** All reviewed  
**Resource Files (8):** All reviewed
**Configuration (2):** All reviewed
```

### 8. Format Human-Readable Review

Present findings concisely and directly:

**Issue Format:**
```markdown
**🔴 HIGH - Hardcoded JWT secret exposes security risk**

**File:** src/auth/jwt.js:34

**Issue:** JWT secret is hardcoded as `'mysecret123'`. After reviewing the full file and understanding the token generation flow, this secret is used for signing all tokens, making them trivially forgeable.

**Context:** Reviewed: src/auth/jwt.js (full file), config/index.js (environment setup), src/middleware/auth.js (token verification)

**Fix:** Move to environment variable:
```javascript
const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('JWT_SECRET environment variable required');
```

---
```

Severity indicators:
- 🔴 **HIGH** - Security vulnerabilities, data loss risks, critical bugs
- 🟡 **MEDIUM** - Performance issues, missing tests, code quality problems  
- 🟢 **LOW** - Code style, minor refactoring, documentation improvements

**DO NOT INCLUDE:**
- ❌ "Positive Observations" section
- ❌ "Code Quality Analysis" section
- ❌ "Testing Recommendations" section
- ❌ "iOS Compatibility" in Overall Assessment
- ❌ "Recommendation" in Overall Assessment

**MUST INCLUDE:**
- ✅ Issues Found (with severity levels)
- ✅ Overall Assessment with Score out of 10

### 9. Post Review to GitHub (Optional)

After generating the review, you can post it directly to the PR as a comment:

**Save review to file:**
```bash
cat > review_comment.md << 'EOF'
[Your formatted review content here]
EOF
```

**Post to PR:**
```bash
gh pr comment PR_NUMBER --body-file review_comment.md
```

Or post with inline command:
```bash
gh pr comment PR_NUMBER --body "$(cat review_comment.md)"
```

**Example:**
```bash
# For PR #18617
gh pr comment 18617 --body-file review_comment.md
```

**Note:** Ensure you have GitHub CLI authenticated and proper permissions to comment on the PR.

### 10. Cleanup

**Only cleanup review file, preserve repository:**

```bash
rm -f review_comment.md  # Cleanup review file only
```

**IMPORTANT:** 
- DO NOT remove .temp/ directory
- DO NOT remove repository directory
- Only cleanup temporary review files (review_comment.md)
- Repository is preserved for reuse across multiple PR reviews
- Only remove .temp/ if user explicitly requests it

## Output Format

Present the review in this structured format (GitHub-compatible markdown):

```markdown
# 🔍 PR Review: [PR Title]

**Repository**: `owner/repo`  
**PR**: [#123](https://github.com/owner/repo/pull/123)  
**Branch**: `feature-branch` → `base-branch`  
**Files Changed**: X files with Y additions and Z deletions  
**Reviewed by**: Amp Code Review Bot

---

## Summary

[1-2 paragraph high-level overview of what the PR does and overall code quality]

---

## Issues Found: [count]

### 🔴 HIGH Priority (X)

**src/auth/login.js:45** - SQL injection vulnerability
- **Issue**: User credentials are interpolated directly into SQL query
- **Impact**: Attackers can bypass authentication with SQL injection
- **Fix**: Use parameterized queries or ORM methods

**src/api/users.js:128** - Exposed API key in client code
- **Issue**: API key hardcoded and exposed to client
- **Impact**: Security breach, unauthorized API access
- **Fix**: Move API key to environment variables on server side

### 🟡 MEDIUM Priority (Y)

**src/utils/parser.js:67** - Missing error handling
- **Issue**: JSON.parse() called without try-catch
- **Impact**: Application crashes on invalid input
- **Fix**: Wrap in try-catch and return appropriate error

**tests/api.test.js:0** - No tests for new endpoint
- **Issue**: New POST /api/users endpoint has no test coverage
- **Impact**: Regressions may go undetected
- **Fix**: Add integration tests covering success and error cases

### 🟢 LOW Priority (Z)

**src/components/Button.jsx:23** - Inconsistent naming
- **Issue**: Variable name `btn_txt` doesn't follow camelCase convention
- **Impact**: Code style inconsistency
- **Fix**: Rename to `buttonText`

---

## Overall Assessment

**Code Quality**: [Good/Needs Improvement/Poor]
**Security**: [Secure/Has Vulnerabilities]  
**Test Coverage**: [Adequate/Insufficient/Missing]
**Performance**: [No Issues/Has Concerns]

**Score**: [X/10]

---

**Notes:**
- Score 8-10: Excellent code, minor or no issues
- Score 6-7: Good code with some improvements needed
- Score 4-5: Needs significant improvements
- Score 1-3: Major issues, requires rework
```

## Best Practices

### Review Like a Senior Developer

This skill mimics how an experienced developer reviews code:

1. **Create a checklist FIRST** - Use todo_write to track ALL files
2. **Review EVERY file** - No exceptions, no shortcuts
3. **Checkout the feature branch** - Work with the actual code, not just diffs
4. **Read complete files** - Understand the full context, not fragments
5. **Follow the imports** - Read dependencies to understand integration points
6. **Mark progress** - Update todo as you complete each file
7. **Verify completion** - Check todo_read before finalizing review
8. **Think about edge cases** - What could go wrong?
9. **Consider maintainability** - Will the next developer understand this?

### Analysis Workflow (Using Sub-Agents)

**Step 1: Setup checklist**
- Get list of ALL changed files with `git diff --name-only`
- Create todo_write checklist with EVERY file
- Number them sequentially (f1, f2, f3...)
- **ALWAYS add final TODO: Post review to GitHub PR**
- All start with status "todo"

**Step 2: Get oriented**
- Read the PR description (from GitHub API)
- Look at the diff to see what changed
- Identify the core files and their relationships
- Group files into logical batches (4-6 batches for parallel processing)

**Step 3: Launch parallel sub-agents**

Create 4-6 Task sub-agents, each responsible for a batch of files:

**Batch 1 (Task 1):** Source files 1-10
```
Task: Review files f1-f10 for PR #XXXXX

Files to review:
- path/to/file1.swift (f1)
- path/to/file2.swift (f2)
...

For EACH file:
1. Update todo: mark file as "in-progress"
2. Read full file from /path/to/repo
3. Get diff: git diff BASE_SHA HEAD_SHA -- filepath
4. Analyze for: force unwraps, memory leaks, threading, error handling
5. Update todo: mark file as "completed"
6. Return findings with file, line, severity, description, fix

Base SHA: xxxxx
Head SHA: yyyyy
Repo path: /Users/.../housing-app
```

**Batch 2-6:** Similar tasks for remaining files

**Step 4: Monitor progress in real-time**
- Each sub-agent updates the shared TODO checklist
- Use todo_read periodically to check progress
- Watch for completion of all file reviews

**Step 5: Collect findings from all sub-agents**
- Aggregate all issues from sub-agent responses
- Deduplicate similar issues
- Organize by severity (HIGH/MEDIUM/LOW)

**Step 6: Verify completion**
- Run todo_read to ensure all files marked "completed"
- If any files remain "todo" or "in-progress", investigate

**Step 7: Generate comprehensive review**
- Compile all findings from sub-agents
- Add overall assessment
- Calculate score
- Format for GitHub

**Step 8: Post review to GitHub (MANDATORY)**
- Mark "Post review to GitHub PR" as in-progress
- Save formatted review to `review_comment.md`
- Use `gh pr comment PR_NUMBER --repo OWNER/REPO --body-file review_comment.md`
- Verify comment posted successfully
- Clean up review file
- Mark "Post review to GitHub PR" as completed

### Use the Oracle Tool

For complex reviews involving:
- Large architectural changes
- Multi-file refactorings
- Security-critical code
- Performance-sensitive paths

Consult the oracle for deeper analysis before providing feedback.

### Error Handling
1. **Repository preservation** - Never remove .temp/ or repository (preserved for reuse)
2. **Handle edge cases** - Empty PRs, deleted files, binary files
3. **Validate data** - Check GitHub API responses before using them
4. **Sub-agent failures** - If a sub-agent fails, main agent should review those files directly

## GitHub CLI Setup

The skill uses GitHub CLI (`gh`) for API access. Ensure it's installed and authenticated:

```bash
# Install GitHub CLI (if not installed)
brew install gh  # macOS
# or: apt install gh  # Linux
# or: winget install GitHub.cli  # Windows

# Authenticate
gh auth login
```

For automated environments, set a token:

```bash
export GITHUB_TOKEN="ghp_your_token_here"
```

## Example Review Process

### Scenario: Reviewing PR #456 - Authentication Implementation (40 files)

**Step 1: Create checklist**
```
todo_write:
- f1-f40: Review 40 files
- post: Post review to GitHub PR (status: todo)
```

**Step 2: Group into batches**
- Batch 1: f1-f10 (auth core files)
- Batch 2: f11-f20 (middleware files)
- Batch 3: f21-f30 (route handlers)
- Batch 4: f31-f40 (tests + config)

**Step 3: Launch 4 parallel sub-agents**

**Task 1 (Batch 1):**
```
Review files f1-f10 for PR #456

Files:
- src/auth/jwt.js (f1)
- src/auth/tokens.js (f2)
... (8 more files)

For each file:
1. Mark as in-progress
2. Read full file
3. Get diff
4. Analyze for security, errors, patterns
5. Mark as completed
6. Return issues found

Repo: /path/to/repo
Base SHA: abc123
Head SHA: def456
```

**Task 2-4:** Similar for other batches

**Step 4: Monitor real-time progress**
```bash
# User sees checklist updating live:
✅ f1 completed
✅ f2 completed
⏳ f3 in-progress
...
```

**Step 5: Collect findings**

Sub-agent 1 returns:
- f1: HIGH - Hardcoded JWT secret at line 34
- f2: MEDIUM - Missing token expiration check

Sub-agent 2 returns:
- f15: HIGH - SQL injection vulnerability at line 67
- f18: LOW - Inconsistent naming

(Continue for all sub-agents)

**Step 6: Generate comprehensive review**

Main agent compiles all findings, deduplicates, formats for GitHub

**Step 7: Post to GitHub**
```bash
# Mark as in-progress
todo_write: mark "post" as "in-progress"

# Save review to file
cat > review_comment.md << 'EOF'
# 🔍 PR Review: Add Authentication

**Repository**: `owner/repo`
**PR**: [#456](https://github.com/owner/repo/pull/456)
...
[Full review content]
EOF

# Post comment
gh pr comment 456 --repo owner/repo --body-file review_comment.md

# Success message
echo "✅ Review posted to PR #456"

# Only cleanup review file, NOT the repo
rm -f review_comment.md
todo_write: mark "post" as "completed"
```

**Note:** Repository in .temp/ is preserved for future reviews. Never delete unless user explicitly requests.

This is how a senior developer reviews - with full context and system understanding.
