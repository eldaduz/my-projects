const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_UPDATE_OWNER,
  DEFAULT_UPDATE_REPO,
  DEFAULT_UPDATE_ASSET_PATTERN,
  buildGithubHeaders,
} = require('../out/update-defaults.js');

test('public release defaults target my-projects', () => {
  assert.equal(DEFAULT_UPDATE_OWNER, 'eldaduz');
  assert.equal(DEFAULT_UPDATE_REPO, 'my-projects');
  assert.equal(DEFAULT_UPDATE_ASSET_PATTERN, 'antigravity-quotas-*.vsix');
});

test('github headers omit authorization when no token is provided', () => {
  assert.deepEqual(buildGithubHeaders(), {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'antigravity-quotas-updater',
  });
});

test('github headers include authorization when token is provided', () => {
  assert.deepEqual(buildGithubHeaders('test-token'), {
    Accept: 'application/vnd.github+json',
    Authorization: 'Bearer test-token',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'antigravity-quotas-updater',
  });
});
