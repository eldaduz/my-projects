# Antigravity Quotas Release Workflow

This workflow is the source of truth for publishing versions that the built-in updater can detect.

## Rules

1. Updater source is GitHub **stable Releases** only.
2. Regular commits and pushed files do **not** trigger updater detection.
3. Release tag, extension version, and VSIX filename must match.

## Preflight

1. Ensure `package.json` version is the target `X.Y.Z`.
2. Ensure docs (`README.md`, `HANDOFF.md`) mention the same target version.
3. Ensure PAT is configured in extension via:
   - `Antigravity Quotas: Configure Update Token`

## Build

Run from `e:/Fullstack/VS-Code/antigravity-quota-ext`:

```bash
npm run compile
npx @vscode/vsce package --no-git-tag-version
```

Expected artifact:

- `antigravity-quotas-X.Y.Z.vsix`

## Recommended Source Commit

Commit/push source changes for traceability, even though updater detection does not require this.

## Publish Stable GitHub Release

Repository: `eldaduz/VS-Code`

1. Open GitHub -> `Releases` -> `Create a new release`.
2. Tag: `vX.Y.Z`.
3. Title: `Antigravity Quotas X.Y.Z`.
4. Keep release as stable:
   - `draft = false`
   - `prerelease = false`
5. Attach asset:
   - `antigravity-quotas-X.Y.Z.vsix`
6. Publish release.

## Verify Release API

Open:

- `https://api.github.com/repos/eldaduz/VS-Code/releases/latest`

Expected:

1. HTTP `200` (not `404`).
2. `tag_name` equals `vX.Y.Z`.
3. Assets include `antigravity-quotas-X.Y.Z.vsix`.

## Verify in Extension

1. Run `Antigravity Quotas: Check for Updates`.
2. Expected:
   - Remote newer than local -> update prompt with install action.
   - Remote equal to local -> `Up to date`.

## Troubleshooting

1. Error: `GitHub release request failed (404)`
   - Cause: no published stable release exists.
   - Fix: publish a stable release with VSIX attached.
2. Error: no matching VSIX asset
   - Cause: incorrect filename.
   - Fix: upload asset matching `antigravity-quotas-*.vsix`.
3. Error: auth/token failure
   - Cause: expired/invalid PAT or insufficient permission.
   - Fix: run `Configure Update Token` with fine-grained read-only PAT.

## Naming Contract

1. Extension version in `package.json`: `X.Y.Z`
2. Release tag: `vX.Y.Z`
3. VSIX filename: `antigravity-quotas-X.Y.Z.vsix`
