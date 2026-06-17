# Task Master RPG - Testing Summary (Current)

This document reflects the current complete testing setup for unit, integration, and E2E coverage.

## 1. Test Architecture

- Unit tests: `*.unit.test.jsx`
- Integration tests: `*.integration.test.jsx`
- E2E tests: Playwright specs under `e2e/`

Current integration suite file:

- `src/App.integration.test.jsx`

## 2. Scripts

From `package.json`:

- `npm test` -> run all Vitest suites
- `npm run test:unit` -> run unit suites
- `npm run test:integration` -> run integration suites
- `npm run test:e2e` -> run Playwright E2E suites
- `npm run test:all` -> run unit + integration + e2e

## 3. Environment and Mocks

`vite.config.js` test settings:

- `environment: 'jsdom'`
- `globals: true`
- `setupFiles: './src/setupTests.js'`

`src/setupTests.js` includes:

- `Audio` mock
- `window.confirm` mock
- `window.scrollTo` mock
- custom `localStorage` stub

## 4. App/Test Compatibility Updates

- Task IDs now use `crypto.randomUUID()` in `src/App.jsx` for collision-safe IDs.
- `src/components/TaskCard.jsx` includes:
  - `data-testid="complete-checkbox"`
  - `data-testid="delete-button"`

## 5. Unit Coverage (Baseline)

Covered files:

- `src/components/QuestInput.unit.test.jsx`
- `src/components/TaskCard.unit.test.jsx`
- `src/components/DeleteModal.unit.test.jsx`
- `src/components/ToastNotification.unit.test.jsx`
- `src/components/GamificationHUD.unit.test.jsx`
- `src/components/SearchInput.unit.test.jsx`
- `src/components/FilterPill.unit.test.jsx`
- `src/components/EmptyState.unit.test.jsx`
- `src/utils/FormatDate.unit.test.jsx`
- `src/main.unit.test.jsx`

## 6. Integration Coverage

`src/App.integration.test.jsx` covers:

- add quest
- date validation
- XP gain and rollback on uncheck
- filter/search/sort behavior
- clear completed (confirm true/false)
- delete modal confirm/cancel flows
- localStorage hydration
- malformed localStorage JSON fallback

## 7. E2E Coverage (Playwright)

Config:

- `playwright.config.js` (Chromium + Firefox, local dev server)

Specs:

- `e2e/happy-path.spec.js`
- `e2e/persistence.spec.js`
- `e2e/filter-search-sort.spec.js`
- `e2e/validation.spec.js`

## 8. Latest Status

- Unit: passing
- Integration: passing
- E2E (Chromium + Firefox): passing
- `test:all`: passing

No known failing suites at this time.
