#!/usr/bin/env pwsh

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$stampPath = Join-Path $repoRoot ".waylog\\finish_task_stamp.json"

if (-not (Test-Path $stampPath)) {
  Write-Output "finish_task stamp missing. Run scripts/finish_task.ps1 before commit."
  exit 1
}

$stampTime = (Get-Item $stampPath).LastWriteTime
$stampJson = Get-Content -Path $stampPath -Raw -Encoding UTF8 | ConvertFrom-Json
$backupZip = [string]$stampJson.backup_zip
$backupSkipReason = [string]$stampJson.backup_skip_reason
$sameSourceReason = [string]$stampJson.backup_same_source_reason

if ([string]::IsNullOrWhiteSpace($backupZip)) {
  Write-Output "finish_task stamp has empty backup record. Run scripts/finish_task.ps1 with backup enabled."
  exit 1
}

if ($backupZip.StartsWith("SKIPPED:")) {
  if ($env:ALLOW_SKIP_BACKUP_COMMIT -ne "1") {
    Write-Output "backup was skipped in latest finish_task. Commit blocked. Set ALLOW_SKIP_BACKUP_COMMIT=1 only when user explicitly approved skip."
    if (-not [string]::IsNullOrWhiteSpace($backupSkipReason)) {
      Write-Output "skip reason: $backupSkipReason"
    }
    exit 1
  }
}

if (-not [string]::IsNullOrWhiteSpace($sameSourceReason)) {
  if ($env:ALLOW_SAME_SOURCE_BACKUP_COMMIT -ne "1") {
    Write-Output "backup used same-source approval. Commit blocked. Set ALLOW_SAME_SOURCE_BACKUP_COMMIT=1 only when user explicitly approved."
    Write-Output "same-source reason: $sameSourceReason"
    exit 1
  }
}

$stagedFiles = & git -C $repoRoot diff --name-only --cached
if ($LASTEXITCODE -ne 0) {
  Write-Output "git diff failed. Unable to validate finish_task stamp."
  exit 1
}

if (-not $stagedFiles) {
  exit 0
}

$latestChange = $null
foreach ($file in $stagedFiles) {
  if (-not $file) {
    continue
  }
  $fullPath = Join-Path $repoRoot $file
  if (-not (Test-Path $fullPath)) {
    continue
  }
  $mtime = (Get-Item $fullPath).LastWriteTime
  if ($null -eq $latestChange -or $mtime -gt $latestChange) {
    $latestChange = $mtime
  }
}

if ($latestChange -and $stampTime -lt $latestChange) {
  Write-Output "finish_task stamp is older than staged changes. Run scripts/finish_task.ps1."
  exit 1
}

exit 0
