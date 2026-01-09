# Common PR Review Guidelines

Universal code review standards for all platforms (iOS, Android, Web, Backend).

**Last Updated:** January 2026

---

## Agent Cheat Sheet

**SEVERITY LEVELS:**
- `HIGH` → Security, crashes, data loss, architecture violations, breaking changes
- `MEDIUM` → Maintainability, complexity, missing tests, conventions
- `LOW` → Style, minor improvements, documentation

**TOP PRIORITIES (check first):**
1. SECURITY: injection, auth bypass, secrets exposure, input validation
2. ARCHITECTURE: DI violations, pattern violations, module boundaries
3. DATA INTEGRITY: transactions, migrations, race conditions
4. CORRECTNESS: business logic, idempotency, edge cases

**OUTPUT FORMAT:**
```
[SEVERITY] Category: Description
File: path/to/file.ext#L10-L20
Issue: What's wrong
Fix: How to fix it
```

**LANGUAGE TAGS:**
- `APPLIES_TO: all` → Universal rule
- `APPLIES_TO: mobile` → iOS, Android
- `APPLIES_TO: web` → React, Vue, JS/TS frontend
- `APPLIES_TO: backend` → Node, Python, Go, Java, etc.

---

## Rule Schema

Each rule follows this structure:
```
ID: CATEGORY-NAME-NNN
SEVERITY: HIGH | MEDIUM | LOW
APPLIES_TO: all | mobile | web | backend | [specific]
CONDITION: When this rule triggers
DETECT: What to look for
FIX: How to resolve
```

---

## SECTION: Severity Definitions

### HIGH Severity
- Security vulnerabilities (XSS, injection, auth bypass, exposed secrets)
- Architecture pattern violations (DI, factories, module boundaries)
- Data loss, crashes, memory leaks
- Breaking changes without migration
- Race conditions, deadlocks
- Missing transactions for multi-step operations

### MEDIUM Severity
- Convention violations (naming, imports, constants)
- Code complexity (>3 nesting levels, >50 line methods)
- Missing error handling or null checks
- Missing tests for new functionality
- Performance concerns (N+1, inefficient algorithms)
- Accessibility issues

### LOW Severity
- Code style preferences
- Minor optimizations
- Documentation improvements
- Formatting inconsistencies

---

## SECTION: Architecture Rules

### ARCH-DI-001: Dependency Injection Violation
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Direct instantiation when codebase uses DI container/factory
DETECT: new ClassName() or ClassName() for services, ViewModels, repositories
FIX: Use container.resolve(), inject(), factory.create(), or @Inject
```

### ARCH-FACTORY-001: Factory Pattern Bypass
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Direct instantiation when factory exists
DETECT: new Connection(), new Config() when Factory/Builder available
FIX: Use ConnectionFactory.create(), ConfigBuilder().build()
```

### ARCH-SINGLETON-001: Singleton Misuse
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Direct instantiation of singleton class
DETECT: new DatabaseManager(), new Logger(), new ApiClient()
FIX: Use .shared, .instance, .getInstance(), or DI
```

### ARCH-BOUNDARY-001: Module Boundary Violation
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Shared/common module imports from app-specific modules
DETECT: common/ importing from apps/, shared/ importing from features/
FIX: Reverse dependency direction; apps import from common
```

### ARCH-LAYER-001: Layer Violation
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Wrong layer contains logic (UI has business logic, etc.)
DETECT: Business logic in View/Component, data fetching in UI layer
FIX: Move to appropriate layer (ViewModel, Service, Repository)
```

### ARCH-CIRCULAR-001: Circular Dependency
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Modules depend on each other circularly
DETECT: A imports B, B imports A (directly or transitively)
FIX: Extract shared interface, use dependency inversion
```

---

## SECTION: Security Rules

### SEC-INJECT-001: SQL Injection
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: User input in SQL without parameterization
DETECT: String concatenation in SQL queries, f-strings with user data
FIX: Use parameterized queries, prepared statements, ORM
```

### SEC-INJECT-002: XSS Vulnerability
```
SEVERITY: HIGH
APPLIES_TO: web
CONDITION: Unsanitized user input rendered as HTML
DETECT: dangerouslySetInnerHTML, innerHTML, v-html without sanitization
FIX: Sanitize with DOMPurify, use text content, escape HTML
```

### SEC-INJECT-003: Command Injection
```
SEVERITY: HIGH
APPLIES_TO: backend
CONDITION: User input in shell commands
DETECT: exec(), system(), spawn() with user data
FIX: Use parameterized APIs, whitelist allowed values
```

### SEC-AUTH-001: Missing Authorization
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Endpoint/action lacks permission check
DETECT: No auth middleware, missing role check, no ownership validation
FIX: Add authorization check before sensitive operations
```

### SEC-AUTH-002: Authentication Bypass
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Auth can be circumvented
DETECT: Hardcoded tokens, skipped validation, debug bypasses
FIX: Ensure all auth paths validated, remove debug code
```

### SEC-SECRET-001: Hardcoded Secrets
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Credentials in source code
DETECT: API keys, passwords, tokens in code (not env/config)
FIX: Use environment variables, secrets manager
```

### SEC-SECRET-002: Secrets in Logs
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Sensitive data logged
DETECT: Logging passwords, tokens, PII, credit cards
FIX: Redact sensitive fields, use structured logging with filters
```

### SEC-CRYPTO-001: Weak Cryptography
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Insecure algorithms for security purposes
DETECT: MD5/SHA1 for passwords, hardcoded keys, Math.random() for tokens
FIX: Use bcrypt/argon2 for passwords, secure random, key management
```

### SEC-INPUT-001: Missing Input Validation
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: User input used without validation
DETECT: No type/range/format checks, trusting client data
FIX: Validate all inputs server-side, use schemas
```

### SEC-PATH-001: Path Traversal
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: User input in file paths
DETECT: File operations with user-provided paths, ../
FIX: Validate paths, use allowlists, sanitize input
```

---

## SECTION: Privacy & PII Rules

### PRIV-DATA-001: Unnecessary PII Collection
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Collecting more PII than needed
DETECT: New fields storing email, phone, location without justification
FIX: Minimize data collection, justify each PII field
```

### PRIV-LOG-001: PII in Logs
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Personal data in logs/telemetry
DETECT: Logging user emails, phones, IPs, financial data
FIX: Exclude PII from logs, hash/anonymize if needed
```

### PRIV-GDPR-001: Data Retention Issue
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: No deletion mechanism for user data
DETECT: Missing "right to be forgotten" implementation
FIX: Implement data deletion, respect retention policies
```

---

## SECTION: Data Integrity Rules

### DATA-TX-001: Missing Transaction
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Multi-step DB operations without transaction
DETECT: Multiple writes that must be atomic, no rollback on failure
FIX: Wrap in transaction, use unit of work pattern
```

### DATA-IDEM-001: Non-Idempotent Operation
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Retryable operation causes duplicate effects
DETECT: Payment/email/notification without idempotency key
FIX: Add idempotency key, check-before-act pattern
```

### DATA-FK-001: Missing Constraint
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Relationship without database constraint
DETECT: Foreign key not enforced, orphan records possible
FIX: Add FK constraint, add cascade/restrict policy
```

### DATA-MIGRATE-001: Unsafe Migration
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Migration causes downtime or data loss
DETECT: Long-running locks, non-reversible changes, no backfill
FIX: Use expand-contract pattern, add rollback, test on prod-like data
```

---

## SECTION: Concurrency Rules

### CONC-RACE-001: Race Condition
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Shared mutable state without synchronization
DETECT: Multiple threads/coroutines writing same variable
FIX: Use locks, atomic operations, or immutable data
```

### CONC-DEAD-001: Deadlock Risk
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Potential for circular wait
DETECT: Nested locks, inconsistent lock ordering
FIX: Establish lock ordering, use timeout, avoid nested locks
```

### CONC-BLOCK-001: Blocking Main Thread
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: I/O or heavy computation on UI/main thread
DETECT: Network/DB calls on main thread, sync I/O in event loop
FIX: Move to background thread/queue, use async
```

### CONC-ASYNC-001: Unhandled Async Error
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Async errors not caught or propagated
DETECT: Fire-and-forget promises, missing await, unhandled rejection
FIX: Await all promises, add error handling, use try-catch
```

---

## SECTION: Error Handling Rules

### ERR-SWALLOW-001: Swallowed Error
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Exception caught but not handled
DETECT: Empty catch block, catch without logging or re-throw
FIX: Log error, re-throw if appropriate, or handle properly
```

### ERR-PROPAGATE-001: Lost Error Context
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Error re-thrown without original context
DETECT: throw new Error("failed") losing original stack/message
FIX: Wrap error with cause, preserve stack trace
```

### ERR-TIMEOUT-001: Missing Timeout
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: External call without timeout
DETECT: HTTP/DB/API calls with no timeout configured
FIX: Add timeout, handle timeout error
```

### ERR-RETRY-001: Unbounded Retry
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Retry loop without limit
DETECT: while(true) retry, no max attempts, no backoff
FIX: Add max retries, exponential backoff, circuit breaker
```

---

## SECTION: Performance Rules

### PERF-N1-001: N+1 Query
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Database query in loop
DETECT: for item in items: query(item.id)
FIX: Use batch query, eager loading, join
```

### PERF-ALGO-001: Inefficient Algorithm
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: O(n²) or worse when O(n) or O(log n) possible
DETECT: Nested loops, repeated linear searches
FIX: Use appropriate data structure (map, set), optimize algorithm
```

### PERF-MEM-001: Memory Leak
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Resources not released, references held
DETECT: Event listeners not removed, closures capturing self, unclosed streams
FIX: Cleanup in destructor/unmount, use weak references
```

### PERF-ALLOC-001: Excessive Allocation
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Object creation in hot path
DETECT: new Object() in loop, string concatenation in loop
FIX: Reuse objects, use StringBuilder, pool resources
```

### PERF-CACHE-001: Missing Cache
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Expensive operation repeated unnecessarily
DETECT: Same computation/query executed multiple times
FIX: Cache result, memoize, use computed property
```

---

## SECTION: Code Quality Rules

### QUAL-COMPLEX-001: High Complexity
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Method too complex
DETECT: >50 lines, >3 nesting levels, cyclomatic complexity >10
FIX: Extract methods, use early returns, simplify conditionals
```

### QUAL-PARAM-001: Too Many Parameters
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Function has >4 parameters
DETECT: function(a, b, c, d, e, f)
FIX: Use options object, builder pattern, or split function
```

### QUAL-SIZE-001: File Too Large
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: File exceeds reasonable size
DETECT: >500 lines for most files, >300 lines for components
FIX: Split into multiple files/modules
```

### QUAL-DUP-001: Code Duplication
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Same logic repeated
DETECT: Copy-pasted code blocks, similar functions
FIX: Extract to shared function/utility
```

### QUAL-MAGIC-001: Magic Values
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Unexplained literal values
DETECT: if (status === 3), timeout: 86400000
FIX: Use named constants with descriptive names
```

### QUAL-NAMING-001: Poor Naming
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Names don't convey meaning
DETECT: x, temp, data, doStuff, inconsistent conventions
FIX: Use descriptive names following codebase conventions
```

---

## SECTION: Type Safety Rules

### TYPE-ANY-001: Unsafe Type Bypass
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Type system circumvented
DETECT: as any, @ts-ignore, unsafeCast, raw types
FIX: Use proper types, narrow with type guards
```

### TYPE-NULL-001: Unsafe Null Access
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Nullable value accessed without check
DETECT: Force unwrap (!), !! operator, no null check
FIX: Add null check, use optional chaining, provide default
```

### TYPE-CAST-001: Unsafe Cast
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Type cast without validation
DETECT: as Type without instanceof check, unchecked generic casts
FIX: Validate before casting, use type guards
```

---

## SECTION: Testing Rules

### TEST-MISSING-001: Missing Tests
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: New functionality without tests
DETECT: New feature/fix with no corresponding test file changes
FIX: Add unit tests covering new code paths
```

### TEST-EDGE-001: Missing Edge Cases
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Only happy path tested
DETECT: No tests for null, empty, error, boundary conditions
FIX: Add tests for edge cases and error paths
```

### TEST-FLAKY-001: Flaky Test Risk
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Test depends on external factors
DETECT: Real time, random values, external services, shared state
FIX: Mock externals, use deterministic values, isolate tests
```

### TEST-BRITTLE-001: Brittle Test
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Test coupled to implementation
DETECT: Testing private methods, exact string matches, order-dependent
FIX: Test behavior not implementation, use flexible assertions
```

---

## SECTION: Observability Rules

### OBS-LOG-001: Missing Logging
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Important operation not logged
DETECT: No logs for errors, key business operations, state changes
FIX: Add structured logging with context (IDs, parameters)
```

### OBS-LOG-002: Excessive Logging
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Noisy logs in hot paths
DETECT: Debug logs in loops, logging every request at ERROR level
FIX: Use appropriate log levels, sample high-frequency logs
```

### OBS-METRIC-001: Missing Metrics
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Key operations not instrumented
DETECT: No success/failure counts, no latency tracking
FIX: Add metrics for SLI-relevant operations
```

---

## SECTION: API & Contract Rules

### API-BREAK-001: Breaking Change
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Public API changed incompatibly
DETECT: Removed field, renamed property, changed type, removed endpoint
FIX: Version the change, deprecate first, provide migration path
```

### API-SCHEMA-001: Schema Mismatch
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Client/server types don't match
DETECT: Different field names, types, or required fields
FIX: Sync types, use shared schema (OpenAPI, Protobuf, GraphQL)
```

### API-DEPRECATE-001: Missing Deprecation
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: API removed without deprecation period
DETECT: Deleted public method/endpoint, removed field
FIX: Mark deprecated first, document timeline, then remove
```

---

## SECTION: Dependency Rules

### DEP-NEW-001: Unjustified Dependency
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: New library adds unnecessary weight
DETECT: Large dependency for small feature, duplicate functionality
FIX: Use existing libs, implement simply, or justify need
```

### DEP-VULN-001: Vulnerable Dependency
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Known CVE in dependency
DETECT: Outdated package with security advisory
FIX: Update to patched version, or mitigate if no patch
```

### DEP-LICENSE-001: License Issue
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Dependency license incompatible
DETECT: GPL in proprietary project, unlicensed code
FIX: Use compatible license, find alternative
```

---

## SECTION: Environment Rules

### ENV-PROD-001: Dev Code in Production
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Debug/test code enabled in prod
DETECT: Hardcoded debug flags, test endpoints, verbose logging
FIX: Use environment variables, remove debug code
```

### ENV-CONFIG-001: Hardcoded Config
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Environment-specific values in code
DETECT: Hardcoded URLs, API keys, feature flags
FIX: Use config files, environment variables
```

### ENV-FLAG-001: Unsafe Feature Flag
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Feature flag defaults to enabled
DETECT: New feature on by default without testing
FIX: Default to off, enable gradually, add kill switch
```

---

## SECTION: Build Rules

### BUILD-LINT-001: Suppressed Warning
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Lint/type error suppressed without justification
DETECT: @ts-ignore, eslint-disable, @SuppressWarnings without comment
FIX: Fix the underlying issue, or document why suppression needed
```

### BUILD-CI-001: Broken CI
```
SEVERITY: HIGH
APPLIES_TO: all
CONDITION: Changes break CI pipeline
DETECT: Failing tests, lint errors, type errors
FIX: Fix issues before merge
```

---

## SECTION: Documentation Rules

### DOC-API-001: Undocumented Public API
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: Public interface lacks documentation
DETECT: Public method/class/endpoint without docs
FIX: Add documentation describing purpose, parameters, return
```

### DOC-CHANGE-001: Missing Changelog
```
SEVERITY: MEDIUM
APPLIES_TO: all
CONDITION: User-facing change without changelog
DETECT: New feature/breaking change, no CHANGELOG update
FIX: Document change in CHANGELOG/release notes
```

---

## Quick Reference Checklist

When reviewing ANY file, verify:

1. **SECURITY** → injection, auth, secrets, crypto, input validation
2. **ARCHITECTURE** → DI, factories, singletons, module boundaries, layers
3. **DATA** → transactions, idempotency, migrations, constraints
4. **CONCURRENCY** → race conditions, deadlocks, blocking, async errors
5. **ERRORS** → not swallowed, timeout present, bounded retries
6. **PERFORMANCE** → N+1, algorithms, memory, caching
7. **QUALITY** → complexity, parameters, file size, duplication, naming
8. **TYPES** → no unsafe casts, null checks, proper typing
9. **TESTS** → coverage, edge cases, not flaky, not brittle
10. **OBSERVABILITY** → logging, metrics, no PII in logs
11. **API** → backward compatible, schema synced, deprecation path
12. **DEPENDENCIES** → justified, no vulnerabilities, license OK
13. **ENVIRONMENT** → no dev in prod, config externalized, flags safe
14. **BUILD** → no suppressions, CI passes
15. **DOCS** → API documented, changelog updated

---

## Appendix A: Language-Specific Examples

### A.1 DI Container Patterns

**Swift (iOS):**
```swift
// BAD
let vc = MyViewController()
let vm = MyViewModel()

// GOOD
let vc = container.resolve(MyViewController.self)
let vm = container.resolve(MyViewModelProtocol.self, arguments: data)
```

**Kotlin (Android):**
```kotlin
// BAD
val service = UserService()

// GOOD
@Inject lateinit var service: UserService
val service = ServiceFactory.create()
```

**TypeScript (Web/Backend):**
```typescript
// BAD
const service = new AuthService()

// GOOD
const service = inject(AuthService)
const service = useService(AuthService)
```

**Python (Backend):**
```python
# BAD
service = UserService()

# GOOD
service = container.resolve(UserService)
service = inject(UserService)
```

### A.2 Transaction Patterns

**Any language:**
```
// BAD - partial failure risk
deductFromAccount(from, amount)
addToAccount(to, amount)  // If this fails, money is lost

// GOOD - atomic operation
transaction {
  deductFromAccount(from, amount)
  addToAccount(to, amount)
}
```

### A.3 Idempotency Patterns

**Any language:**
```
// BAD - double charge risk
function processPayment(orderId, amount) {
  chargeCard(amount)
  markOrderPaid(orderId)
}

// GOOD - idempotent
function processPayment(orderId, amount) {
  if (isOrderPaid(orderId)) return  // Already processed
  chargeCard(amount, idempotencyKey: orderId)
  markOrderPaid(orderId)
}
```

### A.4 Async Error Handling

**JavaScript/TypeScript:**
```typescript
// BAD - unhandled rejection
fetchData().then(process)

// GOOD
try {
  const data = await fetchData()
  await process(data)
} catch (error) {
  logger.error('Failed', { error })
  throw error
}
```

**Swift:**
```swift
// BAD
Task { await riskyOperation() }  // Error lost

// GOOD
Task {
  do {
    try await riskyOperation()
  } catch {
    logger.error("Failed: \(error)")
  }
}
```

### A.5 Null Safety

**Swift:**
```swift
// BAD
let name = user.name!  // Crash if nil

// GOOD
guard let name = user.name else { return }
let name = user.name ?? "Unknown"
```

**Kotlin:**
```kotlin
// BAD
val name = user.name!!  // Crash if null

// GOOD
val name = user.name ?: return
val name = user.name ?: "Unknown"
```

**TypeScript:**
```typescript
// BAD
const name = user.name!  // Assertion, may be wrong

// GOOD
const name = user.name ?? 'Unknown'
if (!user.name) return
```

---

## Appendix B: Platform-Specific Overrides

For platform-specific rules, load additional guidelines:
- **iOS/Swift:** `.agents/guidelines/iOS.md`
- **Android/Kotlin:** `.agents/guidelines/Android.md`
- **Web/React:** `.agents/guidelines/Web.md`
- **Backend/Node:** `.agents/guidelines/Backend.md`

Platform guidelines override Common rules when conflicts arise.

---

## Notes for AI Reviewers

1. **Cite rule IDs** in comments (e.g., "SEC-INJECT-001: SQL injection risk")
2. **Apply ALL common rules** regardless of platform
3. **Load platform-specific guidelines** based on file extensions
4. **Prioritize HIGH severity** findings over MEDIUM/LOW
5. **Provide actionable fixes**, not just problem descriptions
6. **Be concise** - one issue per comment, clear fix suggestion
