# PR Review Skill - Usage Guide

This guide shows you how to use the PR review skill to analyze GitHub pull requests.

## Prerequisites

1. **GitHub CLI installed and authenticated**
   ```bash
   # Install (choose your platform)
   brew install gh                # macOS
   sudo apt install gh            # Linux
   winget install GitHub.cli      # Windows
   
   # Authenticate
   gh auth login
   ```

2. **Skill is loaded**
   
   The skill should be automatically discovered from `.agents/skills/pr-review/`

## Basic Usage

### Review a Pull Request

Simply provide the PR URL to Amp:

```
review PR https://github.com/owner/repo/pull/123
```

Or use natural language:

```
review this PR: https://github.com/owner/repo/pull/456
```

```
can you analyze https://github.com/myorg/myrepo/pull/789
```

## What Happens During Review

1. **Extracts PR information** from the URL (owner, repo, PR number)
2. **Clones repository** to `.temp/` directory
3. **Fetches PR data** using GitHub API (base SHA, head SHA)
4. **Generates unified diff** between base and head commits
5. **Analyzes code changes** with full file context
6. **Identifies issues** across security, performance, tests, code quality
7. **Generates structured output** with severity levels and line numbers
8. **Formats review** with actionable feedback
9. **Cleans up** temporary directory

## Review Output

You'll receive a structured review like this:

```markdown
# PR Review: Add user authentication

**Repository**: myorg/myapp
**PR**: #123 | View PR
**Branch**: feature/auth → main
**Files Changed**: 5 files with 234 additions and 12 deletions

---

## Summary

This PR implements JWT-based authentication for the API. The implementation 
includes login/logout endpoints and middleware for protected routes. Overall 
code quality is good, but there are security concerns that must be addressed.

---

## Issues Found: 4

### 🔴 HIGH Priority (2)

**src/auth/jwt.js:34** - Hardcoded JWT secret
- **Issue**: JWT secret is hardcoded as "mysecret123"
- **Impact**: Security breach, tokens can be forged
- **Fix**: Move to environment variable (process.env.JWT_SECRET)

**src/middleware/auth.js:67** - No token expiration check
- **Issue**: Expired tokens are accepted as valid
- **Impact**: Revoked sessions remain active
- **Fix**: Add expiration validation in token verification

### 🟡 MEDIUM Priority (2)

**tests/auth.test.js:0** - Missing tests for edge cases
- **Issue**: No tests for invalid tokens, expired tokens, or missing headers
- **Impact**: Edge cases may break in production
- **Fix**: Add test cases for error scenarios

**src/controllers/auth.js:89** - Password stored in plain text in logs
- **Issue**: User password logged on failed login attempts
- **Impact**: Sensitive data exposure in log files
- **Fix**: Log only username, not password

---

## Overall Assessment

**Code Quality**: Needs Improvement
**Security**: Has Vulnerabilities (2 HIGH priority)
**Test Coverage**: Insufficient
**Performance**: No Issues

**Recommendation**: ❌ Request changes (HIGH priority issues must be fixed)
```

## Severity Levels Explained

- **🔴 HIGH** - Critical issues that MUST be fixed before merge
  - Security vulnerabilities (SQL injection, XSS, exposed secrets)
  - Data loss or corruption risks
  - Authentication/authorization bypasses
  
- **🟡 MEDIUM** - Important issues that SHOULD be fixed
  - Missing error handling
  - Performance problems
  - Insufficient test coverage
  - Code quality concerns
  
- **🟢 LOW** - Minor improvements and suggestions
  - Code style inconsistencies
  - Minor refactoring opportunities
  - Documentation improvements

## Tips for Better Reviews

### 1. Review Specific File Types

If you only want to review certain aspects:

```
review security issues in PR https://github.com/owner/repo/pull/123
```

```
check test coverage in PR https://github.com/owner/repo/pull/123
```

### 2. Re-review After Changes

After addressing issues, you can review again:

```
review PR 123 again and check if security issues are fixed
```

### 3. Compare with Previous Review

```
review PR https://github.com/owner/repo/pull/123 and compare with the last review
```

## Troubleshooting

### "gh: command not found"

Install GitHub CLI:
```bash
brew install gh  # macOS
```

### "authentication required"

Authenticate with GitHub:
```bash
gh auth login
```

### "API rate limit exceeded"

Use authenticated requests (gh CLI should handle this) or wait for rate limit reset.

### ".temp directory not cleaned up"

Manually remove:
```bash
rm -rf .temp
```

## Advanced Usage

### Review with Oracle

For complex architectural reviews:

```
use oracle to do a deep architectural review of PR https://github.com/owner/repo/pull/123
```

### Review Multiple PRs

```
review PRs 123, 124, and 125 from https://github.com/owner/repo
```

### Export Review to File

```
review PR https://github.com/owner/repo/pull/123 and save the review to review.md
```

## Example Session

```
User: review PR https://github.com/facebook/react/pull/28934

Amp: I'll review that PR for you.

[Amp clones repo, fetches PR data, analyzes changes...]

# PR Review: Add useOptimistic hook

**Repository**: facebook/react
**PR**: #28934
**Branch**: feature/use-optimistic → main
**Files Changed**: 8 files with 456 additions and 23 deletions

## Summary

This PR introduces a new React hook `useOptimistic` for optimistic UI updates...

[Full review with issues, suggestions, and assessment]

---

Review complete! Found 3 issues: 1 HIGH, 1 MEDIUM, 1 LOW priority.
```

## Contributing

After testing this skill and confirming it works well, we can publish it to the repository for others to use.

## Questions?

If you encounter issues or have questions about the PR review skill, please check the [SKILL.md](.agents/skills/pr-review/SKILL.md) file for detailed workflow information.
