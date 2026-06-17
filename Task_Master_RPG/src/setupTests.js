// src/setupTests.js
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock the Audio API
vi.stubGlobal(
  'Audio',
  vi.fn().mockImplementation(() => ({
    play: vi.fn(),
    pause: vi.fn(),
  })),
);

// Mock window.confirm (default to true so deletes are confirmed)
vi.stubGlobal(
  'confirm',
  vi.fn(() => true),
);

// Mock window.scrollTo (prevent crashes if app scrolls)
vi.stubGlobal('scrollTo', vi.fn());

// Mock LocalStorage
const localStorageMock = (function () {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});
