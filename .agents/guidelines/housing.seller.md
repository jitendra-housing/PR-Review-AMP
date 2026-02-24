# housing.seller Repository Guidelines

Comprehensive coding guidelines, patterns, and conventions for the **housing.seller** repository (https://github.com/elarahq/housing.seller).

**Framework:** React 16.8+, Redux, React Router v6  
**Styling:** Emotion CSS-in-JS, SCSS (legacy)  
**Build:** Webpack 5, Babel 7  
**Testing:** Jest, React Testing Library

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Code Formatting](#2-code-formatting)
3. [React Component Patterns](#3-react-component-patterns)
4. [Hooks Patterns](#4-hooks-patterns)
5. [JavaScript/ES6 Patterns](#5-javascriptes6-patterns)
6. [Redux Patterns](#6-redux-patterns)
7. [Styling Patterns](#7-styling-patterns)
8. [File Naming Conventions](#8-file-naming-conventions)
9. [Import/Export Patterns](#9-importexport-patterns)
10. [API Patterns](#10-api-patterns)
11. [Routing Patterns](#11-routing-patterns)
12. [SSR & Isomorphic Code](#12-ssr--isomorphic-code)
13. [Testing Patterns](#13-testing-patterns)
14. [Performance Patterns](#14-performance-patterns)
15. [PR Review Checklist](#15-pr-review-checklist)
16. [Common Violations & Fixes](#16-common-violations--fixes)

---

## 1. Project Overview

### Technology Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 16.8+, Redux, React Router v6 |
| Styling | Emotion CSS-in-JS, SCSS/PostCSS |
| Build | Webpack 5, Babel 7 |
| Testing | Jest, React Testing Library |
| Linting | StandardJS, Prettier |
| Node Version | v18.14.2 |

### Repository Structure

```
src/
├── app.js                 # Main application entry
├── index.html             # HTML template
├── actions/               # Redux action creators
├── components/            # Reusable UI components
│   ├── commonComponents/  # Shared components
│   ├── Button/
│   ├── CircularTimer/
│   └── errorBoundary/
├── config/                # Configuration files
├── constants/             # Application constants
├── customHooks/           # Custom React hooks
├── helpers/               # Utility helper functions
├── lib/                   # Library code
├── reducers/              # Redux reducers
├── routes/                # Route definitions
├── server/                # SSR code
├── store/                 # Redux store configuration
├── styles/                # Global styles (SCSS)
├── tests/                 # Test setup and mocks
├── trackers/              # Analytics tracking
├── utils/                 # Utility functions
└── views/                 # Page-level components
    ├── dashboard/
    ├── leads/
    └── ownerDashboard/
```

### Dual Shell Architecture

- **Main Content:** Renders into `#app-root`
- **Navigation:** Renders into `#shell-root`
- Conditional mobile/desktop rendering based on user agent

---

## 2. Code Formatting

### StandardJS + Prettier

**Configuration:**
- Parser: `babel-eslint`
- Print width: **100 characters**
- Single quotes
- No semicolons

### Formatting Rules

| Rule | Value |
|------|-------|
| Print width | **100 characters** |
| Quotes | **Single quotes** |
| Semicolons | **None** (StandardJS) |
| Indentation | **2 spaces** |
| Trailing commas | **None** |

### Pre-commit Hooks (lint-staged)

```json
"*.js": [
  "prettier-standard --print-width 100",
  "standard --env jest --parser babel-eslint --fix"
],
"*.scss": ["prettier --write"],
"*.{png,jpg,jpeg}": ["optimize-images"]
```

---

## 3. React Component Patterns

### 3.1 Functional Components (REQUIRED for new code)

```javascript
// ✅ CORRECT - Functional component with hooks
/** @jsx jsx */
import { jsx } from '@emotion/react'
import { btnStyle } from './style'
import classNames from 'classnames'

const Button = ({ children, style, className, dispatch, ...props }) => {
  const btn = (
    <button
      data-testid='buttonId'
      className={classNames('button', className)}
      css={[btnStyle, style]}
      {...props}
    >
      {children}
    </button>
  )
  return btn
}

export default Button
```

### 3.2 Component Requirements

1. **Use PascalCase** for component names
2. **Destructure props** at function signature
3. **Use spread operator** `{...props}` for remaining props
4. **Default export** for single component
5. **Include `data-testid`** for testable elements
6. **Import JSX pragma** when using Emotion

### 3.3 Class Components (Legacy Only)

```javascript
// ⚠️ LEGACY - Only maintain existing, don't create new
export default class RazorPay extends React.Component {
  constructor (props) {
    super(props)
    this.state = {}
  }
  
  render () {
    return <div>...</div>
  }
}
```

**Rules:**
- Only maintain existing class components
- New components MUST be functional
- Use `autoBind` for method binding if unavoidable

### 3.4 HOC Pattern (Higher-Order Components)

```javascript
// Pattern: connect + withRouter
export default connect(mapStateToProps, mapDispatchToProps)(
  withRouter(ComponentName)
)
```

### 3.5 Mobile/Desktop Variants

```javascript
// Component structure
ComponentName/
├── index.js      # Main wrapper
├── desktop.js    # Desktop variant
├── mobile.js     # Mobile variant
└── style.js      # Shared styles

// In index.js
const Component = isMobile ? MobileComponent : DesktopComponent
```

---

## 4. Hooks Patterns

### 4.1 useState Pattern

```javascript
// ✅ CORRECT
const [isRunning, setIsRunning] = useState(false)
const [timeLeft, setTimeLeft] = useState(duration)
const [formData, setFormData] = useState({ name: '', email: '' })

// ✅ CORRECT - Lazy initialization
const [data, setData] = useState(() => computeExpensiveValue())
```

### 4.2 useEffect Pattern (CRITICAL)

```javascript
// ✅ CORRECT - With cleanup and dependencies
useEffect(() => {
  if (!isRunning) return

  const timer = setInterval(() => {
    setTimeLeft(prevTime => {
      if (prevTime <= 1) {
        clearInterval(timer)
        setIsRunning(false)
        onComplete && onComplete()
        return 0
      }
      return prevTime - 1
    })
  }, 1000)

  return () => clearInterval(timer)  // REQUIRED cleanup
}, [isRunning, onComplete])  // REQUIRED dependencies

// ❌ WRONG - Missing cleanup
useEffect(() => {
  const timer = setInterval(() => {}, 1000)
  // Missing: return () => clearInterval(timer)
}, [])

// ❌ WRONG - Missing dependencies
useEffect(() => {
  fetchData(userId)  // userId should be in deps
}, [])
```

### 4.3 useMemo Pattern

```javascript
// ✅ CORRECT - For expensive computations
const { sizeNum, radius, circumference } = useMemo(() => {
  const sizeNum = parseInt(size)
  const radius = sizeNum / 2 - parseInt(strokeWidth)
  const circumference = radius * 2 * Math.PI
  return { sizeNum, radius, circumference }
}, [size, strokeWidth])

// ❌ WRONG - Inline computation
const circumference = radius * 2 * Math.PI  // Recalculates every render
```

### 4.4 useCallback Pattern

```javascript
// ✅ CORRECT - Stable function reference
const calculateProgress = useCallback(
  timeLeft => {
    const progress = timeLeft / duration
    return circumference * (1 - progress)
  },
  [circumference, duration]
)

// ❌ WRONG - Inline function
<Component onProgress={timeLeft => circumference * (1 - timeLeft / duration)} />
```

### 4.5 useRef Pattern

```javascript
// ✅ CORRECT
const cbRef = useRef(null)
const inputRef = useRef()

// Access
cbRef.current = callback
inputRef.current.focus()
```

### 4.6 Custom Hooks Pattern

**Location:** `src/customHooks/`  
**Naming:** Always prefix with `use`

```javascript
// src/customHooks/useStateCallback.js
const useStateCallback = (initialState, legacy = false) => {
  const [state, setState] = useState(initialState)
  const cbRef = useRef(null)

  const setStateWithCallback = useCallback((newState, cb) => {
    cbRef.current = cb
    setState(newState)
  }, [])

  useEffect(() => {
    if (cbRef.current) {
      cbRef.current(state)
      cbRef.current = null
    }
  }, [state])

  const setStateLegacy = (newstate, cb) => 
    setStateWithCallback(prevState => ({ ...prevState, ...newstate }), cb)

  return [state, legacy ? setStateLegacy : setStateWithCallback]
}

export default useStateCallback
```

**Available Custom Hooks:**
- `useStateCallback` - setState with callback (legacy support)
- `useSelector` - Wrapper with shallowEqual
- `useTimer` - Countdown/timer functionality
- `usePrevious` - Track previous value
- `usePayPerLead` - Feature-specific logic
- `useTracking` - Analytics tracking
- `useOnScreen` - Intersection observer
- `useNetwork` - Network status detection

---

## 5. JavaScript/ES6 Patterns

### 5.1 Destructuring Conventions

**Object Destructuring:**
```javascript
// ✅ CORRECT - Always destructure
const { selectedListing, listings, fetchedListings } = props
const { mortgageData: { renewedPartnerId, partnerId } = {} } = getState()

// ❌ WRONG - Direct access
const listings = props.listings
```

**Array Destructuring:**
```javascript
const [state, setState] = useState(initialState)
const [timerVal, restart, stop] = useInterval({ timeInSeconds: 60 })
```

### 5.2 Spread Operator Usage

```javascript
// ✅ CORRECT - Props spreading
const Button = ({ children, ...props }) => {
  return <button {...props}>{children}</button>
}

// ✅ CORRECT - State updates (immutable)
return {
  ...state,
  questions: payload.questions
}

// ✅ CORRECT - Object.assign (also acceptable)
return Object.assign({}, state, { currentModal, productName })

// ✅ CORRECT - Array spreading
const newArray = [...array, newItem]
```

### 5.3 Arrow Function Conventions

```javascript
// ✅ CORRECT - Single line
const handleClick = () => setOpen(true)

// ✅ CORRECT - Multi-line
const handleSubmit = (formData) => {
  validateData(formData)
  dispatch(submitAction(formData))
}

// ✅ CORRECT - Object return (wrap in parens)
const mapData = (item) => ({
  id: item.id,
  name: item.name
})
```

**Naming Conventions:**
- `handle` prefix for event handlers: `handleClick`, `handleChange`
- `get` prefix for getters: `getState`, `getData`
- `set` prefix for setters: `setState`, `setData`
- `fetch` prefix for API calls: `fetchData`, `fetchListings`

### 5.4 Async/Await Patterns

**In Thunks:**
```javascript
const fetchBankDetails = () => (dispatch, getState, { fetch }) => {
  const { mortgageData: { renewedPartnerId, partnerId } = {} } = getState()

  return fetch({
    url: `${config.mortgage}mortgage/v1/fetch-bank-details`,
    apiName: 'FETCH_BANK_DETAILS',
    params: { mortgagePartnerId: renewedPartnerId || partnerId },
    withCredentials: true
  })
    .then(({ data: { data } = {} }) => {
      dispatch({
        type: 'SET_MORTGAGE_ONBOARDING_DATA',
        payload: { bankDetails: data }
      })
    })
    .catch(() => {
      dispatch(showNotif('Something went wrong', { className: 'error' }))
    })
}
```

**In useEffect:**
```javascript
useEffect(() => {
  const fetchStatus = async () => {
    try {
      const result = await fetchRepostOwnerListingStatus(profileUuid, propertyId)
      setStatus(result)
    } catch (error) {
      console.error('Error:', error)
    }
  }
  
  fetchStatus()
}, [profileUuid, propertyId])
```

### 5.5 Error Handling

```javascript
// ✅ CORRECT - Try/catch with proper handling
try {
  const status = await getKYCStatus(requestId)
  setEkycStatus(status)
} catch (error) {
  handleError(error)
  console.error(error)
}

// ✅ CORRECT - Promise chain
return fetch(config)
  .then(({ data: { data } = {} }) => {
    dispatch({ type: 'SUCCESS', payload: data })
  })
  .catch(() => {
    dispatch(showNotif('Error occurred'))
  })
```

---

## 6. Redux Patterns

### 6.1 createReducer Pattern (REQUIRED)

```javascript
// src/reducers/dashboard.js
import { createReducer } from 'utils'

const initialState = {
  currentModal: '',
  productName: '',
  info: [],
  hasLiveAds: false
}

export default createReducer(initialState, {
  SD_STATUS_CARDS: (state, payload) => {
    const { actions, monetization, hasLiveAds } = payload
    return Object.assign({}, state, {
      actions,
      monetization,
      hasLiveAds
    })
  },

  SET_UNANSWERED_QUESTIONS: (state, payload) => {
    return {
      ...state,
      questions: payload.questions
    }
  }
})
```

### 6.2 Action Type Naming

```javascript
// ✅ CORRECT - UPPERCASE_SNAKE_CASE
SD_STATUS_CARDS
SET_UNANSWERED_QUESTIONS
SET_MORTGAGE_ONBOARDING_DATA
FETCH_LEADS_SUCCESS

// ❌ WRONG
setLeadsData
Set_Leads_Data
```

### 6.3 Thunk Action Pattern

```javascript
// src/actions/Mortgage/fetchBankDetails.js
const fetchBankDetails = () => (dispatch, getState, { fetch }) => {
  const { mortgageData: { renewedPartnerId, partnerId } = {} } = getState()

  return fetch({
    url: `${config.mortgage}mortgage/v1/fetch-bank-details`,
    apiName: 'FETCH_BANK_DETAILS',
    params: { mortgagePartnerId: renewedPartnerId || partnerId },
    withCredentials: true
  })
    .then(({ data: { data } = {} }) => {
      dispatch({
        type: 'SET_MORTGAGE_ONBOARDING_DATA',
        payload: { bankDetails: data }
      })
    })
    .catch(() => {
      dispatch(showNotif('Something went wrong', { className: 'error' }))
    })
}

export default fetchBankDetails
```

### 6.4 Simple Action Creator

```javascript
export const setLeadsListing = (listingId) => ({
  type: 'SET_LEADS_LISTING',
  payload: listingId
})
```

### 6.5 mapStateToProps Pattern

```javascript
// ✅ CORRECT - Destructure state
const mapStateToProps = (state) => {
  const { login: { isBroker, isBuilder } = {} } = state
  return {
    isBroker,
    isBuilder
  }
}

// ✅ CORRECT - Inline destructuring
const mapStateToProps = ({ 
  login, 
  dashboard, 
  shell: { userAgent: { isMobile } = {} } = {} 
}) => ({
  login,
  dashboard,
  isMobile
})
```

### 6.6 mapDispatchToProps Pattern

```javascript
// ✅ CORRECT - With bindActionCreators
import { bindActionCreators } from 'redux'

const mapDispatchToProps = (dispatch) => ({
  fetchAllActiveListings: bindActionCreators(fetchAllActiveListings, dispatch),
  trackFn: bindActionCreators(trackFn, dispatch)
})
```

### 6.7 Connect Pattern

```javascript
// ✅ CORRECT
export default connect(mapStateToProps, mapDispatchToProps)(ComponentName)

// ✅ CORRECT - With withRouter
export default connect(
  mapStateToProps, 
  mapDispatchToProps
)(withRouter(ComponentName))
```

### 6.8 useSelector Hook (Modern Pattern)

```javascript
// src/customHooks/useSelector.js
import { useSelector, shallowEqual } from 'react-redux'

export default (fun, equalityFunction = shallowEqual) =>
  useSelector(fun, equalityFunction)

// Usage
const { filter } = useSelector(({ ownerLeads: { filter } = {} }) => ({
  filter
}))
```

### 6.9 Immutable State Updates (CRITICAL)

```javascript
// ✅ CORRECT - Spread operator
return {
  ...state,
  questions: payload.questions
}

// ✅ CORRECT - Object.assign
return Object.assign({}, state, {
  currentModal,
  productName
})

// ❌ WRONG - Direct mutation
state.questions = payload.questions  // NEVER!
return state
```

---

## 7. Styling Patterns

### 7.1 Emotion CSS-in-JS (Primary)

**JSX Pragma Required:**
```javascript
/** @jsx jsx */
import { jsx } from '@emotion/react'
```

**Style Definition (style.js):**
```javascript
// src/components/CircularTimer/style.js
import { css } from '@emotion/react'

export const timerOuterContainerStyle = isWebview => css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: ${isWebview ? '5px' : '30px'};
`

export const timerTextStyle = color => css`
  color: ${color || '#5E23DC'};
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.2px;
  z-index: 1;
`
```

**Usage in Components:**
```javascript
import { timerOuterContainerStyle, timerTextStyle } from './style'

const Component = ({ color, isWebview }) => (
  <div css={timerOuterContainerStyle(isWebview)}>
    <div css={timerTextStyle(color)}>Timer</div>
  </div>
)
```

### 7.2 Combining Styles

```javascript
// ✅ CORRECT - Array of styles
<circle
  css={[
    circleStyle,
    progressCircleStyle(color),
    {
      strokeDasharray: circumference,
      strokeDashoffset: calculateProgress(timeLeft)
    }
  ]}
/>

// ✅ CORRECT - With classNames
<button
  className={classNames('button', className)}
  css={[btnStyle, style]}
>
```

### 7.3 SCSS (Legacy)

```scss
// Legacy SCSS files
.button {
  border: none;
  font-size: 14px;
  border-radius: 8px;
  cursor: pointer;
  
  &:disabled {
    pointer-events: none;
    background-color: #9f9f9f;
  }
}
```

### 7.4 Data Attributes for Testing

```javascript
// ✅ REQUIRED - Always include data-testid
<button data-testid='buttonId'>Click me</button>
<div data-testid='plan-sell'>Plan Content</div>
```

---

## 8. File Naming Conventions

### 8.1 Component Files

```
ComponentName/
├── index.js         # Main component
├── style.js         # Emotion styles
├── desktop.js       # Desktop variant
├── mobile.js        # Mobile variant
└── __tests__/       # Test files
    └── index.test.js
```

**Rules:**
- **PascalCase** for folder names: `Button`, `CircularTimer`
- **kebab-case** for file names: `index.js`, `style.js`
- **lowercase** for variants: `desktop.js`, `mobile.js`

### 8.2 Style Files

- `style.js` for Emotion CSS-in-JS
- `*.scss` for SCSS (legacy)

### 8.3 Test Files

- Pattern: `*.test.js` or `*.spec.js`
- Location: `__tests__/` directory

### 8.4 Utility Files

```
src/utils/
├── index.js              # Main utilities
├── tracking/             # Tracking utilities
├── date.js               # Date utilities
├── localStorage.js       # Storage utilities
└── payPerLead.js         # Feature utilities
```

---

## 9. Import/Export Patterns

### 9.1 Import Order (REQUIRED)

```javascript
// 1. External libraries
import { jsx } from '@emotion/react'
import { Fragment, useCallback, useEffect, useMemo } from 'react'
import { connect } from 'react-redux'

// 2. Internal libraries
import connectDataFetchers from 'lib/connectDataFetchers'

// 3. Views and components
import ListingCarousel from 'views/leads/owner/components/listingCarousel'
import FooterBar from 'components/commonComponents/footerBar'

// 4. Actions and hooks
import hooks from 'views/leads/owner/hooks'

// 5. Styles
import {
  containerStyle,
  headingStyle,
  mainStyle
} from 'views/leads/owner/mobileStyle'

// 6. Config and constants
import config from 'views/leads/owner/components/filters/config'
```

### 9.2 Export Patterns

**Default Export (Components):**
```javascript
export default Button
```

**Named Exports (Styles):**
```javascript
export const btnStyle = css`...`
export const btnPrimaryStyle = css`...`
```

**Named Exports (Actions):**
```javascript
export function fetchLeadsData () { }
export function filterLeads () { }
```

### 9.3 Path Aliases

```javascript
// ✅ CORRECT - Absolute imports
import Button from 'components/Button'
import config from 'config/application'
import useSelector from 'customHooks/useSelector'

// ❌ WRONG - Relative imports
import Button from '../../../components/Button'
```

---

## 10. API Patterns

### 10.1 Thunk with Fetch Helper

```javascript
const fetchBankDetails = () => (dispatch, getState, { fetch }) => {
  const { mortgageData } = getState()

  return fetch({
    url: `${config.mortgage}mortgage/v1/fetch-bank-details`,
    apiName: 'FETCH_BANK_DETAILS',
    params: { mortgagePartnerId: mortgageData.partnerId },
    withCredentials: true
  })
    .then(({ data: { data } = {} }) => {
      dispatch({ type: 'SET_DATA', payload: data })
    })
    .catch(() => {
      dispatch(showNotif('Something went wrong', { className: 'error' }))
    })
}
```

### 10.2 Axios Direct

```javascript
import axios from 'axios'

export const getOpportunityDetails = (id) => {
  return axios({
    url: `${config.zeus}api/payment/v0/getOpportunity?id=${id}`,
    method: 'GET',
    withCredentials: true
  })
}
```

### 10.3 Error Handling

```javascript
// ✅ CORRECT - In thunks
return fetch(config)
  .then(({ data }) => dispatch({ type: 'SUCCESS', payload: data }))
  .catch(() => dispatch(showNotif('Error', { className: 'error' })))

// ✅ CORRECT - In useEffect
try {
  const result = await fetchStatus()
  setState(result)
} catch (error) {
  console.error('Error:', error)
  setError(error.message)
}
```

### 10.4 Loading State

```javascript
const [loading, setLoading] = useState(true)
const [data, setData] = useState(null)
const [error, setError] = useState(null)

useEffect(() => {
  const fetch = async () => {
    setLoading(true)
    try {
      const result = await fetchData()
      setData(result)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }
  fetch()
}, [])
```

---

## 11. Routing Patterns

### 11.1 React Router v6 Patterns

```javascript
// Route definition with lazy loading
import Loadable from 'components/loadable'

const Dashboard = Loadable({
  loader: () => import(/* webpackChunkName: "Dashboard" */ 'views/dashboard'),
  loading: () => null
})

// Route config
{
  path: '/dashboard',
  element: <Dashboard />,
  loader: dashboardLoader
}
```

### 11.2 Route Loaders

```javascript
export const authAndLoginLoader = async () => {
  // Check authentication
  // Dispatch Redux actions
  // Redirect if needed
  return data
}

// In route config
{
  path: '/protected',
  element: <ProtectedComponent />,
  loader: authAndLoginLoader
}
```

### 11.3 Redirects

```javascript
import { redirect } from 'react-router-dom'

export const protectedLoader = () => {
  if (!isAuthenticated()) {
    return redirect('/login')
  }
  return null
}
```

### 11.4 Code Splitting with Loadable

```javascript
// ✅ REQUIRED - Always include webpackChunkName
const MyComponent = Loadable({
  loader: () => import(
    /* webpackChunkName: "MyChunkName" */ 'components/MyComponent'
  ),
  loading: () => <Loader />
})

// ❌ WRONG - Missing chunk name
const Comp = Loadable({
  loader: () => import('components/Heavy')  // Missing webpackChunkName
})
```

---

## 12. SSR & Isomorphic Code

### 12.1 Check for Browser APIs

```javascript
// ✅ CORRECT - Check environment
if (typeof window !== 'undefined') {
  window.addEventListener('resize', handleResize)
}

const width = typeof window !== 'undefined' ? window.innerWidth : 1024

// ❌ WRONG - Direct access
const width = window.innerWidth  // Crashes on server
localStorage.setItem('key', 'value')  // Crashes on server
```

### 12.2 Global Variables

```javascript
// Available global flags
__PROD__      // Boolean - production environment
__SERVER__    // Boolean - server-side rendering
__TEST_SUITE__ // Boolean - test execution
```

### 12.3 Service Worker Registration

```javascript
// Register after window.onload
if (typeof window !== 'undefined') {
  window.onload = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
    }
  }
}
```

---

## 13. Testing Patterns

### 13.1 Test File Structure

```javascript
// src/components/Component/__tests__/index.test.js
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import Component from '../index'

describe('Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('fires event on mount', () => {
    const mockEvent = jest.fn()
    render(<Component onEvent={mockEvent} />)
    expect(mockEvent).toHaveBeenCalled()
  })
})
```

### 13.2 Mocking Patterns

```javascript
// Mock modules
jest.mock('axios')
jest.mock('react-redux', () => ({ useDispatch: jest.fn() }))
jest.mock('customHooks/useSelector', () => jest.fn())

// Mock child components
jest.mock('../plan', () => props => {
  const { packageKey, onButtonClick } = props
  return (
    <div data-testid={`plan-${packageKey}`}>
      <button onClick={() => onButtonClick(packageKey)}>
        select {packageKey}
      </button>
    </div>
  )
})
```

### 13.3 Redux Mock Store

```javascript
import configureMockStore from 'redux-mock-store'
import thunk from 'redux-thunk'

const middlewares = [thunk]
const mockStore = configureMockStore(middlewares)

const store = mockStore({
  payment: { photoshootServiceableLocalities: {} },
  login: { isOwner: true }
})
```

### 13.4 renderWithRedux Helper

```javascript
import renderWithRedux from 'tests/renderWithRedux'

const renderModal = (override = {}) => {
  const props = {
    packageService: 'sell',
    listingId: 123,
    ...override
  }
  return render(<Component {...props} />)
}
```

---

## 14. Performance Patterns

### 14.1 useMemo for Expensive Computations

```javascript
const computed = useMemo(() => {
  return expensiveCalculation(data)
}, [data])
```

### 14.2 useCallback for Stable References

```javascript
const handleClick = useCallback(() => {
  doSomething()
}, [dependency])
```

### 14.3 Lazy Loading

```javascript
const HeavyComponent = Loadable({
  loader: () => import(/* webpackChunkName: "Heavy" */ './Heavy'),
  loading: () => <Loader />
})
```

### 14.4 Bundle Analysis

```bash
yarn bundle-analyzer-report
```

---

## 15. PR Review Checklist

### Code Style
- [ ] StandardJS + Prettier applied
- [ ] Print width ≤ 100 characters
- [ ] Single quotes, no semicolons
- [ ] 2-space indentation

### React Patterns
- [ ] Functional components (not class)
- [ ] Props destructured at function signature
- [ ] Default export for components
- [ ] `data-testid` on testable elements
- [ ] JSX pragma when using Emotion

### Hooks
- [ ] useEffect has cleanup return
- [ ] useEffect has dependency array
- [ ] useMemo for expensive computations
- [ ] useCallback for stable references
- [ ] Custom hooks prefixed with `use`

### Redux
- [ ] Uses createReducer utility
- [ ] Action types UPPERCASE_SNAKE_CASE
- [ ] Immutable state updates (spread or Object.assign)
- [ ] bindActionCreators for mapDispatchToProps

### Styling
- [ ] Emotion for new styles (not SCSS)
- [ ] JSX pragma imported
- [ ] Style functions return css template

### File Organization
- [ ] Correct naming conventions
- [ ] Absolute imports (path aliases)
- [ ] webpackChunkName for lazy imports

### Testing
- [ ] Tests in `__tests__/` directory
- [ ] Mocks for external modules
- [ ] data-testid used for queries

### SSR
- [ ] Check `typeof window !== 'undefined'`
- [ ] No direct browser API access

---

## 16. Common Violations & Fixes

### Violation 1: Class Component for New Code (HIGH)

```javascript
// ❌ DETECTED
class MyComponent extends React.Component { }

// ✅ FIX
const MyComponent = (props) => { }
```

### Violation 2: Missing useEffect Cleanup (HIGH)

```javascript
// ❌ DETECTED
useEffect(() => {
  const timer = setInterval(() => {}, 1000)
}, [])

// ✅ FIX
useEffect(() => {
  const timer = setInterval(() => {}, 1000)
  return () => clearInterval(timer)
}, [])
```

### Violation 3: Missing useEffect Dependencies (MEDIUM)

```javascript
// ❌ DETECTED
useEffect(() => {
  fetchData(userId)
}, [])

// ✅ FIX
useEffect(() => {
  fetchData(userId)
}, [userId])
```

### Violation 4: Direct State Mutation (HIGH)

```javascript
// ❌ DETECTED
state.items.push(newItem)
return state

// ✅ FIX
return {
  ...state,
  items: [...state.items, newItem]
}
```

### Violation 5: Relative Imports (LOW)

```javascript
// ❌ DETECTED
import Button from '../../../components/Button'

// ✅ FIX
import Button from 'components/Button'
```

### Violation 6: Missing webpackChunkName (MEDIUM)

```javascript
// ❌ DETECTED
const Comp = Loadable({
  loader: () => import('components/Heavy')
})

// ✅ FIX
const Comp = Loadable({
  loader: () => import(/* webpackChunkName: "Heavy" */ 'components/Heavy')
})
```

### Violation 7: SSR-Breaking Code (HIGH)

```javascript
// ❌ DETECTED
const width = window.innerWidth

// ✅ FIX
const width = typeof window !== 'undefined' ? window.innerWidth : 1024
```

### Violation 8: Missing data-testid (MEDIUM)

```javascript
// ❌ DETECTED
<button onClick={handleClick}>Submit</button>

// ✅ FIX
<button data-testid='submitButton' onClick={handleClick}>Submit</button>
```

### Violation 9: Inline Functions in JSX (MEDIUM)

```javascript
// ❌ DETECTED
<Component onClick={() => handleClick(id)} />

// ✅ FIX
const handleItemClick = useCallback(() => handleClick(id), [id])
<Component onClick={handleItemClick} />
```

### Violation 10: Props Not Destructured (LOW)

```javascript
// ❌ DETECTED
const Component = (props) => {
  return <div>{props.title}</div>
}

// ✅ FIX
const Component = ({ title }) => {
  return <div>{title}</div>
}
```

### Violation 11: Wrong Action Type Case (MEDIUM)

```javascript
// ❌ DETECTED
dispatch({ type: 'setUserData', payload: data })

// ✅ FIX
dispatch({ type: 'SET_USER_DATA', payload: data })
```

### Violation 12: Missing JSX Pragma for Emotion (HIGH)

```javascript
// ❌ DETECTED
import { css } from '@emotion/react'
const Component = () => <div css={style}>...</div>

// ✅ FIX
/** @jsx jsx */
import { jsx, css } from '@emotion/react'
const Component = () => <div css={style}>...</div>
```
