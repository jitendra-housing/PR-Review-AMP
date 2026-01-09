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

### 3. Get List of Changed Files and Classify by Priority

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

**CRITICAL: Classify files by review depth to optimize costs:**

**AUTO-SKIP (don't review, don't add to TODO):**
- Package locks: `package-lock.json`, `yarn.lock`, `Podfile.lock`, `Gemfile.lock`, `pnpm-lock.yaml`, `composer.lock`
- Generated files: `*.generated.*`, `*.g.dart`, `*.g.kt`, `*.g.swift`, `.pb.go`, `*_pb2.py`, `*.pb.h`
- Vendored/dependencies: files in `vendor/`, `node_modules/`, `Pods/`, `.build/`, `third_party/`
- Binary/assets: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.ttf`, `.woff`, `.woff2`, `.ico`
- Build artifacts: `.xcworkspace/*`, `.xcodeproj/xcuserdata/`, `.gradle/`, `build/`

**QUICK REVIEW (pattern check only, <10 sec):**
- Resource files: `.json`, `.xml`, `.yaml`, `.yml`, `.strings`, `.properties`, `.plist`
- Documentation: `.md`, `.txt`, `.rst`
- Config files (non-sensitive): `.gitignore`, `.eslintrc`, `tsconfig.json`

**DEEP REVIEW (full RAG + metrics):**
- Source code: `.swift`, `.kt`, `.java`, `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`, `.rb`, `.php`, `.cs`, `.cpp`, `.c`, `.h`, `.m`, `.scala`, `.rs`
- UI code: `.xib`, `.storyboard`, `.vue`, `.svelte`, `.html` (with logic)
- Tests: Files matching `*test*`, `*spec*`, `*Test.java`, `*Tests.swift`, `*_test.go`, `*_test.py`, `*.spec.ts`
- Critical configs: `.env`, API configs, security/auth configs, database schemas, migrations

**Create a TODO checklist with categorized files:**

Use `todo_write` to create checklist items:
```json
[
  {"id": "pattern-cache", "content": "Cache codebase patterns using RAG", "status": "todo"},
  {"id": "f1", "content": "DEEP: path/to/file1.swift", "status": "todo"},
  {"id": "f2", "content": "QUICK: config.json", "status": "todo"},
  {"id": "f3", "content": "DEEP: path/to/file3.kt", "status": "todo"},
  ...,
  {"id": "post", "content": "Post review to GitHub PR", "status": "todo"}
]
```

**Note skipped files in review summary:**
```
⏭️ Skipped files (auto-generated, lock files, binaries): 15 files
```

### 4. Cache Codebase Patterns Using RAG (One-Time Cost)

```bash
echo "🔎 SERVER: Learning codebase patterns"
```

**CRITICAL: Learn all patterns ONCE at the start to avoid repeated RAG queries**

Mark pattern-cache as in-progress:
```bash
todo_write # mark "pattern-cache" as "in-progress"
```

**Step 4a: Detect platforms and load guideline files**

Based on file extensions in the PR, load relevant platform-specific guidelines:

```bash
# Analyze file extensions from changed_files.json
# Detect platforms:
# - .swift, .m, .h, .xib, .storyboard → iOS
# - .jsx, .tsx, .js (frontend) → Web/React
# - .kt, .java (Android context) → Android
# - .ts (backend) → Node.js
# - .py → Python
# - .go → Go

# Load guideline files from .agents/skills/pr-review-rag/guidelines/
# Example: If .swift files present, read iOS.md

# Check if guideline file exists:
SKILL_DIR="$(dirname "$(readlink -f "$0")")"  # Get skill directory
GUIDELINES_DIR="$SKILL_DIR/guidelines"

# For iOS files:
if [ -f "$GUIDELINES_DIR/iOS.md" ]; then
    cat "$GUIDELINES_DIR/iOS.md"  # Read and cache iOS-specific conventions
fi

# For Android files:
if [ -f "$GUIDELINES_DIR/Android.md" ]; then
    cat "$GUIDELINES_DIR/Android.md"
fi

# For Web/React files:
if [ -f "$GUIDELINES_DIR/Web.md" ]; then
    cat "$GUIDELINES_DIR/Web.md"
fi

# Store loaded guidelines in memory for use throughout review
```

**Platform detection mapping:**
- **iOS:** `.swift`, `.m`, `.h`, `.xib`, `.storyboard` → Load `iOS.md`
- **Web/React:** `.jsx`, `.tsx`, `.js` (frontend) → Load `Web.md`
- **Android:** `.kt`, `.java` (if Android project) → Load `Android.md`
- **Node.js:** `.ts` (backend context) → Load `Node.md`
- **Python:** `.py` → Load `Python.md`
- **Go:** `.go` → Load `Go.md`

**Step 4b: Ask RAG these questions ONCE and cache results:**

```
Use librarian to ask: "Analyze this codebase and provide comprehensive patterns that a senior developer would check:

1. DEPENDENCY INJECTION PATTERNS:
   - How are classes/ViewModels/Controllers instantiated?
   - DI container usage: container.resolve() vs direct initialization
   - Factory patterns: Builder.create() vs new Object()
   - Service locators: ServiceRegistry.get() vs manual instantiation
   - Singleton access: Manager.shared vs Manager()
   - Show concrete examples with before/after patterns

2. NAMING CONVENTIONS:
   - Variable naming (camelCase, snake_case, PascalCase)
   - Class/interface/file naming patterns
   - Constant naming (UPPER_CASE, kConstant, etc.)
   - Function/method naming conventions
   - Prefixes/suffixes used (I-, Base-, -Protocol, -Delegate, etc.)
   - Show examples of correct naming in this codebase

3. ERROR HANDLING PATTERNS:
   - How are errors handled? (try/catch, Result types, throws, etc.)
   - Error propagation patterns
   - Logging patterns and levels
   - User-facing vs internal errors
   - Show examples of proper error handling

4. CODE ORGANIZATION:
   - Typical function/method sizes (lines per method)
   - Typical class sizes (lines per file)
   - Architecture pattern (MVC, MVVM, VIPER, Clean, etc.)
   - Folder/module organization
   - Separation of concerns patterns
   - Show examples of well-structured code

5. MODULE/IMPORT PATTERNS:
   - How are modules imported? (import { factory } vs direct class)
   - Internal vs external dependencies
   - Lazy loading patterns
   - Show examples of proper imports

6. COMMON CODE PATTERNS:
   - Async/await vs callbacks vs promises
   - Null/optional handling patterns
   - Constants vs magic numbers
   - Configuration management
   - Date/time handling
   - String formatting
   - Show examples from this codebase

7. TEST PATTERNS (if tests exist):
   - Test naming conventions
   - Mock/stub patterns
   - Assertion styles
   - Test organization (Arrange-Act-Assert, Given-When-Then)
   - Show examples of good tests

Provide concrete code examples from this repository for each pattern."
```

**Store the comprehensive response in memory for use throughout the review.**

This cached knowledge acts like a senior developer's mental model of "how we do things here".

**Step 4c: Combine guideline files + RAG patterns**

You now have TWO sources of pattern knowledge:
1. **Guideline files** (explicit, documented, project-specific) - e.g., iOS.md
2. **RAG patterns** (learned from codebase analysis)

**Priority when reviewing:**
- Guideline files take precedence (explicit team conventions)
- RAG patterns supplement where guidelines don't cover
- If conflict, use guideline files and note the discrepancy

Mark pattern-cache as completed:
```bash
todo_write # mark "pattern-cache" as "completed"
```

### 5. Review Files Sequentially (No Sub-Agents)

```bash
echo "🔎 SERVER: Reviewing files sequentially"
```

**DO NOT SKIP ANY FILES (except auto-skipped categories).**

**Review files one by one in this order:**
1. DEEP review files first (source code, tests, critical configs)
2. QUICK review files last (resources, docs)

**For each file:**

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

c. **Use cached patterns and limited RAG queries:**
   
   **Use the CACHED knowledge from Step 4** - already in memory:
   
   **Source 1: Platform Guideline Files** (if loaded)
   - Explicit, documented conventions from iOS.md, Android.md, etc.
   - Concrete code examples of ✅ CORRECT vs ❌ WRONG patterns
   - Severity levels for each violation type
   - **Use these FIRST** - they're the source of truth
   
   **Source 2: RAG-Learned Patterns**
   - **DI patterns:** container.resolve() vs direct initialization
   - **Factory patterns:** Builder.create() vs new Object()
   - **Service locators:** ServiceRegistry.get() vs manual instantiation  
   - **Singleton access:** Manager.shared vs Manager()
   - **Module patterns:** import { factory } from 'module' vs direct class usage
   - **Naming conventions:** camelCase, PascalCase, snake_case, prefixes/suffixes
   - **Error handling:** try/catch, Result types, error propagation
   - **Code organization:** file structure, class sizes, method lengths
   - **Async patterns:** async/await vs callbacks vs promises
   - **Null handling:** optional chaining, guard statements, etc.
   - **Test patterns:** naming, mocks, assertions
   
   **Only ask RAG for file-specific context (if needed for DEEP review):**
   - "What is the purpose of [FILE_PATH]?"
   - "What files import/depend on [FILE_PATH]?"
   - "Show me other files with similar responsibility"
   
   **For QUICK review files:**
   - Skip RAG queries entirely
   - Just apply basic checks (syntax, duplicates, sensitive data)
   
   **Apply cached patterns to detect violations:**
   The PR changes might introduce code that works but violates established patterns.
   
   **Examples of pattern violations to catch (with severity):**
   
   **HIGH Severity - Architectural Pattern Violations:**
   
   DI Container violations (any language):
   - ❌ iOS: `let vc = MyViewController()` when patterns show `container.resolve(MyViewController.self)`
   - ❌ Java/Kotlin: `new UserService()` when patterns show `@Inject UserService` or `ServiceFactory.create()`
   - ❌ TypeScript: `new AuthService()` when patterns show `inject(AuthService)` or `useService()`
   - ❌ Python: `EmailSender()` when patterns show `container.get(EmailSender)`
   
   Factory/Builder violations (any language):
   - ❌ Direct instantiation when factory exists: `new Connection()` vs `ConnectionFactory.create()`
   - ❌ Not using builder pattern: `new Config(a,b,c,d,e)` vs `ConfigBuilder().withA().withB().build()`
   
   Singleton violations (any language):
   - ❌ iOS: `DatabaseManager()` when patterns show `DatabaseManager.shared`
   - ❌ Java: `new Logger()` when patterns show `Logger.getInstance()`
   - ❌ JavaScript: `new ApiClient()` when patterns show `ApiClient.instance`
   
   Async pattern violations (any language):
   - ❌ Using callbacks when codebase uses async/await or Promises
   - ❌ Blocking calls when codebase uses non-blocking patterns
   
   **Why HIGH:** These break dependency injection, reduce testability, violate architecture
   
   **MEDIUM Severity - Convention Violations:**
   - ❌ Naming: `error_handler` vs `errorHandler` (violates codebase naming convention)
   - ❌ Magic numbers: `86400` vs `SECONDS_PER_DAY` or `Duration.ofDays(1)`
   - ❌ Null handling: Force unwrap when codebase uses safe patterns
   - ❌ Import styles: Different import format than codebase uses
   
   **Why MEDIUM:** These affect readability and maintainability but don't break architecture
   
   **Action:** Compare ALL changes against cached patterns - this is the core value of senior review.

e. **Analyze the diff patch** to see what changed

f. **Verify before reporting issues:**
   - Check if the "issue" already exists in the full file
   - Confirm the problem is actually in the changed lines
   - Don't assume missing code - verify by reading the file

g. **Review based on file type and depth:**

**GOLDEN RULE**: Only comment on code that is ACTUALLY CHANGED in the diff. If something exists elsewhere in the file but wasn't modified, DON'T flag it.

**QUICK REVIEW FILES** (resources, docs):
   - Syntax errors (JSON/YAML/XML validation)
   - Duplicate keys in JSON/YAML
   - Sensitive data (passwords, tokens, API keys) - HIGH severity
   - Broken links in markdown
   - Missing translations (compare with other locale files)
   - **Skip all other checks** - no RAG, no metrics, no deep analysis
   - **Should take <10 seconds per file**

**DEEP REVIEW FILES** (source code, tests, critical configs):

**Source Code Files (all languages - .swift, .kt, .java, .ts, .py, .go, etc.):**
   - Read the COMPLETE file first (via GitHub API)
   - Use RAG sparingly (only file-specific context if unclear)
   - Focus ONLY on the lines that changed in the diff
   
   **CRITICAL: Check for pattern violations (using CACHED patterns):**
   
   **HIGH severity violations:**
   - ❌ DI container bypassed: Direct instantiation vs container/injection pattern
   - ❌ Factory pattern ignored: `new Object()` when factory/builder exists
   - ❌ Singleton pattern violated: Direct construction when singleton pattern used
   - ❌ Async pattern mismatch: Callbacks when codebase uses async/await
   
   **MEDIUM severity violations:**
   - ❌ Naming convention: `snake_case` vs `camelCase` (or vice versa)
   - ❌ Magic numbers: Hardcoded values vs named constants
   - ❌ Import style: Different format than codebase standard
   - ❌ Null handling: Unsafe vs safe patterns used in codebase
   
   Compare changed lines against **CACHED patterns from Step 4**
   - **Architecture/DI violations = HIGH** (breaks testability, consistency, architecture)
   - **Convention violations = MEDIUM** (readability, maintainability)
   
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
   - Thread safety (async operations, shared state, race conditions, concurrent access)
   - Memory leaks (circular refs, event listener cleanup, closure captures, resource disposal)
   - Null/undefined handling (safe patterns used in codebase: Optional, ?, ??, guard, etc.)
   - Error handling completeness (try/catch, Result types, error propagation per codebase pattern)
   - N+1 queries or inefficient loops (database/API calls in loops, missing batch operations)
   - Memory allocations in hot paths (large objects created repeatedly, string concatenation in loops)
   
   **Senior Developer Metrics - Maintainability:**
   - API usage patterns (deprecated APIs, wrong lifecycle methods)
   - Delegate patterns and memory management
   - Documentation for complex logic (especially if >20 lines)
   - Magic numbers or strings (should be constants)
   - Hardcoded values (should be configurable)
   
   - Check if changes follow cached patterns (no additional RAG needed)

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

h. **Collect findings for this file:**
   - File path
   - Line number (from patch - ONLY changed lines)
   - Severity (use these guidelines):
     - **HIGH**: Security issues, architectural pattern violations (DI, factories, singletons, async), memory leaks, data loss, SQL injection, XSS
     - **MEDIUM**: Convention violations (naming, constants), code complexity, missing error handling, missing null checks
     - **LOW**: Code style preferences, minor optimizations, documentation suggestions, comment improvements
   - Description of issue
   - Suggested fix
   
i. **Mark file as completed**:
   ```bash
   todo_write # mark file as "completed"
   ```

j. **Move to next file** and repeat until all files reviewed

### 6. Compile Comprehensive Review

**After reviewing all files, organize findings:**
- Group issues by severity (HIGH/MEDIUM/LOW)
- Group by file
- Deduplicate similar issues across files

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

## 📊 Review Statistics

- **Deep reviewed**: 12 files (source code, tests, critical configs)
- **Quick reviewed**: 5 files (resources, docs)
- **Skipped**: 15 files (lock files, generated, binaries)
- **Total files in PR**: 32 files

---

## Summary

${OVERALL_SUMMARY}

**Files Changed**: ${FILE_COUNT}
**Lines**: +${ADDITIONS} -${DELETIONS}

---

## 🔴 High Severity Issues (${HIGH_COUNT})

### File: path/to/file.swift

**Line 45**: Direct instantiation - DI pattern violation
- **Issue**: `EMIBreakupBottomSheetVC()` instantiated directly instead of using `container.resolve`
- **Impact**: Violates dependency injection pattern, reduces testability, inconsistent with codebase architecture
- **Reference**: See iOS.md guidelines - "Dependency Injection" section
- **Fix**: Use dependency injection container as per guidelines
```swift
// Current (❌ WRONG - from iOS.md)
let vc = EMIBreakupBottomSheetVC()

// Suggested (✅ CORRECT - from iOS.md)
let vc = container.resolve(EMIBreakupBottomSheetVC.self)
```

**Note:** This pattern is documented in `.agents/skills/pr-review-rag/guidelines/iOS.md`

**Line 78**: Factory pattern not used
- **Issue**: Direct instantiation when factory pattern exists in codebase
- **Impact**: Inconsistent with codebase patterns, harder to test and maintain
- **Fix**: Use factory pattern
```
// Current (❌ Pattern violation)
connection = new DatabaseConnection()

// Suggested (✅ Follows codebase pattern)
connection = ConnectionFactory.create()
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

### Analysis Workflow (Sequential Review - Cost Optimized)

**Step 1: Setup and classify files**
- Get list of ALL changed files from GitHub API
- **Classify files**: Auto-skip, Quick review, Deep review (see Step 3 of main workflow)
- Create todo_write checklist with pattern-cache + reviewable files only
- Number them sequentially (f1, f2, f3...)
- **ALWAYS add final TODO: Post review to GitHub PR**
- All start with status "todo"

**Step 2: Cache codebase patterns ONCE**
- Mark "pattern-cache" as in-progress
- Use librarian to ask about DI patterns, naming conventions, error handling, code organization
- Store patterns in memory for entire review
- Mark "pattern-cache" as completed
- **This single query replaces 50+ per-file RAG queries**

**Step 3: Review files sequentially (NO sub-agents)**

Review DEEP files first, then QUICK files.

For each file:
1. Mark as in-progress (`todo_write`)
2. Fetch complete file via GitHub API (if DEEP review)
3. **Use CACHED patterns** from Step 2 (no additional RAG)
4. Only ask RAG for file-specific context if truly needed
5. Analyze diff patch
6. Apply appropriate checks:
   - **DEEP**: Full metrics + pattern violations + safety checks
   - **QUICK**: Syntax, duplicates, sensitive data only
7. Collect findings (file, line, severity, description, fix)
8. Mark as completed (`todo_write`)
9. Move to next file

**Step 4: Compile comprehensive review**
- Group findings by severity (HIGH/MEDIUM/LOW)
- Group by file
- Deduplicate similar issues
- Calculate statistics (deep/quick/skipped file counts)
- Add branch sync status
- Add overall assessment and score

**Step 5: Post review to GitHub (MANDATORY)**
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

**Step 1: Classify files**
```
Total files: 40
- Auto-skip: 10 files (package-lock.json, *.generated.*, binaries)
- Quick review: 8 files (config.json, README.md, etc.)
- Deep review: 22 files (source code, tests)

todo_write:
- pattern-cache: Cache codebase patterns (status: todo)
- f1-f22: 22 deep review files
- q1-q8: 8 quick review files
- post: Post review to GitHub PR (status: todo)
```

**Step 2: Fetch PR data**
```bash
gh api repos/owner/repo/pulls/456 > pr_data.json
gh api repos/owner/repo/pulls/456/files > changed_files.json
```

**Step 3: Load platform guidelines + cache patterns**
```bash
todo_write # mark pattern-cache as in-progress

# STEP 1: Detect platforms from file extensions
# Example: If .swift files → Load iOS.md
# Example: If .kt files → Load Android.md

# STEP 2: Read guideline files
# Check .agents/skills/pr-review-rag/guidelines/iOS.md (if iOS files)
# Check .agents/skills/pr-review-rag/guidelines/Android.md (if Android files)
# Store guideline content in memory

# STEP 3: Query RAG for codebase patterns
librarian: "Analyze this codebase comprehensively and provide:
- DI patterns (container.resolve, factories, service locators, singletons)
- Naming conventions (variables, classes, constants, functions, prefixes/suffixes)
- Error handling (try/catch, Result types, error propagation, logging)
- Code organization (architecture, file sizes, method sizes, separation of concerns)
- Module/import patterns
- Common code patterns (async, null handling, constants, config management)
- Test patterns (naming, mocks, assertions)

Provide concrete examples from this repository for each."

# STEP 4: Combine both sources
# - Guideline files = explicit team conventions (priority)
# - RAG patterns = learned from codebase (supplementary)
# Store ALL in memory - this is the senior developer's knowledge base

todo_write # mark pattern-cache as completed
```

**Step 4: Review files sequentially**

```bash
# f1: src/auth/jwt.js
todo_write # mark f1 as in-progress
gh api repos/owner/repo/contents/src/auth/jwt.js > jwt_full.js
# Analyze diff, apply CACHED patterns, check metrics
# Finding: HIGH - Hardcoded JWT secret at line 34
todo_write # mark f1 as completed

# f2: src/auth/tokens.js
todo_write # mark f2 as in-progress
gh api repos/owner/repo/contents/src/auth/tokens.js > tokens_full.js
# Analyze diff, apply CACHED patterns
# Finding: MEDIUM - Missing token expiration check
todo_write # mark f2 as completed

# ... continue for all 22 deep files

# q1: config.json (quick review)
todo_write # mark q1 as in-progress
# Quick check: syntax, duplicates, sensitive data
# No issues found
todo_write # mark q1 as completed

# ... continue for all 8 quick files
```

**Step 5: Compile review**

Aggregate findings:
- HIGH: 2 issues (JWT secret, SQL injection)
- MEDIUM: 5 issues
- LOW: 3 issues

**Step 6: Post to GitHub**
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
