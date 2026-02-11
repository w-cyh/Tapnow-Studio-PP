param(
  [string]$Tag = "manual",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$scriptsDir = Join-Path $repoRoot "scripts"
$backupsDir = Join-Path $repoRoot "backups"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$tagSafe = ($Tag -replace '[^A-Za-z0-9_.-]', '_')

if (-not (Test-Path $scriptsDir)) {
  throw "scripts directory not found: $scriptsDir"
}
if (-not (Test-Path $backupsDir)) {
  New-Item -ItemType Directory -Path $backupsDir | Out-Null
}

$scriptFiles = Get-ChildItem -Path $scriptsDir -File -Recurse | Sort-Object FullName
if (-not $scriptFiles -or $scriptFiles.Count -eq 0) {
  throw "scripts directory is empty, cannot backup."
}

$manifestFiles = @()
foreach ($file in $scriptFiles) {
  $hash = Get-FileHash -Path $file.FullName -Algorithm SHA256
  $relPath = $file.FullName.Substring($repoRoot.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar).Replace([System.IO.Path]::DirectorySeparatorChar, '/')
  $manifestFiles += [ordered]@{
    path = $relPath
    size = $file.Length
    modified = $file.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
    sha256 = $hash.Hash
  }
}

$fingerprintLines = $manifestFiles | Sort-Object path | ForEach-Object { "$($_.path)|$($_.size)|$($_.sha256)" }
$fingerprintText = [string]::Join("`n", $fingerprintLines)
$fingerprintBytes = [System.Text.Encoding]::UTF8.GetBytes($fingerprintText)
$fingerprintStream = [System.IO.MemoryStream]::new($fingerprintBytes)
$treeSha256 = (Get-FileHash -Algorithm SHA256 -InputStream $fingerprintStream).Hash
$fingerprintStream.Dispose()

$latestManifest = Get-ChildItem -Path $backupsDir -Filter "scripts_backup_*.manifest.json" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if ($latestManifest -and -not $Force) {
  $latest = Get-Content -Path $latestManifest.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
  if ([string]$latest.tree_sha256 -eq [string]$treeSha256) {
    Write-Output "scripts_backup skipped: scripts tree unchanged."
    Write-Output "latest_manifest: $($latestManifest.FullName)"
    exit 0
  }
}

$zipName = "scripts_backup_{0}_{1}.zip" -f $tagSafe, $stamp
$zipPath = Join-Path $backupsDir $zipName
$manifestName = "scripts_backup_{0}_{1}.manifest.json" -f $tagSafe, $stamp
$manifestPath = Join-Path $backupsDir $manifestName

Compress-Archive -Path (Join-Path $scriptsDir "*") -DestinationPath $zipPath -Force

$manifest = [ordered]@{
  created_at = $timestamp
  tag = $Tag
  repo_root = $repoRoot
  scripts_root = $scriptsDir
  file_count = $manifestFiles.Count
  tree_sha256 = $treeSha256
  zip = $zipPath.Substring($repoRoot.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar).Replace([System.IO.Path]::DirectorySeparatorChar, '/')
  files = $manifestFiles
}

$manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $manifestPath -Encoding UTF8

Write-Output "scripts_backup created."
Write-Output "zip: $zipPath"
Write-Output "manifest: $manifestPath"
