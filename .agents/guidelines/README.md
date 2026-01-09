# Platform-Specific Guidelines (Shared)

This directory contains platform and language-specific coding conventions and patterns.
**Location:** `.agents/guidelines/` (shared across all PR review skills)

## Purpose

These guideline files provide explicit, documented conventions that supplement the RAG/pattern-learned data. They help **both** PR review skills (`pr-review` and `pr-review-rag`):

1. **Catch pattern violations** with concrete examples
2. **Provide consistent feedback** based on documented standards
3. **Onboard new team members** with clear conventions
4. **Evolve standards** by updating markdown files (no skill changes needed)

## File Naming Convention

Guidelines are automatically loaded based on file extensions in the PR:

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
2. **Step 2:** Loads relevant guideline files from `.agents/guidelines/`
   - iOS files → Loads `iOS.md`
   - React/JS files → Loads `Web.md`
   - etc.
3. **Step 3:** Combines guidelines with learned patterns:
   - `pr-review-rag`: Guidelines + RAG patterns (via librarian)
   - `pr-review`: Guidelines + grep/find discovered patterns (local repo)
4. **Step 4:** Flags violations with examples from guideline files
5. **Step 5:** References guideline files in review comments

## Creating New Guidelines

To add a new platform:

1. Create `PlatformName.md` in this directory
2. Follow the template structure (see iOS.md)
3. Include:
   - ✅ Correct patterns with code examples
   - ❌ Wrong patterns with explanations
   - Severity levels (HIGH/MEDIUM/LOW)
   - Project-specific conventions

## Example: iOS.md

```markdown
# iOS Development Guidelines

## Dependency Injection
### ✅ CORRECT
let vc = container.resolve(MyVC.self)

### ❌ WRONG
let vc = MyVC()  // HIGH severity violation
```

## Updating Guidelines

Simply edit the markdown files. No skill changes needed. The PR review skill automatically loads the latest version on each review.

## Best Practices

1. **Keep it focused:** Only document project-specific conventions
2. **Show examples:** Always include code snippets
3. **Explain why:** Add impact/reasoning for each rule
4. **Mark severity:** Label violations as HIGH/MEDIUM/LOW
5. **Update frequently:** Add new patterns as they're established
