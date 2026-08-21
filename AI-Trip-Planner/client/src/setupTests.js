import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// @testing-library/dom's waitFor only detects fake timers via a global `jest`
// object (it checks `typeof jest !== 'undefined'`). Vitest has no such
// global, so without this shim waitFor polls with the real setInterval while
// vi.useFakeTimers() is active and hangs until the test timeout. This alias
// is the standard vitest/testing-library compat fix, not test-specific.
if (typeof globalThis.jest === 'undefined') {
  globalThis.jest = { advanceTimersByTime: (...args) => vi.advanceTimersByTime(...args) }
}
