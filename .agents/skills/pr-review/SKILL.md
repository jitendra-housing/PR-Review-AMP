---
name: pr-review
description: Reviews GitHub pull requests by analyzing the diff with full code context and providing detailed inline comments with severity levels. Use when asked to review a PR, analyze pull request, or check code changes.
---

# PR Review Skill

Analyzes GitHub pull requests using git diff and provides structured code review feedback with inline comments.

## Capabilities

- Clones repository to .temp/ directory
- Checks out the actual feature branch
- Reads full files with complete code context (not just diffs)
- Analyzes imports and dependencies for deeper understanding
- Reviews like a senior developer with full codebase knowledge
- Provides severity-tagged feedback (HIGH/MEDIUM/LOW)
- Creates structured JSON output with file paths and line numbers
- Automatically cleans up temporary files
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

```bash
mkdir -p .temp
cd .temp
git clone https://github.com/OWNER/REPO.git
cd REPO
```

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

### 4. Get List of Changed Files

Generate list of files changed in this PR:
```bash
git diff --name-only BASE_SHA HEAD_SHA
```

Also get the diff for reference:
```bash
git diff BASE_SHA HEAD_SHA > pr_diff.txt
```

### 5. Review Files Like a Senior Developer

For EACH changed file, perform comprehensive analysis:

#### a. Read the Full File

Read the complete file from the feature branch (not just the diff):
```bash
# You're on the feature branch, so just read the file
cat path/to/changed/file.js
```

#### b. Understand the Context

- **Read imports/dependencies**: If the file imports other modules, read those files too
- **Read related files**: Check parent classes, interfaces, types, utility functions
- **Understand the architecture**: How does this file fit into the larger system?

Example:
```javascript
// If reviewing src/auth/login.js that imports:
import { validateUser } from '../utils/validator';
import { createToken } from './jwt';

// Also read:
// - src/utils/validator.js (to understand validation logic)
// - src/auth/jwt.js (to understand token creation)
```

#### c. Analyze the Changes Against Full Context

Compare what changed (from diff) with your understanding of:
- The complete file content
- Related files and dependencies
- The overall system architecture

#### d. Review Focus Areas

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

### 6. Generate Structured Review Output

After analyzing all files with full context, create a comprehensive review.

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

### 7. Format Human-Readable Review

Present findings like a senior developer would in a PR review:

```markdown
**🔴 HIGH - Hardcoded JWT secret exposes security risk**

**File:** src/auth/jwt.js:34

**Issue:** JWT secret is hardcoded as `'mysecret123'`. After reviewing the full file and understanding the token generation flow, this secret is used for signing all tokens, making them trivially forgeable.

**Context:** I reviewed:
- `src/auth/jwt.js` (full token generation logic)
- `config/index.js` (environment setup - dotenv already configured)
- `src/middleware/auth.js` (token verification flow)

**Suggestion:** Move to environment variable:
```javascript
const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('JWT_SECRET environment variable required');
```

Your `config/index.js` already has dotenv setup, so this integrates cleanly.

---
*Generated by Amp with full codebase context*
```

Severity indicators:
- 🔴 **HIGH** - Security vulnerabilities, data loss risks, critical bugs
- 🟡 **MEDIUM** - Performance issues, missing tests, code quality problems  
- 🟢 **LOW** - Code style, minor refactoring, documentation improvements

### 8. Cleanup

**ALWAYS cleanup the temporary directory**, even if errors occur:

```bash
cd ../..
rm -rf .temp
```

Use try-finally pattern to ensure cleanup:
```bash
trap 'cd ../..; rm -rf .temp' EXIT
```

## Output Format

Present the review in this structured format:

```markdown
# PR Review: [PR Title]

**Repository**: owner/repo
**PR**: #123 | [View PR](https://github.com/owner/repo/pull/123)
**Branch**: feature-branch → base-branch
**Files Changed**: X files with Y additions and Z deletions

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

**Recommendation**: ❌ Request changes (HIGH priority issues must be fixed)
```

## Best Practices

### Review Like a Senior Developer

This skill mimics how an experienced developer reviews code:

1. **Checkout the feature branch** - Work with the actual code, not just diffs
2. **Read complete files** - Understand the full context, not fragments
3. **Follow the imports** - Read dependencies to understand integration points
4. **Understand the system** - Know how pieces fit together
5. **Think about edge cases** - What could go wrong?
6. **Consider maintainability** - Will the next developer understand this?

### Analysis Workflow

**Step 1: Get oriented**
- Read the PR description (from GitHub API)
- Look at the diff to see what changed
- Identify the core files being modified

**Step 2: Deep dive on each file**
- Read the FULL file from the feature branch
- Understand what it does and why it exists
- Check imports - read those files too if they're relevant
- Look for patterns in how the file is structured

**Step 3: Cross-reference**
- If reviewing a database model, check the migration files
- If reviewing an API endpoint, check the tests
- If reviewing authentication, check where it's used
- If there are config changes, check environment setup

**Step 4: Think critically**
- What security issues could this introduce?
- Are there tests? Are they sufficient?
- Could this perform poorly at scale?
- Is this code maintainable?
- Does it follow the project's conventions?

**Step 5: Be constructive**
- Don't just point out problems - suggest solutions
- Reference existing patterns in the codebase
- Show you understand the context
- Prioritize issues appropriately

### Use the Oracle Tool

For complex reviews involving:
- Large architectural changes
- Multi-file refactorings
- Security-critical code
- Performance-sensitive paths

Consult the oracle for deeper analysis before providing feedback.

### Error Handling
1. **Always cleanup** - Remove .temp/ even if errors occur (use trap or try-finally)
2. **Handle edge cases** - Empty PRs, deleted files, binary files
3. **Validate data** - Check GitHub API responses before using them

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

### Scenario: Reviewing Authentication PR

**Changed files:**
- `src/auth/jwt.js` (new file)
- `src/middleware/auth.js` (modified)
- `src/routes/auth.js` (new file)
- `tests/auth.test.js` (new file)

**Review process:**

1. **Read src/auth/jwt.js completely**
   - See it creates/verifies JWT tokens
   - Notice hardcoded secret - 🔴 HIGH SECURITY ISSUE
   - Check imports: `jsonwebtoken` library

2. **Read config files to understand environment setup**
   - Read `config/index.js` - has dotenv, can use env vars
   - Suggest moving secret to `process.env.JWT_SECRET`

3. **Read src/middleware/auth.js**
   - See it uses jwt.verify from jwt.js
   - Notice no expiration check - 🔴 HIGH SECURITY ISSUE
   - Check error handling - missing for expired tokens

4. **Read src/routes/auth.js**
   - Review login/logout endpoints
   - Check if passwords are validated properly
   - Look for password logging - found it! 🟡 MEDIUM ISSUE

5. **Cross-reference with database layer**
   - Read `src/models/User.js` to see how users are fetched
   - Found SQL injection in login query - 🔴 HIGH SECURITY ISSUE
   - Read `database/connection.js` - supports parameterized queries

6. **Check test coverage**
   - Read `tests/auth.test.js`
   - Only tests happy path, no edge cases - 🟡 MEDIUM ISSUE
   - Read `tests/api.test.js` to see existing test patterns
   - Suggest following that pattern

**Result:** Comprehensive review with 3 HIGH and 2 MEDIUM issues, each with:
- Specific file/line references
- Context about what other files were reviewed
- Concrete suggestions based on existing codebase patterns
- Understanding of how the pieces fit together

This is how a senior developer reviews - with full context and system understanding.
