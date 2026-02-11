param(
  [string]$Version,
  [string]$Tag = "finish_task",
  [switch]$SkipBackup,
  [string]$SkipBackupApproval,
  [string]$SkipBackupReason,
  [string]$AllowSameSourceBackupApproval,
  [string]$AllowSameSourceBackupReason,
  [switch]$SkipBuild,
  [switch]$SkipSmokeTest,
  [switch]$SkipAgState,
  [switch]$SkipStamp
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$stampShort = Get-Date -Format "yyyyMMdd-HHmmss"
$packageJson = Join-Path $repoRoot "package.json"
$backupDisplay = "(pending)"
$backupStamp = ""
$backupSkipReason = ""
$localserverBackupStatus = ""
$sameSourceBackupReason = ""

function Get-NextRcVersion {
  param(
    [string]$CurrentVersion
  )

  $trimmed = [string]$CurrentVersion
  if ([string]::IsNullOrWhiteSpace($trimmed)) {
    return "0.0.1-rc1"
  }
  $trimmed = $trimmed.Trim()

  $match = [regex]::Match($trimmed, '^(?<core>\d+\.\d+\.\d+)(?:-rc(?<rc>\d+))?$')
  if (-not $match.Success) {
    return "$trimmed-rc1"
  }

  $core = $match.Groups['core'].Value
  $rcToken = $match.Groups['rc'].Value
  if ([string]::IsNullOrWhiteSpace($rcToken)) {
    return "$core-rc1"
  }
  $rcNumber = 0
  if (-not [int]::TryParse($rcToken, [ref]$rcNumber)) {
    return "$core-rc1"
  }
  return "$core-rc$($rcNumber + 1)"
}

function Get-BackupRootFileCandidates {
  param(
    [string]$RepoRoot
  )

  return @(
    "package.json",
    "package-lock.json",
    "index.html",
    "vite.config.js",
    "postcss.config.js",
    "tailwind.config.js"
  ) | ForEach-Object { Join-Path $RepoRoot $_ } | Where-Object { Test-Path $_ }
}

function New-BackupManifest {
  param(
    [string]$RepoRoot,
    [string]$SrcPath,
    [string[]]$RootFiles,
    [string]$VersionTag,
    [string]$Timestamp,
    [string]$Tag
  )

  $manifestItems = @()

  Get-ChildItem -Path $SrcPath -File -Recurse | ForEach-Object {
    $hash = Get-FileHash -Path $_.FullName -Algorithm SHA256
    $relPath = $_.FullName.Replace($RepoRoot + "\", "").Replace("\", "/")
    $manifestItems += [ordered]@{
      path = $relPath
      size = $_.Length
      modified = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
      sha256 = $hash.Hash
    }
  }

  foreach ($file in $RootFiles) {
    $item = Get-Item -Path $file
    $hash = Get-FileHash -Path $file -Algorithm SHA256
    $relPath = $file.Replace($RepoRoot + "\", "").Replace("\", "/")
    $manifestItems += [ordered]@{
      path = $relPath
      size = $item.Length
      modified = $item.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
      sha256 = $hash.Hash
    }
  }

  $fingerprintLines = $manifestItems | Sort-Object path | ForEach-Object { "$($_.path)|$($_.size)|$($_.sha256)" }
  $fingerprintText = [string]::Join("`n", $fingerprintLines)
  $fingerprintHash = (Get-FileHash -Algorithm SHA256 -InputStream ([System.IO.MemoryStream]::new([System.Text.Encoding]::UTF8.GetBytes($fingerprintText)))).Hash

  return [ordered]@{
    version = $VersionTag
    tag = $Tag
    created_at = $Timestamp
    repo_root = $RepoRoot
    file_count = $manifestItems.Count
    tree_sha256 = $fingerprintHash
    files = $manifestItems
  }
}

$packageRaw = $null
$packageVersion = $null
if (Test-Path $packageJson) {
  try {
    $packageRaw = Get-Content -Path $packageJson -Raw -Encoding UTF8
    $pkg = $packageRaw | ConvertFrom-Json
    $packageVersion = [string]$pkg.version
  } catch {
    $packageVersion = $null
  }
}

if (-not $Version) {
  if ($packageVersion) {
    $Version = Get-NextRcVersion -CurrentVersion $packageVersion
  } else {
    $Version = "unknown"
  }
}

if ((Test-Path $packageJson) -and $Version -and $Version -ne "unknown") {
  try {
    if (-not $packageRaw) {
      $packageRaw = Get-Content -Path $packageJson -Raw -Encoding UTF8
    }
    $normalizedVersion = [string]$Version
    if ($packageVersion -ne $normalizedVersion) {
      $updatedRaw = $packageRaw -replace '"version"\s*:\s*"[^"]+"', "`"version`": `"$normalizedVersion`""
      if ($updatedRaw -ne $packageRaw) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($packageJson, $updatedRaw, $utf8NoBom)
      }
    }
  } catch {
    Write-Warning "Failed to update package.json version: $($_.Exception.Message)"
  }
}

$versionTag = $Version
if (-not $versionTag) {
  $versionTag = "unknown"
}
if (-not $versionTag.StartsWith("v")) {
  $versionTag = "v$versionTag"
}

if ($SkipBackup) {
  if ($SkipBackupApproval -ne "USER_CONFIRMED") {
    throw "SkipBackup requires explicit user confirmation. Re-run with -SkipBackupApproval USER_CONFIRMED and a non-empty -SkipBackupReason."
  }
  if ([string]::IsNullOrWhiteSpace($SkipBackupReason)) {
    throw "SkipBackup requires -SkipBackupReason (why user approved skipping backup)."
  }
  $backupSkipReason = $SkipBackupReason.Trim()
  $backupDisplay = "(skipped by explicit user confirmation)"
  $backupStamp = "SKIPPED:$backupSkipReason"
  Write-Warning "Backup is skipped by explicit user confirmation. reason=$backupSkipReason"
}

if ($AllowSameSourceBackupApproval) {
  if ($AllowSameSourceBackupApproval -ne "USER_CONFIRMED") {
    throw "AllowSameSourceBackup requires explicit user confirmation. Re-run with -AllowSameSourceBackupApproval USER_CONFIRMED and a non-empty -AllowSameSourceBackupReason."
  }
  if ([string]::IsNullOrWhiteSpace($AllowSameSourceBackupReason)) {
    throw "AllowSameSourceBackup requires -AllowSameSourceBackupReason."
  }
  $sameSourceBackupReason = $AllowSameSourceBackupReason.Trim()
}

$backupPath = $null
$localserverBackupPath = $null
if (-not $SkipBackup) {
  $srcPath = Join-Path $repoRoot "src"
  if (-not (Test-Path $srcPath)) {
    throw "src folder not found: $srcPath"
  }

  $backupsDir = Join-Path $repoRoot "backups"
  if (-not (Test-Path $backupsDir)) {
    New-Item -ItemType Directory -Path $backupsDir | Out-Null
  }

  $tagSafe = $Tag -replace '[^A-Za-z0-9_.-]', '_'
  $backupName = "src_backup_{0}_{1}_{2}.zip" -f $versionTag, $tagSafe, $stampShort
  $backupPath = Join-Path $backupsDir $backupName
  $backupRootFiles = Get-BackupRootFileCandidates -RepoRoot $repoRoot
  $backupSources = @($srcPath)
  if ($backupRootFiles.Count -gt 0) {
    $backupSources += $backupRootFiles
  }

  $latestManifest = Get-ChildItem -Path $backupsDir -Filter "src_backup_*_*.manifest.json" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  $manifest = New-BackupManifest `
    -RepoRoot $repoRoot `
    -SrcPath $srcPath `
    -RootFiles $backupRootFiles `
    -VersionTag $versionTag `
    -Timestamp $timestamp `
    -Tag $Tag

  if ($latestManifest) {
    $latest = Get-Content -Path $latestManifest.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
    $latestTree = [string]$latest.tree_sha256
    $currentTree = [string]$manifest.tree_sha256
    if (-not [string]::IsNullOrWhiteSpace($latestTree) -and $latestTree -eq $currentTree) {
      if ($AllowSameSourceBackupApproval -ne "USER_CONFIRMED") {
        throw "Source tree is identical to latest backup ($($latestManifest.Name)). Re-run with -AllowSameSourceBackupApproval USER_CONFIRMED and -AllowSameSourceBackupReason to proceed."
      }
    }
  }
  Compress-Archive -Path $backupSources -DestinationPath $backupPath -Force
  $manifestPath = Join-Path $backupsDir ("src_backup_{0}_{1}_{2}.manifest.json" -f $versionTag, $tagSafe, $stampShort)
  $manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -Encoding UTF8

  $localserverPath = Join-Path $repoRoot "localserver"
  $localserverBackupStatus = "localserver:(skipped - no changes)"
  if (Test-Path $localserverPath) {
    $shouldBackupLocalserver = $false
    try {
      $gitStatus = & git -C $repoRoot status --porcelain -- localserver 2>$null
      if ($LASTEXITCODE -eq 0) {
        $shouldBackupLocalserver = -not [string]::IsNullOrWhiteSpace($gitStatus)
      } else {
        Write-Warning "git status localserver failed; localserver backup will be created for safety."
        $shouldBackupLocalserver = $true
      }
    } catch {
      Write-Warning "git status localserver threw exception; localserver backup will be created for safety."
      $shouldBackupLocalserver = $true
    }

    if ($shouldBackupLocalserver) {
      $localserverBackupName = "localserver_backup_{0}_{1}_{2}.zip" -f $versionTag, $tagSafe, $stampShort
      $localserverBackupPath = Join-Path $backupsDir $localserverBackupName
      Compress-Archive -Path $localserverPath -DestinationPath $localserverBackupPath -Force
      $localserverBackupStatus = "localserver:$($localserverBackupPath.Replace($repoRoot + '\', ''))"
    }
  }

  $backupParts = @("src:$($backupPath.Replace($repoRoot + '\', ''))", "manifest:$($manifestPath.Replace($repoRoot + '\', ''))")
  if ($localserverBackupPath) {
    $backupParts += "localserver:$($localserverBackupPath.Replace($repoRoot + '\', ''))"
  } else {
    $backupParts += $localserverBackupStatus
  }
  $backupDisplay = $backupParts -join "; "
  $backupStamp = $backupDisplay
}

if (-not $SkipBuild) {
  Push-Location $repoRoot
  try {
    & npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "npm run build failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

$buildHtml = "(not found)"
$buildFile = $null
$distDir = Join-Path $repoRoot "dist"
if (Test-Path $distDir) {
  $buildFile = Get-ChildItem -Path $distDir -Filter "Tapnow Studio-V*.html" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
}
if (-not $buildFile) {
  $buildFile = Get-ChildItem -Path $repoRoot -Filter "Tapnow Studio-V*.html" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
}
if ($buildFile) {
  $buildHtml = $buildFile.FullName.Replace("$repoRoot\\", "").Replace("\\", "/")
}

if (-not $SkipSmokeTest) {
  $smokeScript = Join-Path $repoRoot "scripts\smoke_test.ps1"
  if (-not (Test-Path $smokeScript)) {
    throw "smoke_test script not found: $smokeScript"
  }
  Push-Location $repoRoot
  try {
    if ($buildFile) {
      & $smokeScript -HtmlPath $buildFile.FullName
    } else {
      & $smokeScript
    }
    if ($LASTEXITCODE -ne 0) {
      throw "smoke_test failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

if (-not $SkipAgState) {
  $agPath = Join-Path $repoRoot "docs\\AG_STATE.md"
  if (-not (Test-Path $agPath)) {
    throw "AG_STATE not found: $agPath"
  }

  $content = Get-Content -Path $agPath -Raw -Encoding UTF8
  $startMarker = "<!-- AG_STATE:AUTO:START -->"
  $endMarker = "<!-- AG_STATE:AUTO:END -->"
  $startIndex = $content.IndexOf($startMarker)
  $endIndex = $content.IndexOf($endMarker)
  if ($startIndex -lt 0 -or $endIndex -lt 0 -or $endIndex -lt $startIndex) {
    throw "AG_STATE auto block markers not found."
  }

  $blockLength = $endIndex + $endMarker.Length - $startIndex
  $block = $content.Substring($startIndex, $blockLength)
  $docsCheck = "docs/feature_pool.md, docs/user_requirements_raw.md, changelog.md, docs/AG_STATE.md"

  $block = $block -replace "\{\{last_run\}\}", $timestamp
  $block = $block -replace "\{\{version\}\}", $versionTag
  $block = $block -replace "\{\{backup_zip\}\}", $backupDisplay
  $block = $block -replace "\{\{build_html\}\}", $buildHtml
  $block = $block -replace "\{\{docs_check\}\}", $docsCheck

  $lines = $block -split "(?:`r`n|`n|`r)"
  $itemIndexes = @()
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^- ") {
      $itemIndexes += $i
    }
  }
  if ($itemIndexes.Count -ge 5) {
    $lines[$itemIndexes[0]] = ($lines[$itemIndexes[0]] -replace "\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$", $timestamp)
    $lines[$itemIndexes[1]] = ($lines[$itemIndexes[1]] -replace ":\s+.*$", ": $versionTag")
    $lines[$itemIndexes[2]] = ($lines[$itemIndexes[2]] -replace ":\s+.*$", ": $backupDisplay")
    $lines[$itemIndexes[3]] = ($lines[$itemIndexes[3]] -replace ":\s+.*$", ": $buildHtml")
    $lines[$itemIndexes[4]] = ($lines[$itemIndexes[4]] -replace ":\s+.*$", ": $docsCheck")
    $block = $lines -join "`r`n"
  }

  $content = $content.Remove($startIndex, $blockLength).Insert($startIndex, $block)
  Set-Content -Path $agPath -Value $content -Encoding UTF8
}

if (-not $SkipStamp) {
  $waylogDir = Join-Path $repoRoot ".waylog"
  if (-not (Test-Path $waylogDir)) {
    New-Item -ItemType Directory -Path $waylogDir | Out-Null
  }

  $stampPath = Join-Path $waylogDir "finish_task_stamp.json"
  $stamp = [ordered]@{
    last_run = $timestamp
    version = $versionTag
    backup_zip = $backupStamp
    backup_skip_reason = $backupSkipReason
    backup_same_source_reason = $sameSourceBackupReason
    build_html = $buildHtml
    docs_check = @(
      "docs/feature_pool.md",
      "docs/user_requirements_raw.md",
      "changelog.md",
      "docs/AG_STATE.md"
    )
  }

  $stamp | ConvertTo-Json -Depth 3 | Set-Content -Path $stampPath -Encoding UTF8
}

Write-Output "finish_task completed."
if ($backupPath) {
  Write-Output "backup(src): $backupPath"
}
if ($localserverBackupPath) {
  Write-Output "backup(localserver): $localserverBackupPath"
} elseif (-not $SkipBackup -and $localserverBackupStatus) {
  Write-Output $localserverBackupStatus
}
if ($SkipBackup -and $backupSkipReason) {
  Write-Output "backup(skipped): $backupSkipReason"
}
if ($sameSourceBackupReason) {
  Write-Output "backup(same-source-approved): $sameSourceBackupReason"
}
Write-Output "build: $buildHtml"
