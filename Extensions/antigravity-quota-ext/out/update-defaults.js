"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GITHUB_API_VERSION = exports.DEFAULT_UPDATE_ASSET_PATTERN = exports.DEFAULT_UPDATE_REPO = exports.DEFAULT_UPDATE_OWNER = void 0;
exports.buildGithubHeaders = buildGithubHeaders;
exports.DEFAULT_UPDATE_OWNER = 'eldaduz';
exports.DEFAULT_UPDATE_REPO = 'my-projects';
exports.DEFAULT_UPDATE_ASSET_PATTERN = 'antigravity-quotas-*.vsix';
exports.GITHUB_API_VERSION = '2022-11-28';
function buildGithubHeaders(token) {
    return {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': exports.GITHUB_API_VERSION,
        'User-Agent': 'antigravity-quotas-updater',
    };
}
//# sourceMappingURL=update-defaults.js.map