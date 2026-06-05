# WorkNest Public Sync Workflow

## Purpose

This workflow syncs approved WorkNest changes from the source-of-truth development project into the public portfolio repo without changing product behavior.

Source of truth:
- `C:\Fullstack\VS Code\From_Web_2_DB\src\WorkNest`
- `C:\Fullstack\VS Code\From_Web_2_DB\public\images`

Public portfolio target:
- `C:\Fullstack\my-projects-github\worknest`

The v1 workflow is intentionally limited:
- Dry-run by default.
- `-Apply` copies only approved files.
- `-Build` runs the portfolio client build.
- Forbidden-file scanning runs before the final status report.
- No commit support.
- No push support.
- No branch changes.
- No remote changes.
- No deploy steps.
- No source-file deletion.

## Files

- DEV wrapper: `C:\Fullstack\VS Code\From_Web_2_DB\src\WorkNest\scripts\sync-to-public.ps1`
- Main sync script: `C:\Fullstack\my-projects-github\worknest\scripts\sync-from-dev.ps1`
- Doc: `C:\Fullstack\my-projects-github\worknest\docs\SYNC_WORKFLOW.md`

## Path Mapping

The script reads changed files from the git repo that contains `From_Web_2_DB` and then maps supported WorkNest paths into the portfolio repo.

Supported mappings:
- `From_Web_2_DB\src\WorkNest\client\...` -> `worknest\client\src\...`
- `From_Web_2_DB\src\WorkNest\server\...` -> `worknest\server\...`
- `From_Web_2_DB\public\images\...` -> `worknest\client\public\images\...`

Out of scope for v1:
- `From_Web_2_DB\src\WorkNest\docs\...`
- `From_Web_2_DB\src\WorkNest\scripts\sync-to-public.ps1`
- `From_Web_2_DB\src\WorkNest\tests\...`
- `From_Web_2_DB\src\WorkNest\test-artifacts\...`
- Any unrelated course files outside the supported roots above

The DEV wrapper script is expected to exist only in the development project:
- It is a local-only workflow helper.
- It is outside sync scope.
- It is never copied to the portfolio repo.
- It should appear as informational output, not as a failure condition.

## Safety Checks

Before doing anything important, the script verifies:
- All required folders exist.
- The portfolio repo remote is exactly `https://github.com/eldaduz/my-projects.git`.
- The portfolio repo branch is exactly `main`.

Before copying, the script shows a sync plan with:
- The changed source file.
- The proposed portfolio target path.
- Whether the file is `ALLOWED` or `BLOCKED`.
- The reason for the decision.

Forbidden items are blocked from sync when detected in the changed file path or name, including:
- `node_modules`
- `dist`
- `.env`
- `.env.local`
- `.env.*.local`
- `test-results`
- `playwright-report`
- `blob-report`
- `.auth`
- `.playwright`
- `coverage`
- `.zip`
- temporary files such as `.tmp`, `.temp`, `.bak`
- temporary test files

The forbidden-file scan is Git-aware:
- Ignored and untracked local generated folders are not blockers.
- Ignored `node_modules` and ignored `dist` are reported only as informational output.
- Tracked forbidden files are blockers even if `.gitignore` would normally match them.
- Staged forbidden files are blockers.
- Unignored forbidden files are blockers.
- Planned-for-copy forbidden files are blocked in the sync plan before copy.

Allowed examples:
- `.env.example`
- frontend source files
- backend source files
- public assets such as WebP images

## Primary Usage

Work from the DEV project first:
1. Make and test approved changes in `C:\Fullstack\VS Code\From_Web_2_DB`.
2. Run the sync workflow from the DEV repo root.
3. Review the portfolio repo git status.
4. Commit and push manually later from `C:\Fullstack\my-projects-github`.

Run these commands from:
`C:\Fullstack\VS Code\From_Web_2_DB`

Dry-run only:

```powershell
.\src\WorkNest\scripts\sync-to-public.ps1
```

Apply approved file copies:

```powershell
.\src\WorkNest\scripts\sync-to-public.ps1 -Apply
```

Apply and build the portfolio client:

```powershell
.\src\WorkNest\scripts\sync-to-public.ps1 -Apply -Build
```

The DEV wrapper delegates to the main script here:
`C:\Fullstack\my-projects-github\worknest\scripts\sync-from-dev.ps1`

## Build Behavior

When `-Build` is used, the script runs these commands in:
`C:\Fullstack\my-projects-github\worknest\client`

```powershell
npm install --no-package-lock
npm run build
```

After a successful build, the script removes `client\dist` so build output does not remain in the repo.

## Final Review Flow

After the script completes:
1. Review the sync plan output.
2. Review the forbidden-file scan output.
3. Review the final git status for `C:\Fullstack\my-projects-github`.
4. Decide manually whether to commit and push.

The v1 script never:
- commits
- pushes
- force pushes
- changes remotes
- changes branches
- deploys
- touches Render settings
- touches Vercel settings
- changes product behavior
- changes backend API behavior
- changes auth behavior
- changes reservation logic
- deletes source files
