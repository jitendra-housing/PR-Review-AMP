---
name: pr-review-rag
description: Reviews GitHub pull requests using RAG (no local clone). Analyzes PR diff with full codebase context via RAG and provides detailed inline comments. PREFERRED over pr-review skill.
---

# PR Review RAG Skill

Analyzes GitHub pull requests using GitHub API + RAG. No local clone needed - leverages Amp's RAG for codebase knowledge.

## Capabilities

- Uses GitHub API for PR data and diff (no local clone)
- Leverages RAG for full codebase context and understanding
- Reviews like a senior developer with complete knowledge
- Analyzes imports, dependencies, and patterns via RAG
- Provides severity-tagged feedback (HIGH/MEDIUM/LOW)
- Creates structured review with file paths and line numbers
- Checks branch sync status
- Generates comprehensive review summary
- **10x faster** than local clone approach

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

```bash
echo "🔍 SERVER: Fetching PR data"
```

### 2. Fetch PR Data via GitHub API

Use GitHub API to get complete PR details:
```bash
gh api repos/OWNER/REPO/pulls/PR_NUMBER > pr_data.json
```

Extract from JSON:
- `base.sha` (base commit)
- `head.sha` (head commit)
- `base.ref` (target branch, e.g., main)
- `head.ref` (feature branch)
- `title` (PR title)
- `body` (PR description)
- `user.login` (PR author)

### 3. Get List of Changed Files and Create Checklist

Get PR diff to find all changed files:

```bash
echo "📥 SERVER: Fetching changed files"
gh api repos/OWNER/REPO/pulls/PR_NUMBER/files > changed_files.json
```

Parse JSON to extract:
- `filename` (file path)
- `status` (added/modified/deleted/renamed)
- `additions` (lines added)
- `deletions` (lines deleted)
- `patch` (the actual diff)

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

### 4. Review EVERY File Using Sub-Agents + RAG

```bash
echo "🔎 SERVER: Review start"
```

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
- PR diff patches for those files
- Instructions on what to check
- **CRITICAL**: Explicit instruction to ONLY collect findings, NOT post to GitHub

**Example:**
```
Task 1: Review Swift files f1-f10

IMPORTANT: 
- DO NOT post to GitHub
- DO NOT use gh pr comment
- ONLY collect findings and return them to me
- I will post the consolidated review

Files to review: [f1-f10]
```

**Step 3: Each sub-agent must:**

a. **Mark each file as in-progress** before reviewing:
   ```bash
   todo_write # update file status to "in-progress"
   ```

b. **CRITICAL: Get complete file content first:**
   ```bash
   # Fetch the COMPLETE file after changes (not just diff)
   gh api repos/OWNER/REPO/contents/FILE_PATH?ref=HEAD_SHA | jq -r '.content' | base64 -d
   ```
   
   **IMPORTANT**: You MUST read the full file to verify what exists. NEVER make claims about missing code without seeing the complete file.

c. **Use RAG to understand context:**
   - Ask RAG about the file's purpose and patterns
   - Ask RAG about related files (imports, dependencies)
   - Ask RAG about conventions used in similar files

d. **CRITICAL: Learn codebase-specific patterns using RAG:**
   
   Before analyzing changes, use RAG to understand how this codebase handles common patterns:
   
   **Pattern Discovery Questions:**
   - "How does this codebase handle object/class instantiation?"
   - "What dependency injection patterns are used in this codebase?"
   - "How are ViewModels/Controllers/Services typically created?"
   - "What are the common initialization patterns in files similar to [FILE_PATH]?"
   - "Show me examples of how [IMPORTED_CLASS/MODULE] is typically used in this codebase"
   - "What are typical function/method sizes in similar files?"
   - "How does this codebase structure error handling?"
   - "What naming conventions are used for variables/functions/classes?"
   - "How are tests typically written in this codebase?"
   
   **Look for codebase conventions like:**
   - Dependency injection patterns (e.g., container.resolve() vs direct initialization)
   - Factory patterns (e.g., Builder.create() vs new Object())
   - Service locators (e.g., ServiceRegistry.get() vs manual instantiation)
   - Module patterns (e.g., import { factory } from 'module' vs direct class usage)
   - Singleton access patterns (e.g., Manager.shared vs Manager())
   - Error handling patterns (try/catch, Result types, error propagation)
   - Naming conventions (camelCase, PascalCase, snake_case, prefixes/suffixes)
   - Code organization (file structure, class sizes, method lengths)
   
   **Why this matters:**
   The PR changes might introduce code that works but violates established patterns.
   For example:
   - ❌ `let vc = MyViewController()` when codebase uses `container.resolve(MyViewController.self)`
   - ❌ `new UserService()` when codebase uses `ServiceFactory.getUserService()`
   - ❌ `createConnection()` when codebase uses `ConnectionPool.acquire()`
   
   **Action:** Store the learned patterns for this file type/module to compare against changes.

e. **Analyze the diff patch** to see what changed

f. **Verify before reporting issues:**
   - Check if the "issue" already exists in the full file
   - Confirm the problem is actually in the changed lines
   - Don't assume missing code - verify by reading the file

g. **Review based on file type:**

**GOLDEN RULE**: Only comment on code that is ACTUALLY CHANGED in the diff. If something exists elsewhere in the file but wasn't modified, DON'T flag it.

**Swift/Kotlin/Java Files (.swift, .kt, .java):**
   - Read the COMPLETE file first (via GitHub API)
   - Use RAG to understand file context and dependencies
   - Focus ONLY on the lines that changed in the diff
   
   **CRITICAL: Check for pattern violations:**
   - ❌ Direct instantiation when DI container is used: `let vc = MyVC()` vs `container.resolve(MyVC.self)`
   - ❌ Manual service creation when factory exists: `new Service()` vs `ServiceFactory.create()`
   - ❌ Direct singleton access when pattern differs: `Manager()` vs `Manager.shared`
   - Compare changed lines against learned patterns from RAG
   - Flag any deviation from codebase conventions with MEDIUM/HIGH severity
   
   **Senior Developer Metrics - Code Quality:**
   - **Complexity:** Is the method >50 lines? Are there >3 levels of nesting? Flag with LOW severity, suggest refactoring
   - **Single Responsibility:** Does the class/method do too many things? Check against codebase patterns
   - **Code Duplication:** Is this logic duplicated elsewhere? Ask RAG "Show similar code in this codebase"
   - **Naming:** Do names follow codebase conventions? Are they descriptive and consistent?
   - **Function Parameters:** >4 parameters? Suggest using a config object/struct (check codebase pattern)
   - **God Classes/Methods:** File >500 lines? Method >100 lines? Flag for review
   
   **Senior Developer Metrics - Architecture:**
   - **Separation of Concerns:** Business logic in ViewControllers? UI code in ViewModels?
   - **Dependency Direction:** Does the change introduce circular dependencies?
   - **Interface Segregation:** Are interfaces too broad? Do clients depend on methods they don't use?
   - **Testability:** Can this code be tested? Are dependencies injectable?
   
   **Senior Developer Metrics - Safety & Performance:**
   - Thread safety (async operations, shared state, race conditions)
   - Memory leaks (retain cycles, weak references, closures capturing self)
   - Force unwraps and optional handling (use guard/if-let patterns)
   - Error handling completeness (try/catch, Result types, nil checks)
   - N+1 queries or inefficient loops (check database/API calls in loops)
   - Memory allocations in hot paths (large objects created repeatedly)
   
   **Senior Developer Metrics - Maintainability:**
   - API usage patterns (deprecated APIs, wrong lifecycle methods)
   - Delegate patterns and memory management
   - Documentation for complex logic (especially if >20 lines)
   - Magic numbers or strings (should be constants)
   - Hardcoded values (should be configurable)
   
   - Ask RAG about imported modules to understand integration points
   - Check if changes follow existing patterns (ask RAG)

**UI Files (.xib, .storyboard, .xml):**
   - Check for constraint conflicts
   - Verify outlet connections are valid
   - Check for accessibility labels
   - Ensure UI elements have proper identifiers
   - Look for hardcoded sizes vs adaptive layouts

**View Files (.swift for UIView subclasses, .jsx, .vue, .tsx):**
   - **Pattern Violations:** Check instantiation patterns vs codebase conventions
   - **Metrics:**
     - Component >300 lines? Extract subcomponents
     - >5 props/dependencies? Consider composition or config object
     - Direct DOM manipulation in React/Vue? Use refs pattern
   - Check delegate/callback patterns
   - Verify proper initialization
   - Check for UI updates on main thread (iOS/Android)
   - Look for accessibility support (labels, roles, semantic HTML)
   - Verify proper cleanup in deinit/componentWillUnmount
   - State management: Are too many states being managed locally?

**ViewModel/Presenter Files:**
   - **Pattern Violations:** Check DI patterns, factory usage
   - **Metrics:**
     - Class >400 lines? Too many responsibilities?
     - >10 public methods? Interface too broad?
     - Business logic mixed with presentation logic?
   - Check business logic correctness
   - Verify error handling (try/catch, Result types)
   - Check for proper separation of concerns
   - Look for testability issues (hard dependencies, global state)
   - Verify Observable/binding patterns match codebase
   - Check for proper null/undefined handling
   - Side effects properly isolated?

**Model/Entity Files (.swift, .kt, .ts, .java):**
   - **Pattern Violations:** Check naming conventions, serialization patterns
   - **Metrics:**
     - Model >200 lines? Should it be split?
     - Mutable state that should be immutable?
     - Missing validation logic?
   - Check Codable/Serializable/JSON annotation implementation
   - Verify field types and optionality match API contract
   - Check for data validation (ranges, formats, required fields)
   - Look for migration impacts (schema changes, breaking changes)
   - Default values appropriate?
   - Computed properties vs stored properties balance

**Generated Files:**
   - Quick scan to ensure generation is correct
   - Don't deep review auto-generated code
   - Flag if manual changes were made to generated files (HIGH severity)
   - **Metrics:** Are generated files checked into version control when they shouldn't be?

**Resource Files (.json, .strings, .xml, .yaml, .properties):**
   - **Pattern Violations:** Check formatting/structure against codebase conventions
   - **Metrics:**
     - Duplicate keys (ERROR)
     - Missing translations in locale files (flag incomplete i18n)
     - >1000 lines in single JSON? Consider splitting
   - Check for syntax errors
   - Verify no duplicate keys
   - Check for missing translations (compare with other locale files)
   - Ensure proper formatting (indentation, structure)
   - Sensitive data in config files? (passwords, tokens, keys) - HIGH severity
   - Environment-specific values hardcoded?
   
**Test Files (*test*, *spec*, *Test.java, *Tests.swift):**
   - **Pattern Violations:** Check test structure/patterns vs existing tests
   - **Metrics:**
     - Test coverage: Do new features have tests?
     - Test >200 lines? Extract helper methods
     - Are assertions clear and specific?
     - Test names descriptive? (should read like documentation)
   - Mock/stub patterns match codebase conventions?
   - Proper setup/teardown?
   - Tests for edge cases, not just happy path?
   - Async tests properly handled (awaits, timeouts)?
   - Tests actually test the changed code?

g. **Collect findings** with:
   - File path
   - Line number (from patch - ONLY changed lines)
   - Severity (HIGH/MEDIUM/LOW)
   - Description of issue
   - Suggested fix
   
   **VERIFICATION CHECKLIST before adding an issue:**
   - ✅ Is this issue in the CHANGED lines (not elsewhere in file)?
   - ✅ Did I read the complete file to verify the claim?
   - ✅ Is this actually a problem or does it already exist/work correctly?
   - ✅ Can I point to the exact line number in the diff?
   - ✅ **Does this violate learned codebase patterns?** (instantiation, DI, factories, etc.)
   - ✅ **Did I ask RAG how similar code is written in this codebase?**
   - ✅ **Senior developer metrics check:**
     - Code quality: Complexity, duplication, naming, function size
     - Architecture: Separation of concerns, dependencies, testability
     - Safety: Thread safety, memory leaks, error handling, performance
     - Maintainability: Documentation, magic values, hardcoded config

h. **Mark file as completed**:
   ```bash
   todo_write # mark file as "completed"
   ```

i. **CRITICAL: Return findings to main agent (DO NOT POST TO GITHUB)**
   - Sub-agents MUST return all findings as JSON or structured text
   - Sub-agents NEVER use `gh pr comment` or post to GitHub
   - Only the main agent posts the final consolidated review

**Step 4: Monitor progress in real-time**
- Each sub-agent updates the shared TODO checklist
- Use todo_read periodically to check progress
- Watch for completion of all file reviews

**Step 5: Verify completion**
- Run todo_read to ensure all files marked "completed"
- If any files remain "todo" or "in-progress", investigate

### 5. Compile Comprehensive Review

**Step 6: Collect findings from all sub-agents**
- Aggregate all issues from sub-agent responses
- Deduplicate similar issues
- Organize by severity (HIGH/MEDIUM/LOW)

**Step 7: Generate comprehensive review**

Format as GitHub-compatible markdown:

```markdown
# 🔍 PR Review: [PR Title]

**Repository**: `owner/repo`
**PR**: [#123](https://github.com/owner/repo/pull/123)
**Author**: @username
**Branch**: `feature-branch` → `main`

${SYNC_STATUS_WARNING_IF_BEHIND}

---

## Summary

${OVERALL_SUMMARY}

**Files Changed**: ${FILE_COUNT}
**Lines**: +${ADDITIONS} -${DELETIONS}

---

## 🔴 High Severity Issues (${HIGH_COUNT})

### File: path/to/file.swift

**Line 45-52**: Potential memory leak
- **Issue**: Strong reference cycle between ViewController and closure
- **Impact**: Memory will not be released, leading to leaks
- **Fix**: Use `[weak self]` in closure capture list
```swift
// Current
someMethod { self.doSomething() }

// Suggested
someMethod { [weak self] in
    self?.doSomething()
}
```

---

## 🟡 Medium Severity Issues (${MEDIUM_COUNT})

### File: path/to/component.kt

**Line 28**: Missing error handling
- **Issue**: Network call doesn't handle timeout scenario
- **Impact**: App may hang indefinitely
- **Fix**: Add timeout and error callback

---

## 🟢 Low Severity Issues (${LOW_COUNT})

### File: path/to/view.swift

**Line 12**: Variable name doesn't follow camelCase convention
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

### 6. Post Review to GitHub (MANDATORY)

**Step 8: Mark "Post review to GitHub PR" as in-progress**

```bash
echo "📤 SERVER: Posting review to GitHub"
```

**Step 9: Save formatted review**
```bash
cat > review_comment.md << 'EOF'
[Full review content from Step 7]
EOF
```

**Step 10: Post to GitHub**
```bash
gh pr comment PR_NUMBER --repo OWNER/REPO --body-file review_comment.md
```

**Step 11: Verify comment posted successfully**

Check exit code and confirm posting.

```bash
echo "✅ SERVER: Review complete"
```

**Step 12: Clean up**
```bash
rm -f review_comment.md pr_data.json changed_files.json
todo_write: mark "post" as "completed"
```

## Best Practices

### Review Like a Senior Developer

This skill mimics how an experienced developer reviews code:

1. **Create a checklist FIRST** - Use todo_write to track ALL files
2. **Review EVERY file** - No exceptions, no shortcuts
3. **Use RAG for context** - Understand dependencies and patterns
4. **Learn codebase conventions** - Ask RAG about patterns, naming, structure, error handling
5. **Analyze the diff** - Focus ONLY on what changed
6. **Apply metrics-based review:**
   - **Code Quality:** Complexity, duplication, naming, function/class sizes
   - **Architecture:** Separation of concerns, dependencies, testability, design patterns
   - **Safety:** Thread safety, memory management, error handling, performance
   - **Maintainability:** Documentation, magic values, configuration management
7. **Check pattern violations** - Compare changes against learned codebase patterns
8. **Mark progress** - Update todo as you complete each file
9. **Verify completion** - Check todo_read before finalizing review
10. **Think about edge cases** - What could go wrong?
11. **Consider maintainability** - Will the next developer understand this in 6 months?
12. **Provide actionable feedback** - Not just "this is wrong" but "do this instead, here's why"

### Analysis Workflow (Using Sub-Agents + RAG)

**Step 1: Setup checklist**
- Get list of ALL changed files from GitHub API
- Create todo_write checklist with EVERY file
- Number them sequentially (f1, f2, f3...)
- **ALWAYS add final TODO: Post review to GitHub PR**
- All start with status "todo"

**Step 2: Get oriented**
- Read the PR description (from API response)
- Look at the diff summary (files changed count, additions/deletions)
- Identify the core files and their relationships
- Group files into logical batches (4-6 batches for parallel processing)

**Step 4: Launch parallel sub-agents**

Create 4-6 Task sub-agents, each responsible for a batch of files:

**Batch 1 (Task 1):** Source files 1-10
```
Task: Review files f1-f10 for PR #XXXXX using RAG

⚠️ CRITICAL INSTRUCTIONS:
- DO NOT post to GitHub
- DO NOT use gh pr comment
- ONLY collect findings and return them to me
- I (main agent) will post the consolidated review

Files to review:
- path/to/file1.swift (f1)
- path/to/file2.swift (f2)
...

For EACH file:
1. Update todo: mark file as "in-progress"
2. Fetch complete file via GitHub API
3. Ask RAG about the file's purpose and patterns
4. Ask RAG about imported modules and dependencies
5. Analyze the diff patch to understand changes
6. Verify issues exist in changed lines only
7. Check for: force unwraps, memory leaks, threading, error handling
8. Update todo: mark file as "completed"
9. Return findings with file, line, severity, description, fix

DO NOT POST TO GITHUB. Return findings to main agent.

Repository: owner/repo
PR: #123
```

**Batch 2-6:** Similar tasks for remaining files

**Step 5: Monitor progress in real-time**
- Each sub-agent updates the shared TODO checklist
- Use todo_read periodically to check progress
- Watch for completion of all file reviews

**Step 6: Collect findings from all sub-agents**
- Aggregate all issues from sub-agent responses
- Deduplicate similar issues
- Organize by severity (HIGH/MEDIUM/LOW)

**Step 7: Verify completion**
- Run todo_read to ensure all files marked "completed"
- If any files remain "todo" or "in-progress", investigate

**Step 8: Generate comprehensive review**
- Compile all findings from sub-agents
- Include branch sync status in header
- Add overall assessment
- Calculate score
- Format for GitHub

**Step 9: Post review to GitHub (MANDATORY)**
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

1. **API rate limits** - Handle gracefully, wait and retry
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
export GH_TOKEN="ghp_your_token_here"
```

## Example Review Process

### Scenario: Reviewing PR #456 - Authentication Implementation (40 files)

**Step 1: Create checklist**
```
todo_write:
- f1-f40: Review 40 files
- post: Post review to GitHub PR (status: todo)
```

**Step 2: Fetch PR data**
```bash
gh api repos/owner/repo/pulls/456 > pr_data.json
gh api repos/owner/repo/pulls/456/files > changed_files.json
```

**Step 3: Group into batches**
- Batch 1: f1-f10 (auth core files)
- Batch 2: f11-f20 (middleware files)
- Batch 3: f21-f30 (route handlers)
- Batch 4: f31-f40 (tests + config)

**Step 4: Launch 4 parallel sub-agents**

**Task 1 (Batch 1):**
```
Review files f1-f10 for PR #456 using RAG

Files:
- src/auth/jwt.js (f1)
- src/auth/tokens.js (f2)
... (8 more files)

For each file:
1. Mark as in-progress
2. Fetch complete file via GitHub API
3. Ask RAG about file context and dependencies
4. **Ask RAG about codebase patterns** (DI, factories, instantiation, naming, error handling)
5. Analyze diff against learned patterns
6. **Apply senior developer metrics** (complexity, architecture, safety, maintainability)
7. Check for security, errors, pattern violations, code quality issues
8. Mark as completed
9. Return issues found with severity and metrics-based rationale

Repository: owner/repo
PR: #456
```

**Task 2-4:** Similar for other batches

**Step 5: Monitor real-time progress**
```bash
# User sees checklist updating live:
✅ f1 completed
✅ f2 completed
⏳ f3 in-progress
...
```

**Step 6: Collect findings**

Sub-agent 1 returns:
- f1: HIGH - Hardcoded JWT secret at line 34
- f2: MEDIUM - Missing token expiration check

Sub-agent 2 returns:
- f15: HIGH - SQL injection vulnerability at line 67
- f18: LOW - Inconsistent naming

(Continue for all sub-agents)

**Step 7: Generate comprehensive review**

Main agent compiles all findings, deduplicates, formats for GitHub

**Step 8: Post to GitHub**
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

# Cleanup
rm -f review_comment.md pr_data.json changed_files.json
todo_write: mark "post" as "completed"
```

This is how a senior developer reviews - with full context via RAG and comprehensive understanding.
