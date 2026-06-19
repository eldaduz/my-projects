export const DEFAULT_UPDATE_OWNER = 'eldaduz'
export const DEFAULT_UPDATE_REPO = 'my-projects'
export const DEFAULT_UPDATE_ASSET_PATTERN = 'antigravity-quotas-*.vsix'
export const GITHUB_API_VERSION = '2022-11-28'

export function buildGithubHeaders(token?: string): Record<string, string> {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    'User-Agent': 'antigravity-quotas-updater',
  }
}
