param(
  [switch]$Strict
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$issues = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

function Add-Issue {
  param([string]$Message)
  $issues.Add($Message) | Out-Null
}

function Add-Warning {
  param([string]$Message)
  $warnings.Add($Message) | Out-Null
}

$requiredDirs = @("src", "docs", "backups", "dist")
foreach ($dir in $requiredDirs) {
  $path = Join-Path $repoRoot $dir
  if (-not (Test-Path $path)) {
    Add-Issue "Missing directory: $dir"
  }
}

$requiredFiles = @(
  "docs\\AG_STATE.md",
  "docs\\feature_pool.md",
  "docs\\user_requirements_raw.md",
  "changelog.md",
  "docs\\kanban.json"
)
foreach ($file in $requiredFiles) {
  $path = Join-Path $repoRoot $file
  if (-not (Test-Path $path)) {
    Add-Issue "Missing file: $file"
  }
}

$agPath = Join-Path $repoRoot "docs\\AG_STATE.md"
if (Test-Path $agPath) {
  $content = Get-Content -Path $agPath -Raw
  if ($content -notmatch "<!-- AG_STATE:AUTO:START -->") {
    Add-Issue "AG_STATE auto block start marker missing."
  }
  if ($content -notmatch "<!-- AG_STATE:AUTO:END -->") {
    Add-Issue "AG_STATE auto block end marker missing."
  }
  if ($content -match "\{\{last_run\}\}" -or $content -match "\{\{version\}\}") {
    Add-Warning "AG_STATE auto placeholders still present. Run scripts/finish_task.ps1."
  }
}

$backupsDir = Join-Path $repoRoot "backups"
if (Test-Path $backupsDir) {
  $backupZips = Get-ChildItem -Path $backupsDir -Filter "src_backup_*.zip" -Recurse -ErrorAction SilentlyContinue
  if (-not $backupZips) {
    Add-Warning "No src_backup_*.zip found under backups/."
  }
}

$stampPath = Join-Path $repoRoot ".waylog\\finish_task_stamp.json"
if (-not (Test-Path $stampPath)) {
  Add-Warning "finish_task stamp missing: .waylog/finish_task_stamp.json"
}

if ($issues.Count -gt 0) {
  Write-Output "Preflight failed:"
  foreach ($issue in $issues) {
    Write-Output "  - $issue"
  }
  exit 1
}

if ($warnings.Count -gt 0) {
  Write-Output "Preflight warnings:"
  foreach ($warning in $warnings) {
    Write-Output "  - $warning"
  }
  if ($Strict) {
    exit 1
  }
}

Write-Output "Preflight ok."
