# Antigravity Quotas

Lightweight VS Code extension view for monitoring Antigravity model quota status.

## What Changed in 0.0.10

- Startup visibility fix shipped:
  - extension activates on startup (`onStartupFinished`), so `$(dashboard) Quotas` appears without opening the panel first.
- Added private GitHub updater support:
  - checks stable releases from `eldaduz/my-projects`
  - default schedule: startup + every 12 hours
- Added update commands:
  - `Antigravity Quotas: Check for Updates`
  - `Antigravity Quotas: Configure Update Token`
  - `Antigravity Quotas: Clear Update Token`
- Updater installs newer VSIX directly and prompts reload.
- Public releases work without a token; token remains optional for private repos.

## What Changed in 0.0.9

- Added extension-level icon in manifest:
  - `resources/icons/extension.png`
- Added provider group icon system in full panel:
  - Gemini and Claude now use custom image icons.
  - GPT-OSS keeps codicon fallback.
  - Other keeps safe codicon fallback.
- Added setting:
  - `antigravityQuotas.groupIconStyle` = `color | mono | auto`
  - default is `color`
- Implemented Gemini ordering rule:
  - version-first (`3.1 > 3.0`)
  - same-version tiers (`High > Low > Fast/Flash > others`)

<details>
<summary>Older releases</summary>

## What Changed in 0.0.8

- Aligned startup bootstrap retry with agreed UX:
  - first-load retry is now every **3 seconds** until initial successful fetch.
- Keeps normal 5-minute polling after first successful data load.

## What Changed in 0.0.7

- Startup auto-retry added:
  - when quotas are not available yet (language server not ready), the extension retries automatically.
  - no manual click is needed to bootstrap initial quota data.
- After first successful fetch, polling returns to normal 5-minute cadence.
- While waiting for first data, status tooltip shows:
  - `Loading quotas...`

## What Changed in 0.0.6

- Compact grouped naming for both full panel and status tooltip:
  - provider prefix removed from model names under each group
  - examples: `Opus 4.6`, `Sonnet 4.6`, `3.1 Pro (High)`, `3.1 Pro (Low)`
- Suffixes like `(Thinking)` are shown only when needed to disambiguate duplicate base names.
- Status tooltip now renders one model per line (less wide and easier to scan).
- Startup behavior improved:
  - if the language server is not ready yet, initial retries are silent instead of showing an immediate error.

## What Changed in 0.0.5

- Moved status bar item to the right-side status bar group.
- Updated status bar label to include extension icon:
  - `$(dashboard) Quotas`
- Increased status bar priority so Quotas appears as the leftmost item in the right-side group.

## What Changed in 0.0.4

- Compact model rows now use a single label line:
  - `Model Name - X%`
  - `Model Name - Quota unknown`
- Reset timing moved to a dedicated row below each model.
- Severity icon switched to circle-based color coding:
  - Green: `>= 75%`
  - Yellow: `40% - 74%`
  - Orange: `15% - 39%`
  - Red: `< 15%`
  - Gray: unknown
- Models are grouped by provider:
  - Gemini
  - Claude
  - GPT-OSS
  - Other
- Group and model sorting now prioritize lowest remaining quota first.
- Added status bar entry: `Quotas`.
  - Hover shows grouped model list with colored icons and percentages.
  - Click opens the quota panel and auto-expands groups.

</details>

## Updater Setup

1. Confirm update settings (defaults already target `eldaduz/VS-Code`).
2. Run `Antigravity Quotas: Configure Update Token` and paste your PAT.
3. Run `Antigravity Quotas: Check for Updates` to verify connectivity.

## Release Publishing Workflow

- Updater detects versions from GitHub stable Releases, not regular commits.
- Follow [RELEASE_WORKFLOW.md](./RELEASE_WORKFLOW.md) for the exact release checklist.

## Build

```bash
npm run compile
npx @vscode/vsce package --no-git-tag-version
```

## Output

Current packaged build:

- `antigravity-quotas-0.0.10.vsix`
