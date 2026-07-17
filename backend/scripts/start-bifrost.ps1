# Start Bifrost LLM gateway (Anthropic drop-in at http://localhost:8080/anthropic)
# Prefer local binary (Windows npx wrapper can mis-name the .exe). Fallback: Docker / npx.

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$AppDir = Join-Path $Root 'bifrost'
$BinDir = Join-Path $AppDir 'bin'
$Exe = Join-Path $BinDir 'bifrost-http.exe'
$Port = if ($env:BIFROST_PORT) { $env:BIFROST_PORT } else { '8080' }

# Load ANTHROPIC_API_KEY from backend/.env when not already set
if (-not $env:ANTHROPIC_API_KEY) {
  $envFile = Join-Path $Root '.env'
  if (Test-Path $envFile) {
    $line = Get-Content $envFile | Where-Object { $_ -match '^ANTHROPIC_API_KEY=' } | Select-Object -First 1
    if ($line) {
      $env:ANTHROPIC_API_KEY = ($line -replace '^ANTHROPIC_API_KEY=', '').Trim()
    }
  }
}

function Get-LatestBifrostTag {
  try {
    return (Invoke-RestMethod 'https://getbifrost.ai/latest-release').name
  } catch {
    return 'v1.6.4'
  }
}

function Ensure-BifrostBinary {
  if ((Test-Path $Exe) -and ((Get-Item $Exe).Length -gt 50MB)) {
    return
  }
  New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
  $ver = Get-LatestBifrostTag
  $url = "https://downloads.getmaxim.ai/bifrost/$ver/windows/amd64/bifrost-http.exe"
  Write-Host "Downloading Bifrost $ver ..."
  Invoke-WebRequest -Uri $url -OutFile $Exe -UseBasicParsing
  Write-Host "Saved $Exe"
}

Ensure-BifrostBinary
Write-Host "Starting Bifrost on port $Port (app-dir=$AppDir)"
Write-Host "UI: http://localhost:$Port  |  Anthropic: http://localhost:$Port/anthropic"
& $Exe -app-dir $AppDir -port $Port -host '0.0.0.0'
