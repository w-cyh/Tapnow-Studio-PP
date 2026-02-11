param(
  [string]$HtmlPath
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$distDir = Join-Path $repoRoot "dist"

if (-not $HtmlPath) {
  if (Test-Path $distDir) {
    $HtmlPath = Get-ChildItem -Path $distDir -Filter "Tapnow Studio-V*.html" -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1 |
      ForEach-Object { $_.FullName }
  }
}

if (-not $HtmlPath -and (Test-Path $repoRoot)) {
  $HtmlPath = Get-ChildItem -Path $repoRoot -Filter "Tapnow Studio-V*.html" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 |
    ForEach-Object { $_.FullName }
}

if (-not $HtmlPath -or -not (Test-Path $HtmlPath)) {
  Write-Output "smoke_test failed: build html not found."
  exit 1
}

$content = Get-Content -Path $HtmlPath -Raw -Encoding UTF8
$requiredMarkers = @(
  "__APP_BOOTED__",
  "boot_timeout",
  "error_boundary"
)
$missing = @()
foreach ($marker in $requiredMarkers) {
  if ($content -notmatch [regex]::Escape($marker)) {
    $missing += $marker
  }
}

if ($missing.Count -gt 0) {
  Write-Output "smoke_test failed: missing markers => $($missing -join ', ')"
  exit 1
}

# Static TDZ guard for known high-risk constants used during App module initialization.
$appSourcePath = Join-Path $repoRoot "src\App.jsx"
if (Test-Path $appSourcePath) {
  $appSource = Get-Content -Path $appSourcePath -Raw -Encoding UTF8
  $modelLibraryPos = $appSource.IndexOf("const DEFAULT_MODEL_LIBRARY")
  $imageBatchConstPos = $appSource.IndexOf("const IMAGE_BATCH_MODE_PARALLEL_AGGREGATE")
  if ($modelLibraryPos -ge 0 -and $imageBatchConstPos -ge 0 -and $imageBatchConstPos -gt $modelLibraryPos) {
    Write-Output "smoke_test failed: IMAGE_BATCH_MODE_PARALLEL_AGGREGATE declared after DEFAULT_MODEL_LIBRARY (TDZ risk)."
    exit 1
  }
}

# Runtime smoke test (headless Edge)
$browserPath = $env:TAPNOW_SMOKE_BROWSER
if (-not $browserPath -or -not (Test-Path $browserPath)) {
  $chromeCandidates = @(
    "D:\Chrome-bin\chrome.exe",
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
  )
  foreach ($candidate in $chromeCandidates) {
    if (Test-Path $candidate) {
      $browserPath = $candidate
      break
    }
  }
}

if (-not $browserPath -or -not (Test-Path $browserPath)) {
  Write-Output "smoke_test failed: Chrome not found. Set TAPNOW_SMOKE_BROWSER to chrome.exe path."
  exit 1
}

$fileUrl = ([System.Uri]::new((Resolve-Path $HtmlPath).Path)).AbsoluteUri
$smokeUserDataDir = Join-Path $env:TEMP ("tapnow-smoke-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $smokeUserDataDir -Force | Out-Null
$runtimeOutput = $null
try {
  $runtimeOutput = & $browserPath `
    --headless=new `
    --disable-gpu `
    --no-sandbox `
    --disable-dev-shm-usage `
    --user-data-dir=$smokeUserDataDir `
    --virtual-time-budget=6000 `
    --dump-dom `
    $fileUrl 2>&1
} catch {
  Write-Output "smoke_test failed: headless runtime execution error."
  exit 1
} finally {
  if (Test-Path $smokeUserDataDir) {
    Remove-Item -Path $smokeUserDataDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}

$runtimeText = ($runtimeOutput | ForEach-Object { [string]$_ }) -join "`n"

if ([string]::IsNullOrWhiteSpace($runtimeText)) {
  Write-Output "smoke_test warning: runtime output is empty; runtime DOM assertions skipped."
} else {
  if ($runtimeText -notmatch '<div[^>]*id=["'']root["''][^>]*>') {
    Write-Output "smoke_test failed: runtime root container not found."
    exit 1
  }

  # Catch module-init crashes where fallback UI is not rendered but React never mounts.
  if ($runtimeText -match '<div[^>]*id=["'']root["''][^>]*>\s*</div>') {
    Write-Output "smoke_test failed: runtime root is empty (app did not mount)."
    exit 1
  }

  if ($runtimeText -match "Tapnow 启动失败" -or $runtimeText -match "启动超时" -or $runtimeText -match "APP_BOOT_TIMEOUT") {
    Write-Output "smoke_test failed: runtime boot error detected in DOM."
    exit 1
  }
}

Write-Output "smoke_test ok: $HtmlPath"
