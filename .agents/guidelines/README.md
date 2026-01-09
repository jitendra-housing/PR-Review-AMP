# Platform-Specific Guidelines (Shared)

This directory contains universal and platform-specific coding conventions and patterns.
**Location:** `.agents/guidelines/` (shared across all PR review skills)

## Purpose

These guideline files provide explicit, documented conventions that supplement the RAG/pattern-learned data. They help **both** PR review skills (`pr-review` and `pr-review-rag`):

1. **Catch pattern violations** with concrete examples
2. **Provide consistent feedback** based on documented standards
3. **Onboard new team members** with clear conventions
4. **Evolve standards** by updating markdown files (no skill changes needed)

## Guideline Files

### Common.md (Universal - Always Loaded)

**Always loaded for every PR review**, regardless of file types.

Contains universal code review standards:
- Severity level definitions (HIGH/MEDIUM/LOW)
- Pattern violations (DI, factories, singletons, async, module boundaries, styling)
- Senior developer metrics (code quality, architecture, safety, performance, maintainability)
- Security checklist (injection, auth, secrets, crypto, input validation)
- Performance checklist (N+1, algorithms, memory, network)
- Test coverage expectations
- File-type specific checks (source code, UI, views, ViewModels, models, tests, configs)

**Status:** ✅ Complete (~700 lines)

### Platform-Specific Guidelines (Auto-loaded)

Loaded based on file extensions in the PR:

| Guideline File | Auto-loaded for Extensions | Example Files | Status |
|---------------|---------------------------|---------------|--------|
| `iOS.md` | `.swift`, `.m`, `.h`, `.xib`, `.storyboard` | ViewController.swift, AppDelegate.m | ✅ Complete (433 lines) |
| `Web.md` | `.jsx`, `.tsx`, `.js` (React/frontend) | UserProfile.tsx, Button.jsx, Tabs.jsx | ✅ Complete (587 lines) |
| `Android.md` | `.kt`, `.java` (Android context) | MainActivity.kt, UserViewModel.java | ⏹️ Template only |
| `Node.md` | `.js`, `.ts` (backend context) | server.js, api.ts | ⏹️ Template only |
| `Python.md` | `.py` | app.py, utils.py | ⏹️ Template only |
| `Go.md` | `.go` | main.go, handler.go | ⏹️ Template only |

## How It Works

**Both skills (`pr-review` and `pr-review-rag`) use these guidelines:**

When reviewing a PR:

1. **Step 1:** Skill analyzes file extensions in changed files
2. **Step 2:** Loads guideline files from `.agents/guidelines/`
   - **Always loads:** `Common.md` (universal standards)
   - **Conditionally loads:** Platform-specific (iOS.md, Web.md, etc.)
3. **Step 3:** Combines guidelines with learned patterns:
   - `pr-review-rag`: Common.md + Platform guidelines + RAG patterns (via librarian)
   - `pr-review`: Common.md + Platform guidelines + grep/find discovered patterns
4. **Step 4:** Applies combined knowledge with priority:
   - **Platform guidelines** (iOS.md, Web.md) > **Common.md** > **RAG/discovered patterns**
5. **Step 5:** Flags violations with examples from guideline files
6. **Step 6:** References guideline files in review comments

## Priority Hierarchy

When conflicts arise between different guideline sources:

**Highest Priority:** Platform-specific guidelines (iOS.md, Web.md, etc.)
- Project-specific patterns and conventions
- Overrides Common.md when there's a conflict

**Medium Priority:** Common.md
- Universal standards that apply to all projects
- Severity definitions always apply

**Lowest Priority:** RAG/discovered patterns
- Learned from codebase analysis
- Supplements where guidelines don't cover

## Creating New Guidelines

To add a new platform:

1. Create `PlatformName.md` in this directory
2. Follow the template structure (see iOS.md)
3. Include:
   - ✅ Correct patterns with code examples
   - ❌ Wrong patterns with explanations
   - Severity levels (HIGH/MEDIUM/LOW)
   - Project-specific conventions

## Example Guideline Structure

### Common.md
```markdown
## Severity Levels
### 🔴 HIGH Severity
- Security vulnerabilities
- Architectural pattern violations (DI, factories, module boundaries)
- Memory leaks, crash bugs

### Pattern Violations
❌ DI Container violations (any language):
- iOS: `let vc = MyViewController()` when patterns show `container.resolve(...)`
- TypeScript: `new AuthService()` when patterns show `inject(AuthService)`
```

### Platform-specific (e.g., iOS.md)
```markdown
# iOS Development Guidelines - housing-app

## Dependency Injection (Container Pattern)
### ✅ CORRECT
let vc = container.resolve(MyVC.self)

### ❌ WRONG
let vc = MyVC()  // HIGH severity violation
```

## Updating Guidelines

Simply edit the markdown files. No skill changes needed. The PR review skills automatically load the latest version on each review.

**To add new standards:**
1. Update `Common.md` for universal patterns
2. Update platform files (iOS.md, Web.md) for project-specific conventions
3. Changes apply immediately on next PR review

## Best Practices

1. **Keep it focused:** Only document project-specific conventions
2. **Show examples:** Always include code snippets
3. **Explain why:** Add impact/reasoning for each rule
4. **Mark severity:** Label violations as HIGH/MEDIUM/LOW
5. **Update frequently:** Add new patterns as they're established
