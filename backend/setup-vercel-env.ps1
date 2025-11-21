# Setup Environment Variables for Vercel Deployment

param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectName = "tradingbackend",
    
    [Parameter(Mandatory=$false)]
    [string]$EnvFile = ".env"
)

Write-Host "Setting up Environment Variables for Vercel" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (-not (Test-Path $EnvFile)) {
    Write-Host "Error: $EnvFile file not found!" -ForegroundColor Red
    Write-Host "Please create a .env file with your production values" -ForegroundColor Yellow
    exit 1
}

Write-Host "Reading environment variables from $EnvFile..." -ForegroundColor Yellow
Write-Host ""

# Read .env file
$envVars = @()
$envContent = Get-Content $EnvFile

foreach ($line in $envContent) {
    # Skip empty lines and comments
    if ($line -match '^\s*$' -or $line -match '^\s*#') {
        continue
    }
    
    # Parse KEY=VALUE
    if ($line -match '^([^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        
        # Remove quotes if present
        $value = $value -replace '^"(.*)"$', '$1'
        $value = $value -replace "^'(.*)'$", '$1'
        
        # Skip if value is empty or placeholder
        if ($value -and $value -notmatch '^(your|change|example|localhost)') {
            $envVars += @{Key=$key; Value=$value}
            Write-Host "  Found: $key" -ForegroundColor Green
        }
    }
}

Write-Host ""
Write-Host "Found $($envVars.Count) environment variables" -ForegroundColor Cyan
Write-Host ""

if ($envVars.Count -eq 0) {
    Write-Host "No valid environment variables found!" -ForegroundColor Red
    Write-Host "Please update your .env file with production values" -ForegroundColor Yellow
    exit 1
}

Write-Host "To add these to Vercel, run these commands:" -ForegroundColor Yellow
Write-Host ""

foreach ($var in $envVars) {
    $escapedValue = $var.Value -replace '"', '\"'
    Write-Host "vercel env add $($var.Key) production" -ForegroundColor Cyan
    Write-Host "# Enter value: $escapedValue" -ForegroundColor Gray
    Write-Host ""
}

Write-Host ""
Write-Host "Or add them manually in the Vercel dashboard:" -ForegroundColor Yellow
Write-Host "https://vercel.com/busine-xa-i-lab/$ProjectName/settings/environment-variables" -ForegroundColor White
Write-Host ""
