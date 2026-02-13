# housing.seller Repository Guidelines

Guidelines and coding standards for the **housing.seller** repository (https://github.com/elarahq/housing.seller).

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Code Formatting Standards](#code-formatting-standards)
3. [Architecture & Patterns](#architecture--patterns)
4. [Component Guidelines](#component-guidelines)
5. [State Management](#state-management)
6. [Routing & Code Splitting](#routing--code-splitting)
7. [Testing Standards](#testing-standards)
8. [Performance](#performance)
9. [PR Review Checklist](#pr-review-checklist)
10. [Common Issues](#common-issues)

---

## Project Overview

**Technology Stack:**
- **Frontend:** React 16.8+, Redux, React Router v6, Emotion (CSS-in-JS)
- **Build:** Webpack 5, Babel 7, SCSS/PostCSS
- **Testing:** Jest, React Testing Library
- **Linting:** StandardJS, Prettier, ESLint
- **Node Version:** v18.14.2

---

## Code Formatting Standards

### StandardJS + Prettier

**Configuration:**
- Parser: `babel-eslint`
- Print width: **100 characters**
- Single quotes
- No semicolons (StandardJS)

**Global Variables:**
```javascript
__PROD__      // Production environment flag
__SERVER__    // Server-side rendering flag
```

### Pre-commit Hooks (lint-staged)

```json
"*.js": [
  "prettier-standard --print-width 100",
  "standard --env jest --parser babel-eslint --fix"
],
"*.scss": ["prettier --write"],
"*.{png,jpg,jpeg}": ["node ./script/images/optimize-images"]
```

### SCSS Standards

- Uses **stylelint-config-standard**
- Print width: 100 characters

---

## Architecture & Patterns

### Project Structure

```
src/
├── app.js                 # Main entry point
├── actions/              # Redux action creators
├── components/           # UI components
│   ├── commonComponents/ # Shared components
│   ├── desktop/          # Desktop variants
│   ├── loadable/         # Code splitting wrapper
│   └── [feature]/        # Feature-based
├── config/               # Configuration
├── constants/            # App constants
├── customHooks/          # Custom React hooks
├── helpers/              # Utility helpers
├── reducers/             # Redux reducers
├── routes/               # Route definitions
├── server/               # SSR code
├── store/                # Redux store
├── styles/               # Global SCSS
├── tests/                # Test setup
├── trackers/             # Analytics
├── utils/                # Utilities
└── views/                # Page components
```

### Dual Shell Architecture

- **Main Content:** Renders into `#app-root`
- **Navigation:** Renders into `#shell-root`
- Conditional mobile/desktop rendering

### Feature-Based Component Organization

```
src/components/BrandVideo/
├── index.js           # Main component
├── desktop.js         # Desktop variant
├── mobile.js          # Mobile variant
├── style.js           # Emotion CSS
├── track.js           # Tracking logic
└── useVideoData.js    # Custom hook
```

### Mobile/Desktop Branching

```javascript
const isMobile = store.getState().shell.userAgent.isMobile
return isMobile ? <MobileComponent /> : <DesktopComponent />
```

### CSS-in-JS with Emotion

```javascript
/** @jsx jsx */
import { jsx } from '@emotion/react'
import { containerStyle } from './style'

const Component = () => <div css={containerStyle}>Content</div>

// style.js
export const containerStyle = css`
  display: flex;
  padding: 20px;
`
```

---

## Component Guidelines

### Functional Components (Preferred)

```javascript
import React from 'react'
import PropTypes from 'prop-types'

const MyComponent = ({ prop1, prop2 }) => {
  return <div>{prop1}</div>
}

MyComponent.propTypes = {
  prop1: PropTypes.string.isRequired,
  prop2: PropTypes.number
}

MyComponent.defaultProps = {
  prop2: 0
}

export default MyComponent
```

### PropTypes Required

All components MUST have PropTypes validation.

### Import Patterns - Use Absolute Imports

```javascript
// ✅ GOOD - Absolute imports
import MyComponent from 'components/MyComponent'
import { useSelector } from 'customHooks/useSelector'
import config from 'config'

// ❌ BAD - Relative imports
import MyComponent from '../../../components/MyComponent'
```

### Code Splitting with Loadable

```javascript
import Loadable from 'components/loadable'

const MyComponent = Loadable({
  loader: () =>
    import(
      /* webpackChunkName: "MyChunkName" */ 'components/MyComponent'
    ),
  loading: () => <div>Loading...</div>
})
```

**Always provide explicit `webpackChunkName` comments.**

---

## State Management

### Redux Store

- Uses **Redux Thunk** for async actions
- Redux DevTools enabled in development
- Hot Module Replacement for reducers

### State Hydration

```javascript
// Server renders initial state into window.__INITIAL_STATE__
// Client hydrates with this state
```

### Cookie & LocalStorage Integration

```javascript
import { readBrowserStorage, writeBrowserStorage } from 'utils/localStorage'
```

---

## Routing & Code Splitting

### React Router v6

- Route-based code splitting with lazy loading
- Dynamic imports with explicit chunk names
- Route loader pattern for async data

### Route Loaders

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

### Redirects

```javascript
import { redirect } from 'react-router-dom'

export const protectedLoader = () => {
  if (!isAuthenticated()) {
    return redirect('/login')
  }
  return null
}
```

---

## Testing Standards

### Jest Configuration

- Test environment: `jsdom`
- File patterns: `*.test.js` or `*.spec.js`
- Setup: `@testing-library/jest-dom`

### Test File Naming

- `component.test.js` or `component.spec.js`

### Testing Pattern

```javascript
import React from 'react'
import { render, screen } from '@testing-library/react'
import MyComponent from './MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText(/test/i)).toBeInTheDocument()
  })
})
```

### Redux Testing

```javascript
// Use renderWithRedux helper
import { renderWithRedux } from 'tests/renderWithRedux'

renderWithRedux(<ConnectedComponent />)
```

### Coverage Requirements

- Coverage thresholds enforced from `sellerCoverage.txt`
- Build fails if tests don't pass
- Query by accessibility first (getByRole, getByLabelText)

### Required Test Commands

```bash
yarn test           # Full test suite with coverage
yarn test --watch   # Watch mode
```

---

## Performance

### Bundle Analysis

```bash
yarn bundle-analyzer-report
```

### Performance Marks

```javascript
window.pMark('event_name')
```

### Error Tracking

- **Sentry** for error capture
- Source maps uploaded to New Relic

### Image Optimization

- Pre-commit hook optimizes PNG/JPG automatically
- Use optimized images only

---

## PR Review Checklist

### Code Standards
- [ ] StandardJS + Prettier formatting applied
- [ ] Print width ≤ 100 characters
- [ ] No lint errors

### Components
- [ ] PropTypes defined for all props
- [ ] Functional components preferred
- [ ] Absolute imports used (not relative)
- [ ] webpackChunkName provided for lazy imports

### Architecture
- [ ] Feature-based organization followed
- [ ] Mobile/Desktop variants handled correctly
- [ ] Emotion CSS-in-JS patterns followed

### State Management
- [ ] Redux only for shared state
- [ ] No unnecessary Redux for local UI state

### Testing
- [ ] Tests pass: `yarn test`
- [ ] Coverage maintained
- [ ] React Testing Library patterns used

### Performance
- [ ] Code splitting for heavy components
- [ ] No unnecessary re-renders
- [ ] Images optimized

### SSR Compatibility
- [ ] Check `typeof window !== 'undefined'` for browser APIs
- [ ] No hydration mismatches

---

## Common Issues

### Issue: Relative Imports

**Detection:**
```javascript
// ❌ BAD
import MyComponent from '../../../components/MyComponent'
```

**Solution:**
```javascript
// ✅ GOOD
import MyComponent from 'components/MyComponent'
```

### Issue: Missing PropTypes

**Detection:**
```javascript
// ❌ BAD - No prop validation
const Component = ({ name, age }) => <div>{name}</div>
```

**Solution:**
```javascript
// ✅ GOOD
Component.propTypes = {
  name: PropTypes.string.isRequired,
  age: PropTypes.number
}
```

### Issue: Missing webpackChunkName

**Detection:**
```javascript
// ❌ BAD
const Comp = Loadable({
  loader: () => import('components/Heavy')
})
```

**Solution:**
```javascript
// ✅ GOOD
const Comp = Loadable({
  loader: () => import(/* webpackChunkName: "Heavy" */ 'components/Heavy')
})
```

### Issue: SSR-Breaking Code

**Detection:**
```javascript
// ❌ BAD
const width = window.innerWidth
```

**Solution:**
```javascript
// ✅ GOOD
const width = typeof window !== 'undefined' ? window.innerWidth : 1024
```

### Issue: Class Components in New Code

**Detection:**
```javascript
// ❌ BAD - Class component for new code
class MyComponent extends React.Component { }
```

**Solution:**
```javascript
// ✅ GOOD - Functional component
const MyComponent = () => { }
```

### Issue: Redux for Local UI State

**Detection:**
```javascript
// ❌ BAD - Redux for dropdown open state
dispatch({ type: 'SET_DROPDOWN_OPEN', payload: true })
```

**Solution:**
```javascript
// ✅ GOOD - useState for local UI state
const [isOpen, setIsOpen] = useState(false)
```

---

## Build & Deployment

### Required Commands

```bash
yarn setup      # Full environment setup
yarn start      # Development server
yarn test       # Run tests
yarn compile    # Production build
yarn lint       # Check linting
```

### Node Version

Must use **v18.14.2** (see .nvmrc)

### Docker Deployment

```bash
yarn docker:build   # Build Docker image
yarn prod           # Production server (4GB heap)
```
