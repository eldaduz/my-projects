import { createBranchSlug } from './branchSlug.js';

describe('createBranchSlug', () => {
  test('builds a stable lowercase slug from a branch name', () => {
    expect(createBranchSlug('  WorkNest Herzliya  ')).toBe('worknest-herzliya');
  });

  test('removes apostrophes and keeps words readable', () => {
    expect(createBranchSlug("WorkNest Be'er Sheva")).toBe('worknest-beer-sheva');
  });

  test('removes unsafe url characters', () => {
    expect(createBranchSlug('WorkNest Jerusalem! @ Main')).toBe('worknest-jerusalem-main');
  });
});
