import { describe, it, expect } from 'vitest';
import { formatDate } from './FormatDate';

describe('formatDate', () => {
  it('returns empty string for falsy input', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });

  it('formats yyyy-mm-dd into dd/mm/yyyy', () => {
    expect(formatDate('2026-12-31')).toBe('31/12/2026');
  });

  it('returns raw value for malformed input', () => {
    expect(formatDate('31/12/2026')).toBe('31/12/2026');
    expect(formatDate('invalid-date')).toBe('invalid-date');
  });
});
