[CmdletBinding()]
param(
    [switch]$Apply,
    [switch]$Build
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$paths = [ordered]@{
    OriginalRepoRoot     = 'C:\Fullstack\VS Code\From_Web_2_DB'
    OriginalWorkNestRoot = 'C:\Fullstack\VS Code\From_Web_2_DB\src\WorkNest'
    OriginalImagesRoot   = 'C:\Fullstack\VS Code\From_Web_2_DB\public\images'
    PortfolioRepoRoot    = 'C:\Fullstack\my-projects-github'
    PortfolioWorkNestRoot= 'C:\Fullstack\my-projects-github\worknest'
    PortfolioClientRoot  = 'C:\Fullstack\my-projects-github\worknest\client'
    PortfolioServerRoot  = 'C:\Fullstack\my-projects-github\worknest\server'
}

$expectedRemote = 'https://github.com/eldaduz/my-projects.git'
$expectedBranch = 'main'

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "=== $Title ==="
}

function Normalize-RelativePath {
    param([string]$Path)
    return (($Path -replace '\\', '/') -replace '^[./]+', '')
}

function Get-RelativePath {
    param(
        [string]$BasePath,
        [string]$ChildPath
    )

    return Normalize-RelativePath ([System.IO.Path]::GetRelativePath($BasePath, $ChildPath))
}

function Assert-PathExists {
    param(
        [string]$Path,
        [string]$Label
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "$Label not found: $Path"
    }
}

function Invoke-Git {
    param(
        [string]$RepositoryPath,
        [string[]]$Arguments
    )

    $output = & git -C $RepositoryPath @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed in $RepositoryPath`n$output"
    }

    return @($output)
}

function Test-ForbiddenRelativePath {
    param([string]$RelativePath)

    $normalized = Normalize-RelativePath $RelativePath
    $lower = $normalized.ToLowerInvariant()
    $leaf = [System.IO.Path]::GetFileName($lower)

    if ($lower -match '(^|/)(node_modules|dist|test-results|playwright-report|blob-report|\.auth|\.playwright|coverage)(/|$)') {
        return 'contains a forbidden folder'
    }

    if ($leaf -eq '.env') {
        return 'real .env files are forbidden'
    }

    if ($leaf -eq '.env.local' -or $leaf -match '^\.env\..+\.local$') {
        return 'local environment files are forbidden'
    }

    if ($leaf -match '\.zip$') {
        return 'zip files are forbidden'
    }

    if ($leaf -match '\.(tmp|temp|bak)$') {
        return 'temporary files are forbidden'
    }

    if ($leaf -match '(test|spec)' -and $leaf -match '(temp|tmp|scratch|draft)') {
        return 'temporary test files are forbidden'
    }

    return $null
}

function Get-Mapping {
    param(
        [string]$SourceFullPath,
        [string]$WorkNestPrefix,
        [string]$ImagesPrefix
    )

    $sourceRelativeToGit = Get-RelativePath -BasePath $script:SourceGitRoot -ChildPath $SourceFullPath

    if ($sourceRelativeToGit.StartsWith("$WorkNestPrefix/", [System.StringComparison]::OrdinalIgnoreCase)) {
        $relativeInsideWorkNest = Normalize-RelativePath ($sourceRelativeToGit.Substring($WorkNestPrefix.Length + 1))

        if ($relativeInsideWorkNest.StartsWith('client/', [System.StringComparison]::OrdinalIgnoreCase)) {
            $clientRelative = Normalize-RelativePath ($relativeInsideWorkNest.Substring('client/'.Length))
            if ([string]::IsNullOrWhiteSpace($clientRelative)) {
                return [pscustomobject]@{
                    Allowed = $false
                    Reason = 'client root folder cannot be copied directly'
                    TargetPath = $null
                }
            }

            return [pscustomobject]@{
                Allowed = $true
                Reason = 'allowed frontend source file'
                TargetPath = Join-Path $script:Paths.PortfolioClientRoot (Join-Path 'src' ($clientRelative -replace '/', '\\'))
            }
        }

        if ($relativeInsideWorkNest.StartsWith('server/', [System.StringComparison]::OrdinalIgnoreCase)) {
            $serverRelative = Normalize-RelativePath ($relativeInsideWorkNest.Substring('server/'.Length))
            if ([string]::IsNullOrWhiteSpace($serverRelative)) {
                return [pscustomobject]@{
                    Allowed = $false
                    Reason = 'server root folder cannot be copied directly'
                    TargetPath = $null
                }
            }

            return [pscustomobject]@{
                Allowed = $true
                Reason = 'allowed backend source file'
                TargetPath = Join-Path $script:Paths.PortfolioServerRoot ($serverRelative -replace '/', '\\')
            }
        }

        return [pscustomobject]@{
            Allowed = $false
            Reason = 'path inside WorkNest is outside the supported client/server sync roots'
            Classification = 'outside-sync-scope'
            TargetPath = $null
        }
    }

    if ($sourceRelativeToGit.StartsWith("$ImagesPrefix/", [System.StringComparison]::OrdinalIgnoreCase)) {
        $imageRelative = Normalize-RelativePath ($sourceRelativeToGit.Substring($ImagesPrefix.Length + 1))
        if ([string]::IsNullOrWhiteSpace($imageRelative)) {
            return [pscustomobject]@{
                Allowed = $false
                Reason = 'images root folder cannot be copied directly'
                TargetPath = $null
            }
        }

        return [pscustomobject]@{
            Allowed = $true
            Reason = 'allowed public image asset'
            TargetPath = Join-Path $script:Paths.PortfolioClientRoot (Join-Path 'public\images' ($imageRelative -replace '/', '\\'))
        }
    }

    return $null
}

function Get-ChangedSourceFiles {
    $tracked = @(Invoke-Git -RepositoryPath $script:SourceGitRoot -Arguments @('diff', '--name-only', 'HEAD', '--'))
    $untracked = @(Invoke-Git -RepositoryPath $script:SourceGitRoot -Arguments @('ls-files', '--others', '--exclude-standard', '--'))

    return @($tracked + $untracked |
        Where-Object { $_ -and $_.Trim() } |
        ForEach-Object { Normalize-RelativePath $_ } |
        Sort-Object -Unique)
}

function Get-GitStatusEntries {
    param([string]$RepositoryPath)

    $entries = New-Object System.Collections.Generic.List[object]
    $lines = @(Invoke-Git -RepositoryPath $RepositoryPath -Arguments @('status', '--porcelain=v1', '--ignored=matching', '--untracked-files=all'))

    foreach ($line in $lines) {
        if (-not $line) {
            continue
        }

        $statusCode = $line.Substring(0, 2)
        $pathPart = $line.Substring(3)

        if ($pathPart -like '* -> *') {
            $pathPart = ($pathPart -split ' -> ', 2)[1]
        }

        $entries.Add([pscustomobject]@{
            StatusCode      = $statusCode
            RelativePath    = Normalize-RelativePath $pathPart
            IsIgnored       = $statusCode -eq '!!'
            IsUntracked     = $statusCode -eq '??'
            HasStagedChange = $statusCode[0] -ne ' ' -and $statusCode[0] -ne '?'
            HasWorktreeChange = $statusCode[1] -ne ' ' -and $statusCode[1] -ne '?'
        })
    }

    return $entries
}

function Get-PortfolioForbiddenScan {
    param([string]$RepositoryPath)

    $workNestPrefix = 'worknest/'
    $blocked = New-Object System.Collections.Generic.List[object]
    $ignored = New-Object System.Collections.Generic.List[object]
    $seenBlocked = @{}

    $trackedFiles = @(Invoke-Git -RepositoryPath $RepositoryPath -Arguments @('ls-files', '--', 'worknest'))
    foreach ($trackedPath in $trackedFiles) {
        $normalizedPath = Normalize-RelativePath $trackedPath
        $reason = Test-ForbiddenRelativePath -RelativePath $normalizedPath
        if (-not $reason) {
            continue
        }

        if (-not $seenBlocked.ContainsKey($normalizedPath)) {
            $seenBlocked[$normalizedPath] = $true
            $blocked.Add([pscustomobject]@{
                RelativePath = $normalizedPath.Substring($workNestPrefix.Length)
                Reason = $reason
                Classification = 'tracked by git'
            })
        }
    }

    $statusEntries = @(Get-GitStatusEntries -RepositoryPath $RepositoryPath)
    foreach ($entry in $statusEntries) {
        if (-not $entry.RelativePath.StartsWith($workNestPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            continue
        }

        $reason = Test-ForbiddenRelativePath -RelativePath $entry.RelativePath
        if (-not $reason) {
            continue
        }

        $reportPath = $entry.RelativePath.Substring($workNestPrefix.Length)

        if ($entry.IsIgnored) {
            $ignored.Add([pscustomobject]@{
                RelativePath = $reportPath
                Reason = $reason
                Classification = 'ignored by git'
            })
            continue
        }

        if (-not $seenBlocked.ContainsKey($entry.RelativePath)) {
            $classification = if ($entry.IsUntracked) {
                'unignored and untracked'
            }
            elseif ($entry.HasStagedChange) {
                'staged in git'
            }
            else {
                'tracked or modified in git'
            }

            $seenBlocked[$entry.RelativePath] = $true
            $blocked.Add([pscustomobject]@{
                RelativePath = $reportPath
                Reason = $reason
                Classification = $classification
            })
        }
    }

    return [pscustomobject]@{
        Blocked = @($blocked | Sort-Object RelativePath, Classification)
        Ignored = @($ignored | Sort-Object RelativePath)
    }
}

$script:Paths = $paths

Write-Section 'Configuration'
$paths.GetEnumerator() | ForEach-Object {
    Write-Host ("{0}: {1}" -f $_.Key, $_.Value)
}

Assert-PathExists -Path $paths.OriginalRepoRoot -Label 'Original repo root'
Assert-PathExists -Path $paths.OriginalWorkNestRoot -Label 'Original WorkNest root'
Assert-PathExists -Path $paths.OriginalImagesRoot -Label 'Original images root'
Assert-PathExists -Path $paths.PortfolioRepoRoot -Label 'Portfolio repo root'
Assert-PathExists -Path $paths.PortfolioWorkNestRoot -Label 'Portfolio WorkNest root'
Assert-PathExists -Path $paths.PortfolioClientRoot -Label 'Portfolio client root'
Assert-PathExists -Path $paths.PortfolioServerRoot -Label 'Portfolio server root'

Write-Section 'Repository Safety Checks'
$actualRemote = (Invoke-Git -RepositoryPath $paths.PortfolioRepoRoot -Arguments @('remote', 'get-url', 'origin') | Select-Object -First 1).Trim()
$actualBranch = (Invoke-Git -RepositoryPath $paths.PortfolioRepoRoot -Arguments @('branch', '--show-current') | Select-Object -First 1).Trim()
$script:SourceGitRoot = (Invoke-Git -RepositoryPath $paths.OriginalRepoRoot -Arguments @('rev-parse', '--show-toplevel') | Select-Object -First 1).Trim()

Write-Host "Portfolio remote: $actualRemote"
Write-Host "Portfolio branch: $actualBranch"
Write-Host "Source git root: $script:SourceGitRoot"

if ($actualRemote -ne $expectedRemote) {
    throw "Portfolio repo remote mismatch. Expected $expectedRemote but found $actualRemote"
}

if ($actualBranch -ne $expectedBranch) {
    throw "Portfolio repo branch mismatch. Expected $expectedBranch but found $actualBranch"
}

$workNestPrefix = Get-RelativePath -BasePath $script:SourceGitRoot -ChildPath $paths.OriginalWorkNestRoot
$imagesPrefix = Get-RelativePath -BasePath $script:SourceGitRoot -ChildPath $paths.OriginalImagesRoot

Write-Host "Source WorkNest prefix: $workNestPrefix"
Write-Host "Source images prefix: $imagesPrefix"

Write-Section 'Sync Plan'
$changedPaths = @(Get-ChangedSourceFiles)
$planItems = New-Object System.Collections.Generic.List[object]
$informationalItems = New-Object System.Collections.Generic.List[object]

foreach ($changedRelativePath in $changedPaths) {
    if (-not ($changedRelativePath.StartsWith("$workNestPrefix/", [System.StringComparison]::OrdinalIgnoreCase) -or
              $changedRelativePath.StartsWith("$imagesPrefix/", [System.StringComparison]::OrdinalIgnoreCase))) {
        continue
    }

    $sourceFullPath = Join-Path $script:SourceGitRoot ($changedRelativePath -replace '/', '\\')

    if (-not (Test-Path -LiteralPath $sourceFullPath)) {
        $planItems.Add([pscustomobject]@{
            Source = $sourceFullPath
            SourceRelative = $changedRelativePath
            Target = ''
            TargetRelative = ''
            Status = 'BLOCKED'
            Reason = 'deleted source files are not synced by this workflow'
        })
        continue
    }

    $mapping = Get-Mapping -SourceFullPath $sourceFullPath -WorkNestPrefix $workNestPrefix -ImagesPrefix $imagesPrefix
    if (-not $mapping) {
        continue
    }

    if (-not $mapping.Allowed -and $mapping.Classification -eq 'outside-sync-scope') {
        $informationalItems.Add([pscustomobject]@{
            Source = $sourceFullPath
            SourceRelative = $changedRelativePath
            Target = ''
            TargetRelative = ''
            Status = 'INFO'
            Reason = if ($changedRelativePath -eq 'From_Web_2_DB/src/WorkNest/scripts/sync-to-public.ps1') {
                'local-only workflow helper; outside sync scope; not copied'
            }
            else {
                'outside sync scope; not copied'
            }
        })
        continue
    }

    $blockReason = Test-ForbiddenRelativePath -RelativePath $changedRelativePath
    $status = 'ALLOWED'
    $reason = $mapping.Reason
    $targetRelative = ''
    $targetPath = ''

    if ($mapping.TargetPath) {
        $targetPath = $mapping.TargetPath
        $targetRelative = Get-RelativePath -BasePath $paths.PortfolioRepoRoot -ChildPath $targetPath
    }

    if ($blockReason) {
        $status = 'BLOCKED'
        $reason = $blockReason
    }
    elseif (-not $mapping.Allowed) {
        $status = 'BLOCKED'
        $reason = $mapping.Reason
    }

    $planItems.Add([pscustomobject]@{
        Source = $sourceFullPath
        SourceRelative = $changedRelativePath
        Target = $targetPath
        TargetRelative = $targetRelative
        Status = $status
        Reason = $reason
    })
}

if ($planItems.Count -eq 0) {
    Write-Host 'No changed files were detected in the supported WorkNest sync areas.'
}
else {
    $planItems |
        Sort-Object Status, SourceRelative |
        Format-Table Status, SourceRelative, TargetRelative, Reason -AutoSize
}

if ($informationalItems.Count -gt 0) {
    Write-Host ''
    Write-Host 'Informational items outside sync scope:'
    $informationalItems |
        Sort-Object SourceRelative |
        Format-Table Status, SourceRelative, Reason -AutoSize
}

$allowedItems = @($planItems | Where-Object { $_.Status -eq 'ALLOWED' })
$blockedItems = @($planItems | Where-Object { $_.Status -eq 'BLOCKED' })

Write-Host "Detected in scope: $($planItems.Count)"
Write-Host "Allowed: $($allowedItems.Count)"
Write-Host "Blocked: $($blockedItems.Count)"
Write-Host "Informational only: $($informationalItems.Count)"
Write-Host "Mode: $(if ($Apply) { 'APPLY' } else { 'DRY-RUN' })"
Write-Host "Build requested: $Build"

if ($Apply) {
    Write-Section 'Applying Approved File Copies'

    foreach ($item in $allowedItems) {
        $targetDirectory = Split-Path -Path $item.Target -Parent
        if (-not (Test-Path -LiteralPath $targetDirectory)) {
            New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
        }

        Copy-Item -LiteralPath $item.Source -Destination $item.Target -Force
        Write-Host "Copied: $($item.SourceRelative) -> $($item.TargetRelative)"
    }
}
else {
    Write-Host 'Dry-run only. No files were copied. Re-run with -Apply to copy allowed files.'
}

if ($Build) {
    Write-Section 'Portfolio Client Build'

    Push-Location $paths.PortfolioClientRoot
    try {
        & npm install --no-package-lock
        if ($LASTEXITCODE -ne 0) {
            throw 'npm install --no-package-lock failed.'
        }

        & npm run build
        if ($LASTEXITCODE -ne 0) {
            throw 'npm run build failed.'
        }
    }
    finally {
        Pop-Location
    }

    $distPath = Join-Path $paths.PortfolioClientRoot 'dist'
    if (Test-Path -LiteralPath $distPath) {
        Remove-Item -LiteralPath $distPath -Recurse -Force
        Write-Host "Removed build output: $distPath"
    }
}
else {
    Write-Section 'Portfolio Client Build'
    Write-Host 'Build skipped. Re-run with -Build to run npm install --no-package-lock and npm run build.'
}

Write-Section 'Forbidden File Scan'
$forbiddenScan = Get-PortfolioForbiddenScan -RepositoryPath $paths.PortfolioRepoRoot
$forbiddenItems = @($forbiddenScan.Blocked)
$ignoredForbiddenItems = @($forbiddenScan.Ignored)
if ($forbiddenItems.Count -eq 0) {
    Write-Host 'No tracked, staged, or unignored forbidden paths were found in the portfolio WorkNest repo.'
}
else {
    $forbiddenItems |
        Format-Table RelativePath, Classification, Reason -AutoSize

    Write-Host "Forbidden items found: $($forbiddenItems.Count)"
}

Write-Section 'Ignored Local Generated Paths'
if ($ignoredForbiddenItems.Count -eq 0) {
    Write-Host 'No ignored forbidden-looking local paths were detected.'
}
else {
    $ignoredForbiddenItems |
        Format-Table RelativePath, Classification, Reason -AutoSize

    Write-Host "Ignored local generated paths: $($ignoredForbiddenItems.Count)"
}

Write-Section 'Final Git Status'
$portfolioStatus = @(Invoke-Git -RepositoryPath $paths.PortfolioRepoRoot -Arguments @('status', '--short', '--untracked-files=all'))
if ($portfolioStatus.Count -eq 0) {
    Write-Host 'Portfolio repo is clean.'
}
else {
    $portfolioStatus | ForEach-Object { Write-Host $_ }
}

Write-Section 'Completed'
Write-Host 'The v1 workflow never commits, pushes, changes remotes, changes branches, or deploys.'
