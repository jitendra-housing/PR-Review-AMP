# Copilot Code Review Instructions - housing.brahmand
**Context-aware review for every PR**

---

## 🎯 PRIMARY REVIEW OBJECTIVES

1. **Catch unused code** (imports, variables, functions, props)
2. **Enforce architectural boundaries** (no cross-app imports)
3. **Verify styling standards** (component margin rules)
4. **Identify performance regressions** (SSR, code splitting, metrics)
5. **Validate GraphQL changes** (schema compatibility)

---

## 📁 REPOSITORY ARCHITECTURE (CONTEXT FOR EVERY REVIEW)

### **Monorepo Structure**
```
Apps/
├── housing. demand/     # Buy/rent flows - ISOLATED
├── housing.supply/     # Owner/broker portals - ISOLATED  
├── housing.growth/     # Acquisition features - ISOLATED
├── housing. pg/         # Paying guest - ISOLATED
├── housing.commercial/ # Commercial listings - ISOLATED
├── housing. news/       # News/content - ISOLATED
├── zeus/               # Search engine - ISOLATED
└── chimera/            # Hybrid features - ISOLATED

common/               # Shared utilities (CAN be imported by Apps)
graphql/              # API layer (CAN be imported by Apps)
scripts/              # Build/deployment
config/               # Environment configs
```

**CRITICAL RULE**: Apps are **hermetically sealed**. One app importing from another app = ❌ REJECT PR

---

## 🔍 REVIEW PROCESS - STEP BY STEP

### **1.  UNDERSTAND THE CHANGE CONTEXT**

**Before commenting, ask yourself:**
- What is the JIRA ticket?  (should be in PR title:  `[TICKET-ID]`)
- Which app(s) are affected? 
- Are there related files not in the PR diff?
- Does this change impact multiple apps?

**Auto-fetch context:**
- Check if changed files have imports from other files not in PR
- Look for similar patterns in the same app
- Verify all related imports are updated

---

## 🎨 SPECIFIC REVIEW PATTERNS

### **Pattern 1: Unused Code Detection** (HIGH PRIORITY)

**What to check:**
```javascript
// ❌ FLAG: Import never used in file
import { changeCity } from 'common/actions/filter/changeCity'
// ...  changeCity never appears below

// ❌ FLAG:  Destructured prop never used
const Component = ({ 
  usedProp, 
  unusedProp  // ⚠️ Never referenced
}) => { ... }

// ❌ FLAG: State variable never read
const [unused, setUnused] = useState(false)
// Only setUnused called, never read 'unused'

// ❌ FLAG: Function parameter not used
function helper(a, b, c) {
  return a + b  // 'c' never used
}

// ❌ FLAG:  Imported component not used
import { Button, Card } from 'common/components'
// Only Button is used, Card is not
```

**Comment Template:**
```markdown
🧹 **Unused Code Detected**

**File**: `[filename]`
**Line**: [line number]
**Issue**: The `[name]` [import/variable/prop/parameter] is declared but never used.

**Action**: Remove the unused code.  If it's for future use, add a TODO comment with ticket reference.

**Impact**:  Reduces bundle size and improves code clarity.

**Priority**: 🟡 HIGH
```

---

### **Pattern 2: Cross-App Import Detection** (CRITICAL - BLOCK MERGE)

**What to check:**
```javascript
// ❌ CRITICAL: App importing from another app
// In:  Apps/housing.demand/src/components/X.js
import { Component } from '../../../housing.supply/src/.. .'
import { util } from 'Apps/housing.growth/utils'

// ❌ CRITICAL: common/ importing from app
// In: common/utils/helper.js  
import { appSpecific } from 'Apps/housing.demand/.. .'

// ✅ CORRECT: App importing from common
// In: Apps/housing.demand/src/components/X.js
import { sharedUtil } from 'common/utils/helper'

// ✅ CORRECT: App importing from graphql
import { query } from 'graphql/queries/listing'
```

**Comment Template:**
```markdown
🚨 **CRITICAL:  Cross-App Import Violation**

**File**: `[filename]`
**Line**: [line number]
**Issue**:  Importing from another microfrontend app.  This violates the architecture boundary.

**Why this matters**:  
- Breaks module federation
- Creates tight coupling
- Prevents independent deployment
- Causes build failures in production

**Required Action**: 
1. If code needs to be shared → Move to `common/`
2. If app-specific → Duplicate the small portion needed
3. If API data → Use GraphQL layer instead

**Block merge** until resolved. 

**Priority**: 🔴 CRITICAL
```

---

### **Pattern 3: Styling Standards**

**What to check:**

```javascript
// ❌ BAD: Component setting own margin
const Card = styled.div`
  margin: 20px;  // ⚠️ Container shouldn't set own margin
  padding: 10px;  // ✅ Padding is OK
`

// ❌ BAD:  Deeply nested CSS selectors (>3 levels)
const Container = styled.div`
  .header {
    .nav {
      .item {
        .link {  // Too deep! 
          color: red;
        }
      }
    }
  }
`

// ❌ BAD: Background image instead of <Image>
const Hero = styled.div`
  background-image: url('/hero.jpg');
  background-size: cover;
`

// ✅ GOOD: Both Linaria and Emotion are allowed
import { styled } from '@linaria/react'
// OR
import styled from '@emotion/styled'

// ✅ GOOD:  Component without margin
const Card = styled.div`
  padding: 16px;
  background: white;
  border-radius: 8px;
`

// ✅ GOOD:  Parent controls spacing
const Container = styled.div`
  display: flex;
  gap: 20px;  // Parent controls spacing between Cards
`

// ✅ GOOD:  Use Image component
import Image from 'common/components/Image'
<Image src="/hero.jpg" alt="Hero" />
```

**Comment Template:**
```markdown
🎨 **Styling Standard Violation**

**File**: `[filename]`
**Line**: [line number]
**Issue**:  [specific violation]

**Standards**:  
- ✅ Both **Linaria** and **Emotion** are allowed
- ❌ Components must not set their own margins (use parent spacing)
- ❌ Use `<Image>` component, not background-image
- ⚠️ Avoid deeply nested CSS selectors (keep ≤3 levels)

**Suggested Fix**:
```javascript
[code example]
```

**Impact**: [Maintainability/Performance/Consistency]

**Priority**: 🟡 HIGH
```


### **Pattern 5: Performance Red Flags**

**What to check:**

```javascript
// ❌ BAD: Large components not code-split
import HeavyChart from './HeavyChart'  // 500kb bundle

// ✅ GOOD: Lazy load heavy components
const HeavyChart = lazy(() => import('./HeavyChart'))

// ❌ BAD: Not SSR-friendly (client-only API)
const Component = () => {
  const width = window.innerWidth  // ⚠️ Crashes SSR
}

// ✅ GOOD:  Isomorphic code
const Component = () => {
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  )
}

// ❌ BAD: Inline object in render (new reference every time)
<Component filters={{}} />
<Component style={{ margin: 0 }} />

// ✅ GOOD:  Define outside or useMemo
const EMPTY_FILTERS = {}
<Component filters={EMPTY_FILTERS} />

// OR
const filters = useMemo(() => ({}), [])

// ❌ BAD:  Synchronous expensive operation in render
const sorted = data.sort(expensiveComparator)
const filtered = items.filter(heavyFunction)

// ✅ GOOD:  Memoize expensive calculations
const sorted = useMemo(
  () => data.sort(expensiveComparator),
  [data]
)

// ❌ BAD:  Missing key in map
{items.map(item => <div>{item.name}</div>)}

// ✅ GOOD:  Stable key
{items.map(item => <div key={item.id}>{item.name}</div>)}
```

**Comment Template:**
```markdown
⚡ **Performance Concern**

**File**: `[filename]`
**Line**: [line number]
**Issue**: [specific issue]
**Impact**: [LCP/CLS/INP degradation | Bundle size | SSR crash]

**Core Web Vitals Targets**:
- LCP (Largest Contentful Paint): <2.5s
- CLS (Cumulative Layout Shift): <0.1
- INP (Interaction to Next Paint): <200ms

**Suggested Fix**:  
```javascript
[code example]
```

**Priority**: [🔴 CRITICAL | 🟡 HIGH | 🟢 MEDIUM]
```

---

### **Pattern 6: GraphQL Layer Issues**

**What to check:**

```javascript
// ❌ BAD: Complex data transformation in component
const Component = ({ rawData }) => {
  const processed = rawData
    .filter(x => x.status === 'active')
    .map(x => ({
      ... x,
      formatted: complexFormat(x),
      calculated: complexCalc(x)
    }))
    .sort((a, b) => complexSort(a, b))
  
  return <List data={processed} />
}

// ✅ GOOD: Move to GraphQL resolver
// In graphql/resolvers/listing.js
resolve: async (parent, args, { dataSources }) => {
  const raw = await dataSources.api.fetch()
  return raw
    .filter(isActive)
    .map(formatForUI)
    .sort(byRelevance)
}

// ❌ BAD: Breaking schema change without version
type Listing {
  price: Int  # Changed from String → BREAKING! 
  city: String  # Removed field → BREAKING!
}

// ✅ GOOD:  Deprecate old, add new
type Listing {
  price:  String @deprecated(reason: "Use priceV2")
  priceV2: Int
  city: String @deprecated(reason: "Use location. city")
  location: Location
}

// ❌ BAD:  Multiple queries instead of single optimized query
const data1 = await fetchListings()
const data2 = await fetchDetails(data1.id)
const data3 = await fetchImages(data1.id)

// ✅ GOOD: Single query with nested data
const data = await fetchListingWithDetails()
// Returns everything in one optimized query
```

**Comment Template:**
```markdown
🌐 **GraphQL Layer Review**

**Type**: [Schema Change | Resolver Logic | Query Pattern]

**For Schema Changes:**
- [ ] Backward compatible OR versioned
- [ ] Deprecation notice if removing fields (6-month notice)
- [ ] All consuming apps identified
- [ ] Migration path documented

**For Business Logic:**
**Issue**: Complex data processing found in component. 
**Recommendation**: Move to GraphQL resolver in `graphql/resolvers/[domain].js`

**Benefits**:
- Centralized business logic
- Reusable across apps
- Better performance (server-side)
- Easier to maintain

**Affected Apps**:  [Zeus | Demand | Supply | Growth | PG | Commercial | News | Chimera]

**Priority**: 🟡 HIGH
```

---

### **Pattern 7: State Management Issues**

**What to check:**

```javascript
// ❌ BAD:  Inline empty objects in mapStateToProps
const mapStateToProps = state => ({
  filters: state.filters || {}  // ⚠️ New object every render! 
})

// ✅ GOOD: Define constants outside
const EMPTY_FILTERS = {}
const mapStateToProps = state => ({
  filters: state. filters || EMPTY_FILTERS
})

// ❌ BAD: Prop drilling beyond 3 levels
<GrandParent data={data}>
  <Parent data={data}>
    <Child data={data}>
      <GrandChild data={data}>  // Too deep! 

// ✅ GOOD:  Use Context for deeply nested data
const DataContext = createContext()
<DataContext.Provider value={data}>
  <ComponentTree />
</DataContext.Provider>

// ❌ BAD: Over-engineering Redux state
// Storing UI state like "isDropdownOpen" in Redux

// ✅ GOOD:  Local state for UI
const [isDropdownOpen, setDropdownOpen] = useState(false)
```

**Comment Template:**
```markdown
🔄 **State Management Issue**

**File**: `[filename]`
**Line**: [line number]
**Issue**: [specific issue]

**Best Practices**:
- Local UI state → `useState`
- Shared state (same subtree) → `useContext`
- Global persistent state → Redux (minimize!)
- Server state → React Query / GraphQL

**Suggested Fix**: 
```javascript
[code example]
```

**Priority**: 🟢 MEDIUM
```

---

## 🎯 REVIEW PRIORITY SYSTEM

### **🔴 CRITICAL (Block Merge)**
1. Cross-app imports
2. Security vulnerabilities (XSS, SQL injection, exposed secrets)
3. Breaking GraphQL schema changes without migration
4. SSR-breaking code in universal components
5. Hardcoded credentials or API keys

### **🟡 HIGH (Must Fix Before Merge)**
1. Unused code (imports, variables, props)
2. Component setting own margins
3. Missing lazy loading for heavy components (>100kb)
4. Inline objects in render causing re-renders
5. Missing keys in `.map()`

### **🟢 MEDIUM (Should Fix)**
1. Code duplication (>10 lines repeated ≥2 times)
2. Complex nested conditionals (>4 levels)
3. Frontend-heavy business logic (should be in GraphQL)
4. Missing error boundaries
5. Inconsistent naming conventions
6. Deeply nested CSS selectors (>3 levels)

### **⚪ LOW (Nice to Have)**
1. Better variable names
2. Additional inline comments
3. More specific type annotations
4. Performance micro-optimizations

---

## 💬 COMMENT GUIDELINES

### **Structured Comment Format**

**Use this template for ALL comments:**
```markdown
[EMOJI] **[Category]:  [Brief Title]**

**File**: `path/to/file.js`
**Line**: [number]
**Issue**: [Clear explanation]
**Impact**: [Why it matters]
**Suggested Fix**:
```[language]
[code example]
```
**Priority**: [🔴🟡🟢⚪]
```

### **Examples of Good Comments**

✅ **SPECIFIC, NOT GENERIC:**
```markdown
🧹 **Unused Import**

**File**: `Apps/housing.demand/src/shared/components/Home/Banner/desktopv2.js`
**Line**: 7
**Issue**: The `changeCity` import is never used in this component. 

**Context**: This was likely left over when the city selection dropdown was removed.

**Action**: 
1. Remove line 7: `import { changeCity } from 'common/actions/filter/changeCity'`
2. Remove `changeCity` from the `actions` object at line 558

**Impact**: Reduces bundle size by ~2kb and improves code clarity.

**Priority**: 🟡 HIGH
```

❌ **AVOID GENERIC COMMENTS:**
```markdown
This code could be improved. 
Consider refactoring this. 
There might be performance issues here.
```
---

## 🔄 ITERATIVE REVIEW APPROACH

### **First Pass (Automated Checks)**
1. ✅ Scan for CRITICAL issues (cross-app imports)
2. ✅ Detect unused imports/variables
3. ✅ Flag inline empty objects

### **Second Pass (Context-Aware)**
1. ✅ Read full file, not just diff
2. ✅ Check related files for impact
3. ✅ Verify architectural patterns
4. ✅ Look for code duplication

### **Third Pass (Holistic)**
1. ✅ Consider PR description and ticket
2. ✅ Check if changes align with stated goal
3. ✅ Identify missing changes (incomplete refactor)
4. ✅ Suggest related improvements

---

## 📊 CONTEXT MAXIMIZATION STRATEGIES

### **Before Reviewing ANY PR**

**1. Build mental model:**
```bash
# Check which app owns this code
Apps/[which-app]/... 

# Check if imports are used elsewhere
Search references:  [import_name]

# Check similar files in same app
List:  Apps/[app_name]/src/**/[similar_pattern]

# Check for related components
Search: [ComponentName] in same directory
```

**2. Questions to answer:**
- Which app owns this code?
- What's the JIRA ticket goal?
- Is this part of a larger refactor?
- Are there related PRs open? 
- Do similar files need the same changes?

---

## 🛠️ SPECIAL REVIEW SCENARIOS

### **Scenario A: Large Refactor PR**

**Title Pattern**: `[TICKET] Refactor [component/module]`

**Extra Checks:**
```markdown
🔧 **Refactor Review Checklist**

**Scope**: [component/module/feature]
**Goal**: [from PR description]

**Completeness:**
- [ ] All files in scope updated
- [ ] No half-refactored patterns
- [ ] Import paths all updated
- [ ] No backward imports (old → new)
- [ ] Similar code also refactored
- [ ] Functionality preserved

**Inconsistencies Found**:
- [List any incomplete areas]
- [Note similar code that should also change]

**Recommendation**: [Approve | Request completion | Suggest split]
```

---

### **Scenario B: GraphQL Schema Change**

**Title Pattern**: `[TICKET] [Update/Add] GraphQL [Type/Query/Mutation]`

**Extra Checks:**
```markdown
🌐 **GraphQL Schema Change Review**

**Change Type**: [Addition | Modification | Deprecation]
**Affected Type/Query**:  `[name]`

**Impact Analysis:**
- [ ] Backward compatible:  [Yes/No]
- [ ] Deprecation notice added (if breaking)
- [ ] All consuming apps identified
- [ ] Resolvers updated in `graphql/resolvers/`

**Apps Consuming This**:
- [ ] Zeus
- [ ] Demand
- [ ] Supply
- [ ] Growth
- [ ] PG
- [ ] Commercial
- [ ] News
- [ ] Chimera

**Migration Required**:  [Yes/No]
**Migration Guide**: [link or inline]

**Priority**: [🔴 if breaking | 🟡 if new feature]
```

---

### **Scenario C: Performance Optimization PR**

**Title Pattern**: `[TICKET] Optimize [feature/page] Performance`

**Extra Checks:**
```markdown
⚡ **Performance Optimization Review**

**Target**: [page/feature/component]
**Metrics Goal**: [LCP/CLS/INP target]

**Changes Made:**
- [ ] Code splitting implemented
- [ ] Lazy loading added
- [ ] Memoization applied
- [ ] Bundle size reduced

**Verification Needed:**
- [ ] Lighthouse score improvement
- [ ] Bundle size comparison (before/after)
- [ ] Real user metrics tracking added

**Concerns**:
- [Note any potential regressions]
- [Flag missing optimizations]

**Recommendation**: [Approve | Request metrics | Test further]
```

---

## 📚 KNOWLEDGE BASE

### **Common False Positives to Avoid**

```javascript
// ❌ DON'T FLAG:  Props used in spread
const Component = ({ used, alsoUsed, ...rest }) => (
  <div {...rest}>{used}</div>  // 'alsoUsed' IS used in rest!
)

// ❌ DON'T FLAG:  Imports used in JSX
import Icon from 'common/Icon'
return <Icon. Check />  // Icon IS used

// ❌ DON'T FLAG: Side-effect imports
import 'common/styles/global.css'  // Needed for side effects

// ❌ DON'T FLAG: Type-only usage
import PropTypes from 'prop-types'
Component.propTypes = { /* ... */ }  // IS used

// ❌ DON'T FLAG: Exported constants
export const CONFIG = { /* ... */ }  // May be imported elsewhere

// ❌ DON'T FLAG: React.Fragment shorthand
return <>content</>  // React IS used (implicit)
```

### **Known Project Patterns**

```javascript
// PATTERN: Redux connect with actions
// The 'actions' object is used by connect() internally
export default connect({
  props: mapStateToProps,
  actions: { changeCity, updateFilter }  // These ARE used
})

// PATTERN: GraphQL query variables
// Variables used in template literal queries
const query = gql`
  query($id: ID!) {
    listing(id: $id)  # $id IS used
  }
`

// PATTERN: Styled components (Linaria/Emotion)
// No explicit usage, but CSS is injected
const Button = styled.button`...`  // IS used (CSS-in-JS)

// PATTERN: Default export with named internals
export default Component
export const helper = () => {}  // Both valid
```

---

## ✅ FINAL REVIEW CHECKLIST

**Before approving ANY PR, confirm:**

- [ ] **No CRITICAL issues** (🔴)
- [ ] **All HIGH issues addressed** (🟡) or tracked in follow-up ticket
- [ ] **No cross-app imports**
- [ ] **Components don't set own margins**
- [ ] **GraphQL changes documented** (if applicable)
- [ ] **Performance concerns addressed**
- [ ] **Unused code cleaned up**
- [ ] **PR description matches changes**
- [ ] **No security vulnerabilities**

---

## 📖 REFERENCE:  File Location Standards

```
Apps/[app-name]/
├── src/
│   ├── shared/
│   │   ├── components/     # React components
│   │   ├── utils/          # App-specific utilities
│   │   └── constants/      # App-specific constants
│   ├── client/             # Client-only code
│   └── server/             # Server-only code

common/
├── components/             # Shared React components
├── utils/                  # Shared utilities
├── constants/              # Shared constants
├── actions/                # Redux actions
├── reducers/               # Redux reducers
└── styles/                 # Global styles (minimal)

graphql/
├── schema/                 # GraphQL type definitions
├── resolvers/              # GraphQL resolvers
├── queries/                # Query definitions
└── mutations/              # Mutation definitions
```

---

## 🚀 QUICK REFERENCE

### **Most Common Issues (Top 5)**

1. **Unused imports** - Remove immediately
2. **Cross-app imports** - Block merge
3. **Component margins** - Remove margin, use parent spacing
4. **Inline objects in render** - Move outside or use useMemo

### **Review Speed Guidelines**

- **Small PR** (<100 LOC): 5-10 minutes
- **Medium PR** (100-300 LOC): 15-30 minutes
- **Large PR** (>300 LOC): 30-60 minutes
- **Architecture change**:  Extra scrutiny, 60+ minutes

### **When to Escalate**

🆘 **Escalate to senior review if:**
- Major architecture changes
- GraphQL schema breaking changes
- Security concerns
- Performance degradation >20%
- Changes affecting multiple apps

---

**Last Updated**:  2026-01-12  
**Version**: 2.1 (Streamlined)  
**Maintained By**: Platform Team  
**Questions**:  #brahmand-platform on Slack