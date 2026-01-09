# Common PR Review Guidelines

Universal code review standards applied by both `pr-review` and `pr-review-rag` skills.

**Last Updated:** January 2026

---

## Severity Levels

Use these severity classifications when flagging issues:

### 🔴 HIGH Severity

**Criteria:**
- Security vulnerabilities (XSS, SQL injection, auth bypass, exposed secrets)
- Architectural pattern violations (DI, factories, singletons, module boundaries)
- Memory leaks, data loss, crash-inducing bugs
- Breaking changes without migration path
- Critical performance issues (unbounded loops, blocking main thread)

**Examples:**
- Direct instantiation when codebase uses DI container
- `common/` module importing from `Apps/` (breaks micro frontend architecture)
- Using Emotion when codebase standard is Linaria
- Hardcoded secrets, API keys, passwords
- SQL injection vulnerability
- Force unwrapping optionals that can crash

**Impact:** Breaks architecture, security, or stability

---

### 🟡 MEDIUM Severity

**Criteria:**
- Convention violations (naming, imports, constants)
- Code complexity (>3 nesting levels, >50 line methods)
- Missing error handling or null checks
- Performance concerns (N+1 queries, inefficient algorithms)
- Missing tests for new functionality
- Accessibility issues

**Examples:**
- Inconsistent naming (`snake_case` vs `camelCase`)
- Magic numbers instead of named constants
- Missing try/catch or error propagation
- Function with >4 parameters (should use config object)
- Component >300 lines (should extract subcomponents)
- Missing accessibility labels

**Impact:** Affects maintainability, readability, or user experience

---

### 🟢 LOW Severity

**Criteria:**
- Code style preferences
- Minor optimizations
- Documentation suggestions
- Comment improvements
- Formatting inconsistencies

**Examples:**
- Variable could have more descriptive name
- Method could be extracted for clarity
- Missing inline comment for complex logic
- Could use const instead of let

**Impact:** Minor improvement, nice-to-have

---

## Pattern Violations to Detect

### DI Container Violations (HIGH)

**Across all languages:**

❌ **iOS:**
```swift
let vc = MyViewController()  // WRONG
let vm = MyViewModel()       // WRONG
```

✅ **Correct:**
```swift
let vc = container.resolve(MyViewController.self)
let vm = container.resolve(MyViewModelProtocol.self, arguments: data)
```

❌ **Java/Kotlin:**
```kotlin
val service = UserService()  // WRONG when DI used
```

✅ **Correct:**
```kotlin
@Inject lateinit var service: UserService
// or
val service = ServiceFactory.create()
```

❌ **TypeScript/JavaScript:**
```typescript
const service = new AuthService()  // WRONG when DI used
```

✅ **Correct:**
```typescript
const service = inject(AuthService)
// or
const service = useService(AuthService)
```

**Why HIGH:** Breaks dependency injection, reduces testability, violates architecture

---

### Factory/Builder Pattern Violations (HIGH)

❌ **Direct instantiation when factory exists:**
```
new Connection()          // WRONG
new Config(a,b,c,d,e)    // WRONG
```

✅ **Use factory/builder:**
```
ConnectionFactory.create()
ConfigBuilder().withA().withB().build()
```

**Why HIGH:** Violates established creation patterns, bypasses configuration logic

---

### Singleton Pattern Violations (HIGH)

❌ **Direct instantiation:**
```swift
let db = DatabaseManager()       // iOS - WRONG
let logger = Logger()             // Java - WRONG
let api = new ApiClient()         // JS - WRONG
```

✅ **Use singleton accessor:**
```swift
let db = DatabaseManager.shared  // iOS
let logger = Logger.getInstance() // Java
let api = ApiClient.instance      // JS
```

**Why HIGH:** Creates multiple instances of singleton, breaks global state management

---

### Async Pattern Violations (HIGH)

❌ **Using callbacks when codebase uses async/await:**
```javascript
fetchData((data) => {  // WRONG if codebase uses async/await
  processData(data, (result) => {
    // callback hell
  })
})
```

✅ **Use async/await:**
```javascript
const data = await fetchData()
const result = await processData(data)
```

**Why HIGH:** Inconsistent with codebase patterns, harder to maintain

---

### Module Boundary Violations (HIGH)

**Web/React specific:**

❌ **common/ importing from Apps/:**
```javascript
// In common/components/Button.jsx
import something from 'Apps/housing.demand/...'  // WRONG!
import data from '../../Apps/housing.supply/...' // WRONG!
```

✅ **Correct:**
```javascript
// Apps can import from common, not vice versa
import Button from 'common/components/Button'  // ✅ In Apps/
```

**Why HIGH:** Breaks micro frontend architecture, creates circular dependencies

---

### Styling Pattern Violations (HIGH for Web)

**Web/React specific:**

❌ **Using Emotion when Linaria is standard:**
```javascript
import styled from '@emotion/styled'  // WRONG!
```

✅ **Use Linaria:**
```javascript
import { styled } from '@linaria/react'
import { css } from '@linaria/core'
```

**Why HIGH:** Inconsistent build pipeline, bundle size impact, mixing CSS-in-JS libraries

---

## Senior Developer Metrics

Apply these checks to ALL code files:

### Code Quality

**Complexity:**
- Method >50 lines? → MEDIUM - Extract smaller methods
- >3 levels of nesting? → MEDIUM - Use early returns or extract logic
- File >500 lines? → MEDIUM - Split into multiple files
- Class >400 lines? → MEDIUM - Too many responsibilities

**Single Responsibility:**
- Does the class/method do too many things?
- Business logic mixed with presentation logic? → MEDIUM
- UI code in ViewModels? → MEDIUM

**Code Duplication:**
- Is this logic duplicated elsewhere? → MEDIUM
- Could this be extracted into a shared utility?

**Naming:**
- Do names follow codebase conventions? → MEDIUM if violated
- Are they descriptive and consistent?
- Boolean names: `isEnabled`, `hasData`, `canPerform`
- Avoid abbreviations unless standard in codebase

**Function Parameters:**
- >4 parameters? → MEDIUM - Suggest config object/struct
- Too many boolean flags? → MEDIUM - Use enum or options object

**Example:**
```typescript
// ❌ MEDIUM - Too many parameters
function createUser(name, email, age, country, phone, address, zip) { }

// ✅ Better
function createUser(userData: UserData) { }
```

---

### Architecture

**Separation of Concerns:**
- Business logic in ViewControllers/Components? → MEDIUM
- Data fetching in UI components? → MEDIUM
- Should be in ViewModel/Service layer

**Dependency Direction:**
- Does the change introduce circular dependencies? → HIGH
- Does it violate layered architecture?

**Interface Segregation:**
- Are interfaces too broad? → MEDIUM
- Do clients depend on methods they don't use?

**Testability:**
- Can this code be tested? → MEDIUM if not
- Are dependencies injectable?
- Hardcoded dependencies? → MEDIUM

---

### Safety & Performance

**Thread Safety:**
- Async operations without synchronization? → HIGH
- Shared state without locks/mutexes? → HIGH
- Race conditions? → HIGH
- Concurrent access to mutable data? → HIGH

**Memory Management:**
- Circular references (strong reference cycles)? → HIGH
- Event listeners not cleaned up? → MEDIUM
- Closure captures without `[weak self]`? → HIGH (iOS)
- Resource disposal missing (files, connections)? → MEDIUM

**Null/Undefined Handling:**
- Force unwrapping (`!`) without guards? → HIGH
- Unsafe optional access? → MEDIUM
- Missing null checks? → MEDIUM

**Error Handling:**
- Try/catch missing for fallible operations? → MEDIUM
- Errors swallowed silently? → MEDIUM
- Error propagation incomplete? → MEDIUM

**Performance:**
- N+1 queries (database/API calls in loops)? → MEDIUM
- Missing batch operations? → MEDIUM
- Algorithmic complexity: O(n²) where O(n) possible? → MEDIUM
- Memory allocations in hot paths? → MEDIUM
- String concatenation in loops? → LOW

---

### Maintainability

**Magic Numbers/Strings:**
- Hardcoded values without explanation? → MEDIUM
- Should be named constants

**Example:**
```swift
// ❌ MEDIUM - Magic number
if userAge > 18 { }

// ✅ Better
private let MINIMUM_AGE = 18
if userAge > MINIMUM_AGE { }
```

**Configuration:**
- Hardcoded URLs, API endpoints? → MEDIUM
- Should be in config files or environment variables

**Documentation:**
- Complex logic (>20 lines) without comments? → LOW
- Public APIs without documentation? → MEDIUM

**API Usage:**
- Using deprecated APIs? → MEDIUM
- Wrong lifecycle methods? → MEDIUM

**Dead/Unused Code:**
- Unused imports/dependencies? → LOW (cleanup)
- Unused variables/constants? → LOW
- Unused function parameters? → LOW (remove or prefix with `_`)
- Unused class properties/fields? → LOW
- Unused types/interfaces/enums? → LOW
- Unreachable code (after return/throw)? → MEDIUM (logic error or cleanup needed)
- Dead branches (conditions that can never be true)? → MEDIUM (logic error)
- Unused private methods/functions? → MEDIUM (cleanup or remove)
- Empty functions/methods? → MEDIUM (implement or remove)
- Empty catch blocks (swallowing errors)? → HIGH (error handling issue)
- Unused lifecycle methods (empty componentDidMount, etc.)? → LOW
- Unused event handlers? → LOW
- Commented-out code blocks (>10 lines)? → LOW (remove or document why kept)
- Debug/console logs in production code? → MEDIUM (should be removed)
- Unused classes/components? → MEDIUM (remove to reduce maintenance burden)
- Duplicate code that could be consolidated? → MEDIUM (extract to shared function)
- Outdated TODOs/FIXMEs (>6 months old)? → LOW (resolve or remove)

**Examples:**
```typescript
// ❌ MEDIUM - Unreachable code
function process() {
  return result
  console.log("This never runs")  // Dead code
}

// ❌ MEDIUM - Dead branch
if (userAge > 0) {
  // logic
} else if (userAge < 0) {  // Can never be true after first condition
  // Dead branch
}

// ❌ LOW - Unused imports
import { unused } from './utils'  // Not used anywhere

// ❌ LOW - Unused parameter
function calculate(a, b, unused) {  // 'unused' not referenced
  return a + b
}

// ✅ Better - Remove or prefix
function calculate(a, b, _unused) {  // Convention: prefix with _
  return a + b
}

// ❌ MEDIUM - Empty function
function handleClick() {
  // TODO: implement
}

// ❌ HIGH - Empty catch (swallows errors)
try {
  await riskyOperation()
} catch (e) {
  // Empty - errors lost!
}

// ✅ Better - Log or handle
try {
  await riskyOperation()
} catch (e) {
  logger.error('Operation failed', e)
  throw e  // Re-throw or handle
}

// ❌ MEDIUM - Commented code without explanation
// const oldLogic = () => {
//   // 50 lines of old code
// }

// ✅ Better - Remove or add explanation
// TODO: Old logic kept for reference until v2.0 migration complete (remove after March 2026)
// const oldLogic = () => { ... }

// ❌ MEDIUM - Duplicate code
function calculateTaxA(amount) {
  return amount * 0.18
}
function calculateTaxB(amount) {
  return amount * 0.18  // Same logic - should consolidate
}

// ✅ Better - Extract common logic
const TAX_RATE = 0.18
function calculateTax(amount) {
  return amount * TAX_RATE
}
```

---

## File-Type Specific Checks

### Source Code Files (.swift, .kt, .java, .ts, .jsx, .py, .go, .rb, .php)

**Apply ALL pattern violations and senior developer metrics**

**Additional checks:**
- Imports follow codebase pattern? (e.g., import { factory } vs direct class)
- Async patterns consistent with codebase?
- Error handling follows codebase pattern (try/catch, Result, Either)?
- Constants vs magic numbers?

---

### UI Files (.xib, .storyboard, .xml)

**Focus:**
- Constraint conflicts → MEDIUM
- Outlet connections valid → HIGH (can crash)
- Accessibility labels present → MEDIUM
- UI element identifiers present → LOW
- Hardcoded sizes vs adaptive layouts → MEDIUM

---

### View Files (.swift UIView, .jsx, .vue, .tsx Components)

**Pattern checks:**
- Component instantiation follows DI pattern
- Styling follows codebase standard (Linaria vs Emotion)

**Metrics:**
- Component >300 lines? → MEDIUM - Extract subcomponents
- >5 props/dependencies? → MEDIUM - Consider composition
- Direct DOM manipulation in React/Vue? → MEDIUM - Use refs pattern

**Safety:**
- UI updates on main thread (iOS/Android)? → HIGH if not
- Proper cleanup in deinit/componentWillUnmount? → MEDIUM
- Memory leaks from event listeners? → HIGH

**Accessibility:**
- Labels, roles, semantic HTML present? → MEDIUM

**State Management:**
- Too many local states? → MEDIUM - Consider lifting up
- Prop drilling >3 levels? → MEDIUM - Use Context/Redux

---

### ViewModel/Presenter Files

**Pattern checks:**
- DI patterns followed
- Factory usage correct

**Metrics:**
- Class >400 lines? → MEDIUM - Too many responsibilities
- >10 public methods? → MEDIUM - Interface too broad
- Business logic mixed with presentation? → MEDIUM

**Logic:**
- Business logic correctness
- Error handling (try/catch, Result types) → MEDIUM if missing
- Proper separation of concerns
- Testability issues (hard dependencies, global state) → MEDIUM
- Observable/binding patterns match codebase
- Null/undefined handling
- Side effects properly isolated? → MEDIUM if not

---

### Model/Entity Files (.swift, .kt, .ts, .java)

**Pattern checks:**
- Naming conventions followed
- Serialization patterns consistent

**Metrics:**
- Model >200 lines? → MEDIUM - Should it be split?
- Mutable state that should be immutable? → MEDIUM
- Missing validation logic? → MEDIUM

**Data:**
- Codable/Serializable/JSON annotations correct
- Field types match API contract
- Data validation (ranges, formats, required fields) → MEDIUM if missing
- Migration impacts (schema changes)? → HIGH if breaking
- Default values appropriate

---

### Test Files (*test*, *spec*, *Test.java, *Tests.swift, *_test.go)

**Coverage:**
- Are there tests for new functionality? → MEDIUM if missing
- Edge cases covered? → MEDIUM if not
- Error scenarios tested? → MEDIUM if not
- Integration tests for cross-module changes? → MEDIUM if not

**Quality:**
- Test naming follows conventions
- Mock/stub patterns match codebase
- Assertions clear and specific
- Test organization (Arrange-Act-Assert, Given-When-Then)
- Tests actually test something meaningful? → MEDIUM if trivial

---

### Config Files (.env, .json, .yaml, .xml, .properties)

**Security:**
- Exposed secrets, API keys, passwords? → HIGH
- Sensitive data in version control? → HIGH

**Validation:**
- Syntax errors (JSON/YAML validation) → HIGH (breaks build)
- Duplicate keys → MEDIUM
- Missing required fields → MEDIUM

**Sensitive configs:**
- Database credentials → HIGH if exposed
- API endpoints correct (not pointing to prod from dev)? → HIGH

---

### Documentation Files (.md, .txt, .rst)

**Quick checks only:**
- Broken links → LOW
- Outdated information that contradicts code? → MEDIUM
- Typos in user-facing docs → LOW

---

## Security Checklist (HIGH Priority)

**Always check for:**

1. **Injection Vulnerabilities:**
   - SQL injection (unparameterized queries)
   - XSS (unsanitized user input in HTML)
   - Command injection (shell commands with user input)
   - LDAP injection
   - XML injection

2. **Authentication/Authorization:**
   - Authentication bypass attempts
   - Missing authorization checks
   - Weak password validation
   - Session management issues
   - JWT token validation missing

3. **Secrets Exposure:**
   - Hardcoded passwords, API keys, tokens
   - Credentials in logs
   - Secrets in error messages
   - Exposed in client-side code

4. **Cryptography:**
   - Weak algorithms (MD5, SHA1 for passwords)
   - Hardcoded encryption keys
   - Missing HTTPS/TLS
   - Insecure random number generation

5. **Input Validation:**
   - Missing input validation
   - Trusting user input without sanitization
   - File upload without type/size validation
   - Path traversal vulnerabilities

---

## Performance Checklist

**Check for:**

1. **Database:**
   - N+1 query problems (loop calling DB)
   - Missing indexes on query fields
   - SELECT * instead of specific columns
   - Missing query limits (unbounded results)

2. **Algorithms:**
   - O(n²) where O(n) or O(log n) possible
   - Unnecessary nested loops
   - Redundant computations

3. **Memory:**
   - Large objects created repeatedly
   - String concatenation in loops (use StringBuilder)
   - Unbounded cache growth
   - Memory leaks (circular refs, unclosed resources)

4. **Network:**
   - Missing caching headers
   - Loading too much data (pagination missing)
   - Synchronous blocking calls on UI thread
   - Missing request batching

---

## Test Coverage Expectations

**Minimum requirements:**

- **New functionality:** Must have tests → MEDIUM if missing
- **Bug fixes:** Regression test required → MEDIUM if missing
- **Edge cases:** Should be tested → MEDIUM if not
- **Error paths:** Should be tested → MEDIUM if not

**Test quality:**
- Tests should be deterministic (not flaky)
- Tests should be fast (<1s per test)
- Tests should be isolated (no shared state)
- Mocks used appropriately (not over-mocking)

---

## Web-Specific (SSR/CSR)

**Server-Side Rendering:**
- Core data must be SSR → HIGH if only CSR for SEO-critical data
- Code is isomorphic (runs on both server/client)
- No `window` or `document` access without checks → HIGH (crashes SSR)

**Example:**
```javascript
// ❌ HIGH - Crashes on server
const width = window.innerWidth

// ✅ Correct
const [width, setWidth] = useState(0)
useEffect(() => {
  if (typeof window !== 'undefined') {
    setWidth(window.innerWidth)
  }
}, [])
```

**XSS Prevention:**
- Sanitize user input before rendering → HIGH
- Use DOMPurify or similar for `dangerouslySetInnerHTML`

---

## Quick Reference Checklist

When reviewing ANY file, check:

1. ✅ Pattern violations (DI, factories, singletons, async, styling, module boundaries)
2. ✅ Severity correctly assigned (HIGH/MEDIUM/LOW)
3. ✅ Code metrics (complexity, nesting, file/method sizes, parameters)
4. ✅ Security issues (injection, auth, secrets, crypto, input validation)
5. ✅ Performance concerns (N+1, complexity, memory, network)
6. ✅ Test coverage (new functionality, edge cases, errors)
7. ✅ Architecture violations (separation of concerns, dependency direction)
8. ✅ Safety issues (threading, memory leaks, null handling, error handling)
9. ✅ Maintainability (magic numbers, hardcoded values, documentation)

---

**Notes for Reviewers:**

- Apply platform-specific guidelines (iOS.md, Web.md, Android.md) in addition to these common checks
- Platform guidelines take precedence when conflicts arise
- Use cached patterns from codebase analysis to supplement these guidelines
- Always provide actionable feedback with suggested fixes
- Reference specific guideline sections in review comments
