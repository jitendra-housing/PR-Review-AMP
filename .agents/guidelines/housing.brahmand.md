# housing.brahmand Repository Guidelines

Comprehensive coding guidelines, patterns, and conventions for the **housing.brahmand** monorepo (https://github.com/elarahq/housing.brahmand).

**Architecture:** Micro Frontend Monorepo with Server-Side Rendering (SSR)  
**Stack:** React, Redux, Linaria, GraphQL, Node.js

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Critical Micro Frontend Rules](#2-critical-micro-frontend-rules)
3. [Code Formatting](#3-code-formatting)
4. [React Component Patterns](#4-react-component-patterns)
5. [Hooks Patterns](#5-hooks-patterns)
6. [JavaScript/ES6 Patterns](#6-javascriptes6-patterns)
7. [Redux Patterns](#7-redux-patterns)
8. [Styling with Linaria](#8-styling-with-linaria)
9. [File Naming Conventions](#9-file-naming-conventions)
10. [Import/Export Patterns](#10-importexport-patterns)
11. [API & Data Fetching Patterns](#11-api--data-fetching-patterns)
12. [Form Handling Patterns](#12-form-handling-patterns)
13. [Event Handling Patterns](#13-event-handling-patterns)
14. [Performance Patterns](#14-performance-patterns)
15. [SSR & Isomorphic Code](#15-ssr--isomorphic-code)
16. [GraphQL Standards](#16-graphql-standards)
17. [Testing Patterns](#17-testing-patterns)
18. [Security Guidelines](#18-security-guidelines)
19. [PR Review Checklist](#19-pr-review-checklist)
20. [Common Violations & Fixes](#20-common-violations--fixes)

---

## 1. Architecture Overview

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
│   ├── components/                   # Shared React components
│   ├── utils/                        # Utility functions
│   ├── customHooks/                  # Shared React hooks
│   ├── styles/                       # Shared styles
│   ├── actions/                      # Redux actions
│   ├── constants/                    # Shared constants
│   └── localStorage/                 # Storage utilities
├── graphql/                           # GraphQL schema and resolvers
├── scripts/                           # Build/deployment scripts
└── tests/                             # Test utilities
```

### App Structure Pattern

Each micro frontend follows this structure:

```
Apps/housing.{app}/src/
├── client/                    # Client-side only code
├── server/                    # Server-side only code (SSR)
└── shared/                    # Isomorphic code (runs on both)
    ├── components/            # App-specific components
    ├── pages/                 # Page components
    ├── hooks/                 # App-specific hooks
    ├── utils/                 # App-specific utilities
    ├── store/                 # Redux store configuration
    └── constants/             # App constants
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

## 2. Critical Micro Frontend Rules

### 🚨 CRITICAL: Boundary Enforcement (HIGH Severity)

**Rule 1: Apps are hermetically sealed**
```javascript
// ✅ ALLOWED
import Title from 'common/components/Title'
import { fetchData } from 'graphql/queries/listing'

// ❌ REJECT PR - Cross-app import
// In: Apps/housing.demand/src/components/X.js
import { Component } from '../../../housing.supply/src/...'
import { helper } from 'supply/utils/helper'
```

**Rule 2: Common module isolation**
```javascript
// ✅ ALLOWED - common is standalone
// In: common/utils/helper.js
import { createReducer } from './createReducer'

// ❌ REJECT PR - common importing from Apps
// In: common/components/SomeComponent.jsx
import something from 'Apps/housing.demand/...'
import data from 'demand/store/selectors'
```

**Rule 3: Cross-app communication MUST use:**
- Custom events or event bus
- GraphQL API layer
- Global state (minimize)
- **NEVER** direct imports

---

## 3. Code Formatting

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

### Formatting Rules Summary

| Rule | Value |
|------|-------|
| Line length | **80 characters max** |
| Quotes | **Single quotes** for JS and JSX |
| Semicolons | **Omitted** (no semicolons) |
| Indentation | **2 spaces** (no tabs) |
| Trailing commas | **None** |
| Arrow function parens | Omit for single param (`x => x + 1`) |
| Bracket spacing | Yes (`{ x }` not `{x}`) |

### ESLint Rules

**Enforced (ERROR):**
- `no-unused-vars` - No unused variables
- `react/jsx-no-undef` - No undefined JSX components
- `import/no-unused-modules` - No unused exports
- `import/no-deprecated` - No deprecated imports
- `dulicate-chunk-name/dulicate-chunk-rule` - No duplicate chunk names

**Disabled (OFF):**
- `react/prop-types` - PropTypes not required
- `react/display-name` - Display name not required
- `react/react-in-jsx-scope` - React import not required

---

## 4. React Component Patterns

### 4.1 Component Definition (REQUIRED Pattern)

**Arrow function component syntax is REQUIRED:**

```javascript
// ✅ CORRECT - Arrow function component
const Accordion = props => {
  const { title, expanded, onClickCallBack = () => {} } = props
  const [isExpanded, setIsExpanded] = useState(expanded)
  
  return (
    <Fragment>
      {/* JSX */}
    </Fragment>
  )
}

export default Accordion

// ❌ WRONG - Function declaration
function Accordion(props) { }

// ❌ WRONG - Class component
class Accordion extends React.Component { }
```

### 4.2 Props Destructuring (REQUIRED)

**Destructure props at the top of the function:**

```javascript
// ✅ CORRECT - Destructure with defaults
const Accordion = props => {
  const {
    title,
    style,
    expanded,
    component: Elem = 'h3',           // Rename with default
    rentDesktop = false,               // Boolean default
    onClickCallBack = () => {},        // Function default
    isCircle = false
  } = props
}

// ❌ WRONG - Access props.x throughout
const Accordion = props => {
  return <div>{props.title}</div>      // Don't do this
}
```

### 4.3 Component Export (REQUIRED)

```javascript
// ✅ CORRECT - Default export for components
export default Accordion

// ✅ CORRECT - forwardRef with default export
export default React.forwardRef(Tabs)

// ✅ CORRECT - Connected component
export default connect({ props, actions })(ComponentName)

// ❌ WRONG - Named export for components
export const Accordion = () => { }
```

### 4.4 Component with forwardRef

```javascript
// ✅ CORRECT Pattern
const SimpleInput = React.forwardRef((props, ref) => {
  const localRef = useRef()
  
  useEffect(() => {
    if (ref) {
      ref.current = localRef.current
    }
  }, [])
  
  return <input ref={localRef} {...props} />
})

export default SimpleInput
```

### 4.5 Component Size Limits

| Constraint | Limit |
|------------|-------|
| File size | ≤ **350 lines** |
| Component body | ≤ **200 lines** |
| Function parameters | ≤ **10 parameters** |
| Nesting depth | ≤ **3 levels** |

```javascript
// ❌ WRONG - Too many parameters
function MyComponent(
  prop1, prop2, prop3, prop4, prop5, prop6, 
  prop7, prop8, prop9, prop10, prop11  // 11 parameters!
) { }

// ✅ CORRECT - Use config object
function MyComponent({ config, callbacks, styles }) { }
```

### 4.6 Fragment Usage

```javascript
// ✅ CORRECT - Use Fragment for multiple elements
import React, { Fragment } from 'react'

return (
  <Fragment>
    <Header />
    <Content />
  </Fragment>
)

// ✅ CORRECT - Short syntax
return (
  <>
    <Header />
    <Content />
  </>
)
```

---

## 5. Hooks Patterns

### 5.1 useState Pattern

```javascript
// ✅ CORRECT - Descriptive names, defaults in destructuring or useState
const [showMore, setShowMore] = useState(!showAll || !__BOT__)
const [isExpanded, setIsExpanded] = useState(expanded)
const [rect, setRect] = useState(null)

// ✅ CORRECT - Lazy initialization for expensive computations
const [data, setData] = useState(() => computeInitialData())

// ❌ WRONG - Non-descriptive names
const [x, setX] = useState(false)
```

### 5.2 useEffect Pattern (CRITICAL)

```javascript
// ✅ CORRECT - Always include dependency array
useEffect(() => {
  if (ref) {
    ref.current = localRef.current
  }
}, [])  // Empty array = run once

// ✅ CORRECT - Separate effects for separate concerns
useEffect(() => {
  // Effect 1: Initialize ref
}, [])

useEffect(() => {
  // Effect 2: Handle focus
  focus && localRef?.current?.focus()
}, [focus])

// ✅ CORRECT - Cleanup function
useEffect(() => {
  const handler = () => { }
  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler)
}, [])

// ❌ WRONG - Missing dependency array
useEffect(() => {
  doSomething()
})  // Will run on every render!

// ❌ WRONG - Missing dependencies
useEffect(() => {
  doSomething(someProp)  // someProp should be in deps
}, [])
```

### 5.3 useMemo Pattern (REQUIRED for expensive operations)

```javascript
// ✅ CORRECT - Memoize sorting/filtering
const amenities = useMemo(
  () =>
    (data || []).slice().sort(function ({ icon: x } = {}, { icon: y } = {}) {
      if (['infoBlack', 'tickCircle'].includes(x)) return 1
      if (['infoBlack', 'tickCircle'].includes(y)) return -1
      return 0
    }),
  [data]
)

// ✅ CORRECT - Memoize computed values
const totalPrice = useMemo(
  () => items.reduce((sum, item) => sum + item.price, 0),
  [items]
)

// ❌ WRONG - Inline computation on every render
const sorted = data.sort(expensiveComparator)  // Don't do this
```

### 5.4 useCallback Pattern

```javascript
// ✅ CORRECT - Stabilize callback passed to children
const getDefaultValue = useCallback(({ value }) => value, [])

const handleClick = useCallback(() => {
  setIsExpanded(!isExpanded)
  onClickCallBack()
}, [isExpanded, onClickCallBack])

// ✅ CORRECT - Pass to memoized children
<MemoizedChild onClick={handleClick} />

// ❌ WRONG - Inline function creates new reference
<Component onClick={() => handleClick()} />  // New function every render
```

### 5.5 useRef Pattern

```javascript
// ✅ CORRECT - DOM reference
const localRef = useRef()
<input ref={localRef} />

// ✅ CORRECT - Mutable value that doesn't trigger re-render
const timerRef = useRef(null)
timerRef.current = setTimeout(() => {}, 1000)

// ✅ CORRECT - Forwarding ref
const Component = React.forwardRef((props, ref) => {
  const localRef = useRef()
  
  useEffect(() => {
    if (ref) ref.current = localRef.current
  }, [])
  
  return <div ref={localRef} />
})
```

### 5.6 Custom Hooks Pattern

**Naming: Always prefix with `use`**

```javascript
// ✅ CORRECT - Custom hook structure
function useClientRect() {
  const [rect, setRect] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) {
      const { top, bottom, left, right, width, height } = 
        ref.current.getBoundingClientRect()
      setRect({ top, left, width, height, bottom, right })
    }
  }, [ref.current])
  
  return [rect, ref]  // Return array or object
}

export default useClientRect

// Usage
const [rect, ref] = useClientRect()
```

**Custom Hooks in Repository:**
- `useEventListener` - Event delegation wrapper
- `useExecuteOnce` - Execute function once
- `useLocalStorage` - localStorage binding with caching
- `useOnClickOutside` - Click outside detection
- `useTracking` - Event tracking wrapper
- `useClientRect` - Get element dimensions
- `useOnScreenCb` - Intersection observer callback

---

## 6. JavaScript/ES6 Patterns

### 6.1 Destructuring Conventions

**Object Destructuring with Defaults:**
```javascript
// ✅ CORRECT
const { value = '', type = 'text', onFocus, placeholder } = props

// ✅ CORRECT - Nested destructuring
const {
  filters: {
    category,
    entities,
    selectedCity: { id: cityId, name: cityName } = {}
  } = {}
} = reduxState || {}

// ✅ CORRECT - Renaming with default
const { component: Elem = 'h3' } = props
```

**Array Destructuring:**
```javascript
// ✅ CORRECT
const [rect, ref] = useClientRect()
const [showMore, setShowMore] = useState(false)
```

**Function Parameter Destructuring:**
```javascript
// ✅ CORRECT
export default ({ 
  props = () => ({}), 
  actions = dispatch => ({ dispatch }), 
  options = {} 
} = {}) => connect(props, actions, null, options)
```

### 6.2 Spread Operator Usage

```javascript
// ✅ CORRECT - Object spreading
return { ...state, data: { ...state.data, ...payload } }

// ✅ CORRECT - Props spreading
<Component {...restProps} />
<Component {...props} {...field} />

// ✅ CORRECT - Array spreading with copy
const updatedArr = [...(state.data[serviceType] || [])]
const amenities = (data || []).slice()

// ❌ WRONG - Mutating original array
state.data.push(newItem)  // Never mutate!
```

### 6.3 Arrow Function Conventions

```javascript
// ✅ CORRECT - Single parameter (no parentheses)
const handler = e => { }
const double = x => x * 2

// ✅ CORRECT - Multiple parameters (with parentheses)
const onChange = (value, e) => { }

// ✅ CORRECT - No parameters
const ready = () => {}
onClickCallBack = () => {}

// ✅ CORRECT - Implicit return (single expression)
const sortOptions = (product, isMobile = false) => [...]
const getUrl = path => `${baseUrl}${path}`

// ✅ CORRECT - Object return (wrap in parentheses)
const getCoords = () => ({ x: 0, y: 0 })
```

### 6.4 Async/Await Patterns

```javascript
// ✅ CORRECT - Thunk with async/await
const fetchDashboardData = id => async (dispatch, getState, { fetch }) => {
  const { login: { id: idState } = {} } = getState()
  
  const hpData = await fetch({ apiName: 'HP_DATA', ... })
  const gstDetails = await fetch({ apiName: 'GST', ... })
  
  return { hpData, gstDetails }
}

// ✅ CORRECT - Promise chain (also acceptable)
return fetch({...}).then(
  ({ data: { data: { result } = {} } }) => result
)
```

### 6.5 Error Handling Patterns

```javascript
// ✅ CORRECT - localStorage error handling
const getItemFromStorage = (key, { initialValue, type = 'localStorage' } = {}) => {
  let value
  try {
    value = window[type].getItem(key)
    if (value) {
      try {
        value = JSON.parse(value)
      } catch (e) {}  // Silent catch for JSON parse
    }
  } catch (error) {
    console.log('LOCAL STORAGE ERROR', type, key)
  }
  return value || initialValue
}

// ✅ CORRECT - catchError utility pattern
export default function catchError(callback, defaultValue) {
  try {
    return [callback()]
  } catch (error) {
    return [defaultValue, error]
  }
}

// ✅ CORRECT - Conditional error handling
try {
  const operation = value === undefined ? 'removeItem' : 'setItem'
  window[type][operation](key, value)
} catch (error) {}
```

### 6.6 Conditional Expressions

```javascript
// ✅ CORRECT - Ternary for simple conditions
const displayValue = isActive ? 'Active' : 'Inactive'

// ✅ CORRECT - && for conditional rendering
{isExpanded && <ExpandedContent />}

// ✅ CORRECT - || for defaults
const name = props.name || 'Default Name'

// ✅ CORRECT - Optional chaining
const city = user?.address?.city
localRef?.current?.focus()

// ✅ CORRECT - Nullish coalescing
const value = props.value ?? defaultValue
```

---

## 7. Redux Patterns

### 7.1 createReducer Pattern (REQUIRED)

**All reducers MUST use `createReducer` utility:**

```javascript
// ✅ CORRECT - Using createReducer
import { createReducer } from 'common/utils/createReducer'

const initialState = {
  favoritesRequested: false,
  data: { project: [], rent: [], resale: [] },
  savedSearchesLoading: true,
  savedSearches: { data: [] }
}

export default createReducer(initialState, {
  SET_FAVORITES: (state, payload) => ({
    ...state,
    data: { ...state.data, ...payload }
  }),

  UPDATE_FAVORITES: (state, { serviceType, serviceTypeObjectId, add }) => {
    let updatedArr = [...(state.data[serviceType] || [])]
    if (add) {
      updatedArr.push(serviceTypeObjectId)
    } else {
      updatedArr = updatedArr.filter(item => item !== serviceTypeObjectId)
    }
    return { ...state, data: { ...state.data, [serviceType]: updatedArr } }
  },

  SET_SAVED_SEARCHES: (state, payload) => ({
    ...state,
    savedSearches: { 
      ...state.savedSearches, 
      data: { ...payload }, 
      savedSearchesLoading: false 
    }
  })
})
```

### 7.2 Action Type Naming

**ALL_CAPS with underscores:**
```javascript
// ✅ CORRECT
SET_FAVORITES
UPDATE_FAVORITES
SHOW_PROFILE_RED_DOT
SET_SAVED_SEARCHES
FETCH_USER_DATA_SUCCESS

// ❌ WRONG
setFavorites
set-favorites
SetFavorites
```

### 7.3 Thunk Action Pattern

```javascript
// ✅ CORRECT - Thunk with fetch context
const changeUserActivation = (activationStatus = 'activate') => (
  _,           // dispatch (unused, use underscore)
  __,          // getState (unused)
  { fetch }    // middleware context
) => {
  return fetch({
    apiName: 'CHANGE_USER_ACTIVATION',
    controller: 'CHANGE_USER_ACTIVATION',
    method: 'post',
    body: {
      query: changeUserActivationMutation,
      variables: { activationStatus }
    }
  }).then(({ data: { data: { changeUserActivation: { success, message } } = {} } }) => {
    return { success, message }
  })
}

export default changeUserActivation
```

### 7.4 Connect Pattern

```javascript
// ✅ CORRECT - Using connect utility
import connect from 'common/utils/connect'

const MobileDeveloperCard = ({ propertyDetails, metaData, getHistory }) => {
  // Component implementation
}

const props = ({ meta: metaData, propertyDetails }) => ({
  propertyDetails,
  metaData
})

const actions = { getHistory }  // Or dispatch => ({ dispatch, getHistory: id => dispatch(getHistory(id)) })

export default connect({ props, actions })(MobileDeveloperCard)
```

### 7.5 mapStateToProps Pattern (CRITICAL)

```javascript
// ✅ CORRECT - Destructure state, return object
const props = ({ meta: metaData, propertyDetails }) => ({
  propertyDetails,
  metaData
})

// ✅ CORRECT - Nested destructuring
const props = ({ shell: { userAgent: { isiPhone } = {} } = {} }) => ({
  isiPhone
})

// ❌ WRONG - Inline empty object (creates new reference every render)
const mapStateToProps = state => ({
  filters: state.filters || {}  // ❌ New object every render!
})

// ✅ CORRECT - Use constant for empty object
const EMPTY_FILTERS = {}
const mapStateToProps = state => ({
  filters: state.filters || EMPTY_FILTERS
})
```

### 7.6 Immutable State Updates (CRITICAL)

```javascript
// ✅ CORRECT - Always spread, never mutate
SET_DATA: (state, payload) => ({
  ...state,
  data: { ...state.data, ...payload }
})

// ✅ CORRECT - Array updates
UPDATE_LIST: (state, { id, add }) => {
  let updatedArr = [...state.list]  // Copy first
  if (add) {
    updatedArr.push(id)
  } else {
    updatedArr = updatedArr.filter(item => item !== id)
  }
  return { ...state, list: updatedArr }
}

// ❌ WRONG - Direct mutation
state.data.push(newItem)  // NEVER do this!
state.count = state.count + 1  // NEVER do this!
```

---

## 8. Styling with Linaria

### 8.1 Framework Rules (CRITICAL)

- **Linaria is REQUIRED** for all new styles
- **Do NOT create new Emotion files**
- Existing Emotion files are allowed (legacy)

```javascript
// ✅ CORRECT - Linaria imports
import { css } from '@linaria/core'
import { styled } from '@linaria/react'
import { cx } from '@linaria/core'

// ❌ WRONG - Emotion imports (for new files)
import styled from '@emotion/styled'  // REJECT for new files
import { css } from '@emotion/react'  // REJECT for new files
```

### 8.2 styled Pattern

```javascript
// ✅ CORRECT - styled component
import { styled } from '@linaria/react'
import colors from 'common/styles/constants/colors'

export const HeadItemStyle = styled.li`
  margin: 0 10px;
  font-size: 14px;
  display: inline-block;
  color: ${({ isV2 }) => (isV2 ? '#999999' : '#000')};
  padding: 8px 10px;
  cursor: pointer;
`

export const AccordionContentWrapper = styled.div`
  max-height: ${({ isExpanded }) => (isExpanded ? '100vh' : '0')};
  overflow: hidden;
  transition: max-height 0.3s ease;
`
```

### 8.3 css Pattern

```javascript
// ✅ CORRECT - css for className
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
  border-bottom: 1px solid #e6e6e6;
`
```

### 8.4 cx for className Composition

```javascript
// ✅ CORRECT - Combining classNames
import { cx } from '@linaria/core'

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

### 8.5 No Component Margins (CRITICAL)

```javascript
// ❌ WRONG - Component with margin
const Card = styled.div`
  margin: 20px;  // REMOVE! Breaks reusability
  padding: 16px;
`

// ✅ CORRECT - Only internal spacing
const Card = styled.div`
  padding: 16px;  // Internal spacing OK
  background: white;
`

// ✅ CORRECT - Parent controls spacing
const Container = styled.div`
  display: flex;
  gap: 20px;  // Parent controls spacing between children
`
```

### 8.6 No Background Images

```javascript
// ❌ WRONG - Background image in CSS
const Hero = styled.div`
  background-image: url('/hero.jpg');
  background-size: cover;
`

// ✅ CORRECT - Use Image component
import Image from 'common/components/Image'

<div className={heroContainer}>
  <Image src="/hero.jpg" alt="Hero" />
</div>
```

### 8.7 No Deep Nesting (≤3 levels)

```javascript
// ❌ WRONG - Too deep
const Container = styled.div`
  .header {
    .nav {
      .item {
        .link {  // 4 levels - too deep!
          color: red;
        }
      }
    }
  }
`

// ✅ CORRECT - Flat structure
const Container = styled.div`
  .header { }
  .nav { }
  .item { }
  .link { color: red; }
`
```

### 8.8 No Global Styles

```javascript
// ❌ WRONG - Global styles
const globalStyles = css`
  body { margin: 0; }
  * { box-sizing: border-box; }
`

// ✅ CORRECT - Scoped component styles
const ComponentWrapper = styled.div`
  box-sizing: border-box;
  margin: 0;
`
```

---

## 9. File Naming Conventions

### 9.1 Component Files

| File | Naming |
|------|--------|
| Main component | `index.jsx` |
| Folder | PascalCase (`Accordion/`, `Button/`) |

```
Components/
├── Accordion/
│   ├── index.jsx        # Main component
│   ├── style.jsx        # Styles
│   └── tracking.jsx     # Tracking events
├── Button/
│   └── rewrite/         # Refactored version
│       ├── index.jsx
│       └── style.jsx
```

### 9.2 Style Files

| Convention | Value |
|------------|-------|
| File name | `style.jsx` (not `styles.jsx`) |
| Location | Same directory as component |

### 9.3 Test Files

| Convention | Value |
|------------|-------|
| Extension | `*.spec.js` (not `.test.js`) |
| Location | `__tests__/` directory |

### 9.4 Utility Files

| Type | Naming |
|------|--------|
| Utilities | camelCase: `buildURL.js`, `catchError.js` |
| Actions | camelCase, verb-based: `getHistory.js`, `fetchDetails.js` |
| Constants | camelCase file, UPPER_CASE exports |

### 9.5 Responsive Variants

```
ComponentName/
├── mobile/
│   ├── index.jsx
│   └── style.jsx
├── desktop/
│   ├── index.jsx
│   └── style.jsx
└── index.jsx          # Wrapper that chooses variant
```

---

## 10. Import/Export Patterns

### 10.1 Import Order (REQUIRED)

```javascript
// 1. React imports
import React, { useState, useEffect, useRef } from 'react'

// 2. External libraries
import { cx } from '@linaria/core'

// 3. Common imports
import useTracking from 'common/customHooks/useTracking'
import connect from 'common/utils/connect'
import { textEllipsis } from 'common/styles/mixins/rewrite/style'

// 4. Local relative imports
import {
  inpContStyle,
  msgStyle,
  labelStyle
} from './style'
```

### 10.2 Export Patterns

**Components - Default Export:**
```javascript
// ✅ CORRECT
export default Accordion
export default React.forwardRef(Tabs)
export default connect({ props, actions })(Component)
```

**Utilities - Named or Default:**
```javascript
// ✅ CORRECT - Default for primary function
export default useLocalStorage

// ✅ CORRECT - Named for multiple exports
export const setItemToStorage = (key, value) => { }
export const getItem = (key) => { }
```

**Constants - Named Export:**
```javascript
// ✅ CORRECT - Named exports for constants
export const APARTMENT_TYPES = { }
export const DISTANCE_OPTIONS = [ ]
```

**Styles - Named Export:**
```javascript
// ✅ CORRECT - Named exports for styles
export const HeadItemStyle = styled.li``
export const tabContent = css``
export const active = css``
```

### 10.3 Barrel Exports

```javascript
// common/customHooks/index.js
export { default as useTracking } from './useTracking'
export { default as useLocalStorage } from './useLocalStorage'
export { default as useClientRect } from './useClientRect'
```

---

## 11. API & Data Fetching Patterns

### 11.1 GraphQL Query Pattern

```javascript
import gql from 'graphql-tag'

const changeUserActivationMutation = gql`
  mutation($activationStatus: String!) {
    changeUserActivation(activationStatus: $activationStatus) {
      success
      message
    }
  }
`
```

### 11.2 Fetch Pattern in Thunks

```javascript
// ✅ CORRECT - Fetch configuration
return fetch({
  apiName: 'API_IDENTIFIER',        // Required
  controller: 'CONTROLLER_NAME',    // Required
  method: 'post',                   // HTTP method
  body: {
    query: graphqlQuery,
    variables: { param1, param2 }
  }
}).then(({ data: { data: { result } = {} } }) => result)
```

### 11.3 Loading State Pattern

```javascript
// In reducer
const initialState = {
  isLoading: true,
  data: null,
  error: null
}

FETCH_START: state => ({ ...state, isLoading: true }),
FETCH_SUCCESS: (state, payload) => ({ ...state, isLoading: false, data: payload }),
FETCH_ERROR: (state, error) => ({ ...state, isLoading: false, error })

// In component
{isLoading ? <Loader /> : <Content data={data} />}
```

### 11.4 Intersection Observer Pattern (Lazy Loading)

```javascript
const [isIntersecting, setIsIntersecting] = useState(__BOT__ || ssr)
const [ref] = useOnScreenCb({
  rootMargin: '100px',
  onChange: ({ isIntersecting: isSectionIntersecting }) => {
    setIsIntersecting(isSectionIntersecting)
  }
})

return isIntersecting ? (
  <HeavyComponent {...props} />
) : (
  <div ref={ref}>
    <Loader height='200px' />
  </div>
)
```

---

## 12. Form Handling Patterns

### 12.1 Form Component Pattern

```javascript
// ✅ CORRECT - Form with fields array
<Form
  fields={[
    {
      key: 'email',
      type: 'email',
      title: 'Email Address',
      placeholder: 'Enter email',
      value: formData.email,
      error: errors.email && 'Invalid email',
      onChange: ({ value }) => setFormData({ ...formData, email: value })
    },
    {
      key: 'password',
      type: 'password',
      title: 'Password',
      value: formData.password,
      onChange: ({ value }) => setFormData({ ...formData, password: value })
    }
  ]}
/>
```

### 12.2 Input Change Handler

```javascript
// ✅ CORRECT - onChange accepts (value, event)
const onChange = e => {
  const { value } = e.target
  if (!isCharacterLimitApplicable || value?.length <= characterLimit) {
    props.onChange(value, e)
  }
}
```

---

## 13. Event Handling Patterns

### 13.1 onClick Handlers

```javascript
// ✅ CORRECT - Arrow function, no params when not needed
onClick={() => {
  setIsExpanded(!isExpanded)
  onClickCallBack()
}}

// ✅ CORRECT - With event parameter
onClick={e => {
  e.preventDefault()
  handleClick()
}}
```

### 13.2 onChange Handlers

```javascript
// ✅ CORRECT - Extract value, call parent handler
const onChange = e => {
  const { value } = e.target
  props.onChange(value, e)
}
```

### 13.3 onFocus/onBlur with Tracking

```javascript
// ✅ CORRECT - Conditional tracking
const onInputFocus = () => {
  eventContract?.ON_FOCUS && track(eventContract.ON_FOCUS, { inputValue: value })
  !props.readOnly && setIsReadOnly(props.readOnly)
  onFocus?.()
}
```

---

## 14. Performance Patterns

### 14.1 Web Vitals Targets

| Metric | Target |
|--------|--------|
| LCP (Largest Contentful Paint) | < 2.5s |
| CLS (Cumulative Layout Shift) | < 0.1 |
| INP (Interaction to Next Paint) | < 200ms |

### 14.2 No Inline Objects in JSX (CRITICAL)

```javascript
// ❌ WRONG - New object every render
<Component filters={{}} />
<Component style={{ margin: 0 }} />
<Component onClick={() => handleClick()} />

// ✅ CORRECT - Stable references
const EMPTY_FILTERS = {}
const RESET_STYLE = { margin: 0 }
const handleClick = useCallback(() => { }, [])

<Component filters={EMPTY_FILTERS} />
<Component style={RESET_STYLE} />
<Component onClick={handleClick} />
```

### 14.3 Lazy Loading Heavy Components

```javascript
// ✅ CORRECT - Code splitting for >100kb components
import { lazy, Suspense } from 'react'

const HeavyChart = lazy(() => import('./HeavyChart'))

<Suspense fallback={<Loader />}>
  <HeavyChart />
</Suspense>
```

### 14.4 Stable Keys in Lists (CRITICAL)

```javascript
// ❌ WRONG - Index as key
{items.map((item, idx) => <div key={idx}>{item.name}</div>)}

// ✅ CORRECT - Unique stable ID
{items.map(item => <div key={item.id}>{item.name}</div>)}
```

### 14.5 Image Optimization

```javascript
// ❌ WRONG - Background images
<div style={{ backgroundImage: `url(${img})` }} />

// ✅ CORRECT - Image component
import Image from 'common/components/Image'
<Image src={url} alt="Description" />
```

---

## 15. SSR & Isomorphic Code

### 15.1 Check for Browser APIs (CRITICAL)

```javascript
// ❌ WRONG - Crashes on server
const width = window.innerWidth
localStorage.setItem('key', 'value')
document.getElementById('root')

// ✅ CORRECT - Check environment first
const [width, setWidth] = useState(
  typeof window !== 'undefined' ? window.innerWidth : 1024
)

useEffect(() => {
  if (typeof window !== 'undefined') {
    setWidth(window.innerWidth)
    localStorage.setItem('key', 'value')
  }
}, [])
```

### 15.2 SSR-Safe localStorage

```javascript
// ✅ CORRECT - Try-catch for localStorage
const getItemFromStorage = (key, { initialValue } = {}) => {
  let value
  try {
    value = window.localStorage.getItem(key)
    if (value) {
      try { value = JSON.parse(value) } catch (e) {}
    }
  } catch (error) {
    console.log('LOCAL STORAGE ERROR', key)
  }
  return value || initialValue
}
```

### 15.3 Conditional Server/Client Rendering

```javascript
// ✅ CORRECT - Use __BOT__ or ssr flags
const [isIntersecting, setIsIntersecting] = useState(__BOT__ || ssr)

// ✅ CORRECT - Sequential rendering check
useEffect(() => {
  isSequenced && ready(index)
}, [])

if (isSequenced && !render) {
  return <SequentialLoader />
}
```

---

## 16. GraphQL Standards

### 16.1 Backward Compatibility (CRITICAL)

- Support last 2 releases for schema changes
- Don't modify existing fields—add new ones
- Use `@deprecated` directive

```graphql
# ✅ CORRECT
type Property {
  id: ID!
  price: Float @deprecated(reason: "Use priceV2 instead")
  priceV2: PriceInfo  # New field
}

# ❌ WRONG - Breaking change
type Property {
  id: ID!
  price: PriceInfo  # Changed type - breaks clients!
}
```

### 16.2 Query Optimization

- No N+1 queries
- Use single optimized queries
- Move business logic to resolvers (not components)

---

## 17. Testing Patterns

### 17.1 Test File Structure

```javascript
// ✅ CORRECT - Test file pattern
import { renderHook, act } from '@testing-library/react'
import useTracking from '../useTracking.jsx'

describe('useTracking', () => {
  it('should return a track function', () => {
    const { result } = renderHook(() => useTracking())
    expect(typeof result.current).toBe('function')
  })
  
  it('should track events correctly', () => {
    // Test implementation
  })
})
```

### 17.2 Naming Convention

- Test files: `*.spec.js`
- Describe blocks: Component/Hook name
- It blocks: 'should' + expected behavior

---

## 18. Security Guidelines

### 18.1 XSS Prevention

```javascript
// ❌ WRONG - Unsanitized HTML
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ CORRECT - Sanitize first
import DOMPurify from 'isomorphic-dompurify'
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```

### 18.2 No Hardcoded Credentials

```javascript
// ❌ WRONG
const API_KEY = 'sk-1234567890'
const DB_PASSWORD = 'secret123'

// ✅ CORRECT - Environment variables
const API_KEY = process.env.API_KEY
```

---

## 19. PR Review Checklist

### Code Style & Formatting
- [ ] Single quotes, no semicolons
- [ ] 2-space indentation
- [ ] Line length ≤ 80 characters
- [ ] Arrow function components

### Micro Frontend Compliance (CRITICAL)
- [ ] **NO cross-app imports**
- [ ] **NO common importing from Apps**
- [ ] Uses import aliases correctly

### React Patterns
- [ ] Props destructured at top
- [ ] Default exports for components
- [ ] useEffect has dependency array
- [ ] useMemo for expensive computations
- [ ] useCallback for stable callbacks

### Redux Patterns
- [ ] Uses createReducer utility
- [ ] Action types are ALL_CAPS
- [ ] No inline empty objects in mapStateToProps
- [ ] Immutable state updates (spread, never mutate)

### Styling (CRITICAL)
- [ ] Linaria used (not Emotion) for new files
- [ ] No component margins (only padding)
- [ ] No background images
- [ ] CSS nesting ≤ 3 levels
- [ ] Uses cx for className composition

### Performance
- [ ] No inline objects in JSX
- [ ] No inline functions in JSX (use useCallback)
- [ ] Stable keys in lists (not index)
- [ ] Heavy components lazy loaded

### SSR Compatibility (CRITICAL)
- [ ] No direct window/document/localStorage access
- [ ] typeof window !== 'undefined' checks
- [ ] Code is isomorphic

### File Organization
- [ ] Files ≤ 350 lines
- [ ] Components ≤ 200 lines
- [ ] Functions ≤ 10 parameters
- [ ] Correct file naming (style.jsx, index.jsx)

---

## 20. Common Violations & Fixes

### Violation 1: Cross-App Import (HIGH)

```javascript
// ❌ DETECTED
import { Component } from '../../../housing.supply/src/...'

// ✅ FIX: Move to common/ or duplicate
import { Component } from 'common/components/Component'
```

### Violation 2: Emotion in New File (HIGH)

```javascript
// ❌ DETECTED
import styled from '@emotion/styled'

// ✅ FIX: Use Linaria
import { styled } from '@linaria/react'
```

### Violation 3: Inline Empty Object (MEDIUM)

```javascript
// ❌ DETECTED
const mapStateToProps = state => ({
  filters: state.filters || {}
})

// ✅ FIX: Use constant
const EMPTY_FILTERS = {}
const mapStateToProps = state => ({
  filters: state.filters || EMPTY_FILTERS
})
```

### Violation 4: SSR-Breaking Code (HIGH)

```javascript
// ❌ DETECTED
const width = window.innerWidth

// ✅ FIX: Check environment
const width = typeof window !== 'undefined' ? window.innerWidth : 1024
```

### Violation 5: Index as Key (MEDIUM)

```javascript
// ❌ DETECTED
{items.map((item, idx) => <div key={idx}>)}

// ✅ FIX: Use unique ID
{items.map(item => <div key={item.id}>)}
```

### Violation 6: Missing useEffect Dependencies (MEDIUM)

```javascript
// ❌ DETECTED
useEffect(() => {
  fetchData(userId)
}, [])  // userId missing

// ✅ FIX: Include all dependencies
useEffect(() => {
  fetchData(userId)
}, [userId])
```

### Violation 7: Component with Margin (MEDIUM)

```javascript
// ❌ DETECTED
const Card = styled.div`
  margin: 20px;
`

// ✅ FIX: Remove margin, use parent for spacing
const Card = styled.div`
  padding: 16px;
`
```

### Violation 8: Function Declaration Component (LOW)

```javascript
// ❌ DETECTED
function MyComponent(props) { }

// ✅ FIX: Use arrow function
const MyComponent = props => { }
```

### Violation 9: Unused Import (MEDIUM)

```javascript
// ❌ DETECTED
import { changeCity } from 'common/actions/filter/changeCity'
// changeCity never used

// ✅ FIX: Remove unused import
```

### Violation 10: Deep CSS Nesting (LOW)

```javascript
// ❌ DETECTED
const Container = styled.div`
  .a { .b { .c { .d { color: red; }}}}
`

// ✅ FIX: Flatten
const Container = styled.div`
  .a { }
  .b { }
  .c { }
  .d { color: red; }
`
```
