# Update Cloud Run Environment Variables
# This script reads from your .env file and updates Cloud Run

Write-Host "🔄 Updating Cloud Run Environment Variables..." -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ Error: .env file not found!" -ForegroundColor Red
    Write-Host "Please create a .env file with your actual credentials first." -ForegroundColor Yellow
    exit 1
}

# Read .env file and extract values
$envVars = @{}
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.+)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        $envVars[$key] = $value
    }
}

# Check if required variables exist
$requiredVars = @('SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY', 'JWT_SECRET', 'REFRESH_TOKEN_SECRET')
$missingVars = @()

foreach ($var in $requiredVars) {
    if (-not $envVars.ContainsKey($var) -or $envVars[$var] -like '*your-*' -or $envVars[$var] -like '*placeholder*') {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host "⚠️  Warning: The following variables have placeholder values:" -ForegroundColor Yellow
    foreach ($var in $missingVars) {
        Write-Host "   - $var" -ForegroundColor Yellow
    }
    Write-Host ""
    $continue = Read-Host "Do you want to continue anyway? (y/N)"
    if ($continue -ne 'y' -and $continue -ne 'Y') {
        Write-Host "❌ Aborted. Please update your .env file with real values first." -ForegroundColor Red
        exit 1
    }
}

# Build env vars string
$envVarString = "NODE_ENV=production"
foreach ($var in $requiredVars) {
    if ($envVars.ContainsKey($var)) {
        $envVarString += ",$var=$($envVars[$var])"
    }
}

Write-Host "📝 Environment variables to update:" -ForegroundColor Cyan
foreach ($var in $requiredVars) {
    if ($envVars.ContainsKey($var)) {
        $maskedValue = if ($envVars[$var].Length -gt 20) {
            $envVars[$var].Substring(0, 20) + "..."
        } else {
            $envVars[$var]
        }
        Write-Host "   $var = $maskedValue" -ForegroundColor White
    }
}
Write-Host ""

$confirm = Read-Host "Update Cloud Run with these values? (y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "❌ Aborted." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🚀 Updating Cloud Run service..." -ForegroundColor Yellow

# Update Cloud Run
gcloud run services update smarttrade-backend `
    --region=asia-south1 `
    --update-env-vars="$envVarString"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Environment variables updated successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔄 Waiting for new revision to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    Write-Host ""
    Write-Host "🧪 Testing the deployment..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri "https://smarttrade-backend-xdubwwouqq-el.a.run.app/health" -UseBasicParsing -TimeoutSec 30
        Write-Host "✅ Health check passed! Status: $($response.StatusCode)" -ForegroundColor Green
        Write-Host ""
        Write-Host "🎉 Backend is now live and working!" -ForegroundColor Green
        Write-Host "🌐 URL: https://smarttrade-backend-xdubwwouqq-el.a.run.app" -ForegroundColor Cyan
    } catch {
        Write-Host "⚠️  Health check failed. Please check the logs:" -ForegroundColor Yellow
        Write-Host "   gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=smarttrade-backend' --limit=10 --project=businexaitrading-478908" -ForegroundColor Cyan
    }
} else {
    Write-Host ""
    Write-Host "❌ Failed to update environment variables!" -ForegroundColor Red
    exit 1
}

Write-Host ""
