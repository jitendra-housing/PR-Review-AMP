# housing.brahmand Repository Guidelines

Guidelines and coding standards for the **housing.brahmand** monorepo (https://github.com/elarahq/housing.brahmand).

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Critical Micro Frontend Rules](#critical-micro-frontend-rules)
3. [Code Formatting](#code-formatting)
4. [Component & File Structure](#component--file-structure)
5. [Styling Guidelines](#styling-guidelines)
6. [State Management](#state-management)
7. [Performance & Web Vitals](#performance--web-vitals)
8. [GraphQL Standards](#graphql-standards)
9. [Security & SSR](#security--ssr)
10. [PR Review Checklist](#pr-review-checklist)
11. [Common Issues](#common-issues)

---

## Architecture Overview

### Monorepo Structure

```
housing.brahmand/
├── Apps/                              # Micro Frontend Applications (ISOLATED)
│   ├── housing.demand/               # Buy/rent flows
│   ├── housing.supply/               # Owner/broker portals
│   ├── housing.growth/               # Acquisition features
│   ├── housing.pg/                   # Paying guest
│   ├── housing.commercial/           # Commercial listings
│   ├── housing.news/                 # News/content
│   ├── housing.flatmate/             # Flatmate features
│   ├── housing.chimera/              # Hybrid features
│   └── housing.universalComponents/  # Shared component library
├── common/                            # Monorepo-wide shared code
├── graphql/                           # API layer
├── scripts/                           # Build/deployment
└── tests/                             # Test utilities
```

### Import Aliases

```javascript
demand: './Apps/housing.demand/src'
chimera: './Apps/housing.chimera/src'
commercial: './Apps/housing.commercial/src'
supply: './Apps/housing.supply/src'
pg: './Apps/housing.pg/src'
growth: './Apps/housing.growth/src'
news: './Apps/housing.news/src'
flatmate: './Apps/housing.flatmate/src'
housing.universalComponents: './Apps/housing.universalComponents/src'
config: './common/config'
common: './common'
```

---

## Critical Micro Frontend Rules

### 🚨 CRITICAL: Boundary Enforcement

**Rule 1: Apps are hermetically sealed**
- ✅ `Apps/housing.demand/src` → `common/utils/helper`
- ✅ `Apps/housing.demand/src` → `graphql/queries/listing`
- ❌ **REJECT PR**: `Apps/housing.demand/src` → `Apps/housing.supply/src`

**Rule 2: Common module isolation**
- ✅ `common/utils/helper.js` → standalone utility
- ❌ **REJECT PR**: `common/utils/helper.js` → `Apps/housing.demand/src`

**Rule 3: Cross-app communication MUST use:**
- Custom events or event bus
- GraphQL API layer
- Global state (minimize)
- **NEVER** direct imports

---

## Code Formatting

### Prettier Configuration

```json
{
  "printWidth": 80,
  "singleQuote": true,
  "semi": false,
  "useTabs": false,
  "tabWidth": 2,
  "trailingComma": "none",
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "avoid",
  "jsxSingleQuote": true
}
```

**Key Rules:**
- Line length: **80 characters max**
- Quotes: **Single quotes** for JS and JSX
- Semicolons: **Omitted**
- Indentation: **2 spaces**
- Trailing commas: **None**
- Arrow functions: Omit parens for single param (`x => x + 1`)

### ESLint Rules

**Enforced:**
- `no-unused-vars`: ERROR
- `react/jsx-no-undef`: ERROR
- `import/no-unused-modules`: ERROR
- `import/no-deprecated`: ERROR

**Disabled:**
- `react/prop-types`: OFF
- `react/display-name`: OFF
- `react/react-in-jsx-scope`: OFF

---

## Component & File Structure

### Folder Organization

```
Apps/housing.[app-name]/src/
├── client/                    # Client-side code
├── server/                    # Server-side code
├── shared/                    # Shared code
│   ├── components/           # UI components
│   ├── pages/                # Route pages
│   ├── hooks/                # Custom hooks
│   ├── services/             # API integrations
│   ├── utils/                # Utilities
│   ├── styles/               # Styles (Linaria)
│   └── constants/            # Constants
└── appConfigWrapper.js
```

### File Constraints

| Constraint | Limit |
|------------|-------|
| File size | ≤ 350 lines |
| Function parameters | ≤ 10 |
| Component complexity | ≤ 200 lines |
| Nesting depth | ≤ 3 levels |

### Export Conventions

- ✅ **Default exports** for React components
- ✅ **Named exports** for utilities (minimal)
- ❌ Don't mix default and multiple named exports

---

## Styling Guidelines

### Framework

- **Linaria** is required for new styles
- ❌ Do NOT create new Emotion files
- ✅ Existing Emotion files are allowed

### Rules

**1. No Component Margins**
```javascript
// ❌ BAD
const Card = styled.div`
  margin: 20px;  // Remove!
`

// ✅ GOOD - Parent controls spacing
const Container = styled.div`
  display: flex;
  gap: 20px;
`
```

**2. No Background Images**
```javascript
// ❌ BAD
const Hero = styled.div`
  background-image: url('/hero.jpg');
`

// ✅ GOOD - Use Image component
import Image from 'common/components/Image'
<Image src="/hero.jpg" alt="Hero" />
```

**3. No Deep Nesting (≤3 levels)**
```javascript
// ❌ BAD
const Container = styled.div`
  .header { .nav { .item { .link { color: red; }}}}
`

// ✅ GOOD
const Container = styled.div`
  .header { }
  .nav { }
  .link { color: red; }
`
```

**4. No Global Styles**
- Keep styles scoped and modular
- Use CSS-in-JS scoping

---

## State Management

### State Scope Decision

| State Type | Solution |
|------------|----------|
| UI state (dropdowns, modals) | `useState` |
| Shared state (same subtree) | `useContext` |
| Global persistent state | Redux (minimize) |
| Server state | React Query / GraphQL |

### Rules

**1. No Inline Empty Objects in mapStateToProps**
```javascript
// ❌ BAD - New object every render
const mapStateToProps = state => ({
  filters: state.filters || {}
})

// ✅ GOOD
const EMPTY_FILTERS = {}
const mapStateToProps = state => ({
  filters: state.filters || EMPTY_FILTERS
})
```

**2. Avoid Prop Drilling (>3 levels)**
```javascript
// ❌ BAD
<GrandParent data={data}>
  <Parent data={data}>
    <Child data={data}>
      <GrandChild data={data}>  // Too deep!

// ✅ GOOD - Use Context
const DataContext = createContext()
<DataContext.Provider value={data}>
  <ComponentTree />
</DataContext.Provider>
```

---

## Performance & Web Vitals

### Targets

| Metric | Target |
|--------|--------|
| LCP | < 2.5s |
| CLS | < 0.1 |
| INP | < 200ms |

### Rules

**1. No Inline Objects in Render**
```javascript
// ❌ BAD
<Component filters={{}} />
<Component onClick={() => handleClick()} />

// ✅ GOOD
const EMPTY_FILTERS = {}
const handleClick = useCallback(() => { }, [])
<Component filters={EMPTY_FILTERS} onClick={handleClick} />
```

**2. Lazy Load Heavy Components (>100kb)**
```javascript
const HeavyChart = lazy(() => import('./HeavyChart'))
```

**3. Memoize Expensive Computations**
```javascript
const sorted = useMemo(
  () => data.sort(expensiveComparator),
  [data]
)
```

**4. Stable Keys in Lists**
```javascript
// ❌ BAD
{items.map((item, idx) => <div key={idx}>)}

// ✅ GOOD
{items.map(item => <div key={item.id}>)}
```

---

## GraphQL Standards

### Schema Rules

- ✅ Maintain backward compatibility (last 2 releases)
- ✅ Support old fields alongside new
- ✅ Use `@deprecated` for removed fields (6-month notice)

```graphql
type Listing {
  price: String @deprecated(reason: "Use priceV2")
  priceV2: Int
}
```

### Query Rules

- ❌ No N+1 queries
- ✅ Use single optimized queries
- ✅ Move business logic to resolvers (not components)

---

## Security & SSR

### SSR Requirements

- ✅ All core data must be server-rendered
- ✅ Check for browser APIs: `typeof window !== 'undefined'`

```javascript
// ❌ BAD - Crashes SSR
const width = window.innerWidth

// ✅ GOOD - Isomorphic
const [width, setWidth] = useState(
  typeof window !== 'undefined' ? window.innerWidth : 1024
)
```

### Security Rules

- ✅ Sanitize all user inputs
- ✅ Sanitize all API responses
- ❌ No hardcoded credentials or API keys
- ❌ No sensitive data in client code

---

## PR Review Checklist

### Code Structure
- [ ] Files ≤ 350 lines
- [ ] Functions ≤ 10 parameters
- [ ] No ambiguous names (misc, stuff, helper)

### Micro Frontend Compliance
- [ ] **NO cross-app imports** (CRITICAL)
- [ ] **NO common importing from apps** (CRITICAL)
- [ ] Independent deployability maintained

### Styling
- [ ] Linaria used (not Emotion) for new files
- [ ] No component margins
- [ ] No background images
- [ ] CSS nesting ≤ 3 levels

### State & Performance
- [ ] No inline empty objects
- [ ] No excessive prop drilling
- [ ] Heavy components lazy loaded
- [ ] Stable keys in lists

### SSR & Security
- [ ] Code is isomorphic
- [ ] No hardcoded credentials
- [ ] Core data server-rendered

---

## Common Issues

### Issue: Cross-App Imports

**Detection:**
```javascript
// ❌ CRITICAL
// In: Apps/housing.demand/src/components/X.js
import { Component } from '../../../housing.supply/src/...'
```

**Solution:**
1. Move to `common/` if truly shared
2. Duplicate if app-specific
3. Use GraphQL API for data exchange

### Issue: Inline Objects

**Detection:**
```javascript
// ❌ BAD
<Component filters={{}} />
```

**Solution:**
```javascript
const EMPTY_FILTERS = {}
<Component filters={EMPTY_FILTERS} />
```

### Issue: SSR-Breaking Code

**Detection:**
```javascript
// ❌ BAD
const width = window.innerWidth
```

**Solution:**
```javascript
const width = typeof window !== 'undefined' ? window.innerWidth : 1024
```

### Issue: Unused Code

**Detection:**
```javascript
// ❌ Import never used
import { changeCity } from 'common/actions/filter/changeCity'
```

**Action:** Remove immediately or add TODO with ticket reference.
