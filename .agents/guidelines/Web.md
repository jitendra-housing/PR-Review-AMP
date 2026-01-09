# Web Development Guidelines - housing.brahmand

This file contains React/JavaScript-specific conventions and patterns for the housing.brahmand monorepo.
**Last Updated:** Based on analysis of Apps (housing.demand, housing.supply, etc.) and common modules.

**Architecture:** Micro Frontend Monorepo with Server-Side Rendering (SSR)

---

## Project Structure

### Monorepo Organization

```
housing.brahmand/
├── Apps/                          # Micro Frontend Applications
│   ├── housing.demand/            # Property buying/renting app
│   ├── housing.supply/            # Property selling app  
│   ├── housing.pg/                # PG/hostel app
│   ├── housing.commercial/        # Commercial properties
│   └── housing.universalComponents/  # Shared component library
│
├── common/                        # Monorepo-wide shared code
│   ├── components/                # Shared React components
│   ├── utils/                     # Utility functions
│   ├── customHooks/               # Shared React hooks
│   ├── styles/                    # Shared styles
│   └── actions/                   # Redux actions
│
└── graphql/                       # GraphQL schema and resolvers
```

### App Structure Pattern

Each micro frontend follows this structure:
```
Apps/housing.{app}/
└── src/
    ├── client/                    # Client-side only code
    ├── server/                    # Server-side only code (SSR)
    └── shared/                    # Isomorphic code (runs on both)
        ├── components/            # App-specific components
        ├── pages/                 # Page components
        ├── hooks/                 # App-specific hooks
        ├── utils/                 # App-specific utilities
        └── constants/             # App constants
```

---

## Styling with Linaria (CRITICAL)

The codebase uses **Linaria** for styling. **Do NOT create new Emotion files.**

### ✅ CORRECT - Linaria Patterns

**Example 1: Using `styled` from Linaria**
```jsx
// From common/components/Tabs/rewrite/style.jsx
import { styled } from '@linaria/react'
import colors from 'common/styles/constants/colors'

export const HeadItemStyle = styled.li`
  margin: 0 10px;
  font-size: 14px;
  display: inline-block;
  color: ${({ isV2 }) => (isV2 ? '#999999' : '#000')};
  padding: 8px 10px;
  cursor: pointer;
  white-space: nowrap;
`
```

**Example 2: Using `css` from Linaria**
```jsx
// From common/components/Tabs/rewrite/style.jsx
import { css } from '@linaria/core'

export const tabContent = css`
  display: none;
`

export const active = css`
  display: block;
  width: 100%;
`

export const headerContainer = css`
  overflow: auto;
  white-space: nowrap;
  text-align: center;
  border-bottom: 1px solid #e6e6e6;
`
```

**Example 3: Using `cx` for className composition**
```jsx
// From common/components/Tabs/rewrite/index.jsx
import { cx } from '@linaria/core'
import { headerContainer, tabContent, active } from './style'

<ul className={cx(headerContainer, classNameHeader)}>
  {data.map((item, index) => (
    <HeadItemStyle
      className={cx(
        index === activeTab && activeHeadItemStyle,
        `${className} ${index === activeTab && 'active'}`
      )}
    >
      {item.name}
    </HeadItemStyle>
  ))}
</ul>
```

### ❌ WRONG - Emotion or Inline Styles

```jsx
// ❌ HIGH severity - Do NOT use Emotion
import styled from '@emotion/styled'  // WRONG!

// ❌ MEDIUM severity - Avoid inline styles
<div style={{ margin: '10px', padding: '8px' }}>  // WRONG!
```

### Style File Organization

**✅ CORRECT:**
- Component: `Tabs/rewrite/index.jsx`
- Styles: `Tabs/rewrite/style.jsx` (colocated)

**Naming:**
- Use `style.jsx` or `{Component}Style.js` for style files
- Keep styles close to components (same directory)

---

## Component Patterns

### Export Conventions

**✅ CORRECT - Default exports for components**
```jsx
// From common/components/Tabs/rewrite/index.jsx
const Tabs = ({ data, style, selected = 0, onChange, ...rest }, ref) => {
  // Component implementation
}

export default React.forwardRef(Tabs)
```

**✅ CORRECT - Named exports for styles**
```jsx
// From common/components/Tabs/rewrite/style.jsx
export const HeadItemStyle = styled.li`...`
export const tabContent = css`...`
export const active = css`...`
```

**✅ CORRECT - Named exports for utilities**
```jsx
// Utils can use named exports
export const formatDate = (date) => {...}
export const numberToCurrency = (num) => {...}
```

### Component Size Limits

- **Files:** ≤ 350 lines of code
- **Components:** Break down if > 200 lines
- **Functions:** ≤ 10 parameters

**Example violation:**
```jsx
// ❌ MEDIUM severity - Too many parameters
function MyComponent(
  prop1, prop2, prop3, prop4, prop5, prop6, 
  prop7, prop8, prop9, prop10, prop11  // 11 parameters!
) {
  // Component code
}

// ✅ CORRECT - Use config object
function MyComponent({ config, callbacks, styles }) {
  // Component code
}
```

### Component Design Principles

**✅ Single Responsibility**
```jsx
// ✅ CORRECT - Each component has one clear purpose
const TabsList = ({ tabs, activeTab, onTabClick }) => {
  return (
    <ul>
      {tabs.map((tab, index) => (
        <TabItem 
          key={index}
          tab={tab} 
          isActive={index === activeTab}
          onClick={() => onTabClick(index)}
        />
      ))}
    </ul>
  )
}
```

**❌ Wrong - Component with margin/padding**
```jsx
// ❌ MEDIUM severity - Component has external spacing
const Card = styled.div`
  padding: 20px;
  margin: 16px;  // ❌ WRONG - breaks reusability
  background: white;
`

// ✅ CORRECT - No external spacing
const Card = styled.div`
  padding: 20px;  // Internal spacing OK
  background: white;
`
// Use wrapper for margin:
<div style={{margin: '16px'}}><Card /></div>
```

---

## Import Patterns & Module Boundaries

### CRITICAL: Common Module Import Rules

**✅ CORRECT - App imports from common/**
```jsx
// From Apps/housing.demand/src/shared/...
import Title from 'common/components/Title'
import connect from 'common/utils/connect'
import useTracking from 'common/customHooks/useTracking'
import colors from 'common/styles/constants/colors'
import rupeeSymbol from 'common/utils/rupeeSymbol'
```

**❌ WRONG - common/ importing from Apps/ (HIGH SEVERITY)**
```jsx
// In common/components/SomeComponent.jsx
import something from 'Apps/housing.demand/...'  // ❌ HIGH severity violation!
import data from '../../Apps/housing.supply/...'  // ❌ HIGH severity violation!
```

**Why HIGH severity:**
- Breaks micro frontend architecture
- Creates circular dependencies
- One app change breaks all apps
- Violates module boundary enforcement

### Import Organization

**✅ CORRECT order:**
```jsx
// 1. External libraries
import React, { useState, useCallback } from 'react'

// 2. Common imports
import connect from 'common/utils/connect'
import useTracking from 'common/customHooks/useTracking'
import colors from 'common/styles/constants/colors'

// 3. Local imports
import Report from './report'
import { postImageReportData } from './actions'
import trackMap from './tracking'
```

---

## State Management (Redux)

### Redux Connect Pattern

**✅ CORRECT - Using custom connect utility**
```jsx
// From common/components/ReportModal/index.jsx
import connect from 'common/utils/connect'
import { postImageReportData } from 'common/actions/imageReport'

const ReportModal = props => {
  const { onClose, image, postImageReportData, listingId } = props
  // Component logic
}

export default connect({
  actions: { postImageReportData }
})(ReportModal)
```

**✅ Keep UI state local**
```jsx
const Tabs = ({ data, selected = 0 }) => {
  const [activeTab, setActiveTab] = useState(selected)  // ✅ Local state
  
  useEffect(() => {
    setActiveTab(selected)
  }, [selected])
  
  return <div>...</div>
}
```

**❌ WRONG - Inline empty objects in mapStateToProps**
```jsx
// ❌ HIGH severity
const mapStateToProps = () => ({})  // WRONG!

// ✅ CORRECT
const mapStateToProps = null  // If no state needed
```

**❌ WRONG - Redux for simple UI state**
```jsx
// ❌ MEDIUM severity - Overkill for local tab state
const mapStateToProps = state => ({
  activeTab: state.ui.activeTab  // WRONG - use local state
})
```

---

## Isomorphic Code (SSR/CSR Compatible)

The codebase uses Server-Side Rendering. Code must work in both environments.

**✅ CORRECT - Environment-agnostic code**
```jsx
import React, { useState, useEffect } from 'react'

const Component = ({ data }) => {
  const [items, setItems] = useState(data)  // ✅ Works on both
  
  useEffect(() => {
    // ✅ Only runs on client
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize)
    }
  }, [])
  
  return <div>{items.map(...)}</div>
}
```

**❌ WRONG - Client-only code**
```jsx
// ❌ HIGH severity - Breaks SSR
const Component = () => {
  const width = window.innerWidth  // ❌ WRONG - crashes on server
  
  localStorage.setItem('key', 'value')  // ❌ WRONG - no localStorage on server
  
  return <div style={{width: `${width}px`}}>...</div>
}

// ✅ CORRECT - Check environment
const Component = () => {
  const [width, setWidth] = useState(0)
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWidth(window.innerWidth)
    }
  }, [])
  
  return <div style={{width: width ? `${width}px` : '100%'}}>...</div>
}
```

---

## Code Quality Rules

### Nesting Levels

**Keep nesting ≤ 3 levels**
```jsx
// ❌ MEDIUM severity - Too much nesting
if (condition1) {
  if (condition2) {
    if (condition3) {
      if (condition4) {  // 4 levels - too much!
        doSomething()
      }
    }
  }
}

// ✅ CORRECT - Early returns
if (!condition1) return
if (!condition2) return
if (!condition3) return
if (!condition4) return
doSomething()
```

### Prop Drilling

**❌ MEDIUM/HIGH severity - Excessive prop drilling**
```jsx
// Passing props through 4+ levels
<GrandParent data={data}>
  <Parent data={data}>
    <Child data={data}>
      <GrandChild data={data} />  // ❌ Prop drilling
```

**✅ CORRECT - Use Context or Redux**
```jsx
import { createContext, useContext } from 'react'

const DataContext = createContext()

<DataContext.Provider value={data}>
  <GrandParent>
    <Parent>
      <Child>
        <GrandChild />  // ✅ Uses useContext(DataContext)
```

---

## Performance Guidelines

### Web Vitals Focus

- **CLS (Cumulative Layout Shift):** Avoid layout shifts
- **LCP (Largest Contentful Paint):** Optimize image loading
- **INP (Interaction to Next Paint):** Minimize JS blocking

### Lazy Loading

**✅ CORRECT - Code splitting**
```jsx
import { lazy, Suspense } from 'react'

const HeavyComponent = lazy(() => import('./HeavyComponent'))

<Suspense fallback={<Loader />}>
  <HeavyComponent />
</Suspense>
```

### Image Optimization

**✅ CORRECT - Use Image component, not background images**
```jsx
import Image from 'common/components/Image'

<Image src={url} alt="Property" />  // ✅ CORRECT
```

**❌ WRONG - Background images**
```jsx
<div style={{backgroundImage: `url(${img})`}} />  // ❌ MEDIUM severity
```

---

## GraphQL Patterns

### Backward Compatibility

- Support last 2 releases for schema changes
- Version breaking changes appropriately
- Don't modify existing fields—add new ones

**✅ CORRECT:**
```graphql
type Property {
  id: ID!
  price: Float!
  priceV2: PriceInfo  # ✅ New field, old field deprecated
}
```

**❌ WRONG:**
```graphql
type Property {
  id: ID!
  price: PriceInfo  # ❌ Breaking change - changed type
}
```

---

## Security & Data Handling

### Server-Side Rendering Security

**✅ All core data must be SSR**
```jsx
// ✅ Data fetched on server, rendered to HTML
export async function getServerSideProps() {
  const data = await fetchCoreData()
  return { props: { data } }
}
```

**❌ WRONG - Core data fetched on client only**
```jsx
// ❌ HIGH severity for critical data
useEffect(() => {
  fetchCoreData().then(setData)  // WRONG for SEO-critical data
}, [])
```

### XSS Prevention

**✅ CORRECT - Sanitize user input**
```jsx
import DOMPurify from 'isomorphic-dompurify'

<div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(userInput)}} />
```

**❌ WRONG - Unsanitized HTML**
```jsx
<div dangerouslySetInnerHTML={{__html: userInput}} />  // ❌ HIGH severity - XSS risk
```

---

## Common Violations Found in Codebase

### 1. Emotion instead of Linaria (HIGH Severity)
```jsx
❌ import styled from '@emotion/styled'
✅ import { styled } from '@linaria/react'
```

### 2. Common module importing from Apps (HIGH Severity)
```jsx
❌ // In common/components/X.jsx
   import Y from 'Apps/housing.demand/...'
✅ // Apps can import from common, not vice versa
```

### 3. Inline empty objects in Redux (MEDIUM Severity)
```jsx
❌ mapStateToProps: () => ({})
✅ mapStateToProps: null
```

### 4. Component with margin/padding (MEDIUM Severity)
```jsx
❌ const Card = styled.div`margin: 16px;`
✅ const Card = styled.div`padding: 20px;` // No margin
```

---

## Quick Reference Checklist

**When reviewing a PR, check:**
1. ✅ Uses Linaria (`@linaria/react`, `@linaria/core`), not Emotion
2. ✅ Components use default export
3. ✅ Files ≤ 350 lines
4. ✅ Components ≤ 200 lines
5. ✅ Functions ≤ 10 parameters
6. ✅ Nesting levels ≤ 3
7. ✅ No `common/` imports from `Apps/` directories
8. ✅ No inline empty objects in `mapStateToProps`
9. ✅ No component margins (only padding)
10. ✅ Code is isomorphic (SSR/CSR compatible)
11. ✅ No background images (use `<Image>` component)
12. ✅ Proper style colocation (`Component.jsx` + `style.jsx`)
13. ✅ Local state for UI, Redux only for shared state
14. ✅ No excessive prop drilling (use Context/Redux)
15. ✅ Accessibility attributes present

---

## Notes for Reviewers

- **Module boundary violations are HIGH severity** - break micro frontend architecture
- **Styling violations (Emotion vs Linaria) are HIGH severity** - inconsistent with codebase
- **SSR compatibility issues are HIGH severity** - break production
- **File size violations are MEDIUM severity** - maintainability issue
- Always reference this file in review comments
- Update this file when new patterns emerge
