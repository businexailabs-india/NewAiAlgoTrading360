# Run advisory Python tests per-service to avoid colliding "app" packages.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $Root "services"))) {
  $Root = $PSScriptRoot
  if (-not (Test-Path (Join-Path $Root "services"))) {
    $Root = (Get-Location).Path
  }
}

$suites = @(
  "services\ai-advisory-service\tests",
  "services\external-algo-discovery-service\tests",
  "services\paper-test-orchestrator\tests",
  "services\dhanlaxmi-assistant-service\tests"
)

$failed = 0
foreach ($suite in $suites) {
  Write-Host "`n=== pytest $suite ===" -ForegroundColor Cyan
  Push-Location $Root
  try {
    python -m pytest $suite -q --tb=short
    if ($LASTEXITCODE -ne 0) { $failed = 1 }
  } finally {
    Pop-Location
  }
}

if ($failed -ne 0) {
  Write-Error "One or more advisory test suites failed"
  exit 1
}
Write-Host "`nAll advisory pytest suites passed." -ForegroundColor Green
