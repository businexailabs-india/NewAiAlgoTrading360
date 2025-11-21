# Script to set environment variables in GCP Cloud Run
# This helps you quickly set all required environment variables

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectId,
    
    [Parameter(Mandatory=$false)]
    [string]$ServiceName = 'smarttrade-backend',
    
    [Parameter(Mandatory=$false)]
    [string]$Region = 'asia-south1',
    
    [Parameter(Mandatory=$false)]
    [string]$EnvFile = '.env'
)

Write-Host "🔧 Setting Environment Variables for Cloud Run" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (-not (Test-Path $EnvFile)) {
    Write-Host "❌ Error: $EnvFile file not found!" -ForegroundColor Red
    Write-Host "Please create a .env file with your production values" -ForegroundColor Yellow
    exit 1
}

# Set project
Write-Host "📋 Setting project to: $ProjectId" -ForegroundColor Yellow
gcloud config set project $ProjectId

# Read .env file and parse variables
Write-Host "📖 Reading environment variables from $EnvFile..." -ForegroundColor Yellow
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
            $envVars += "$key=$value"
            Write-Host "  ✓ $key" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ Skipping $key (empty or placeholder value)" -ForegroundColor Yellow
        }
    }
}

if ($envVars.Count -eq 0) {
    Write-Host ""
    Write-Host "❌ No valid environment variables found!" -ForegroundColor Red
    Write-Host "Please check your $EnvFile file" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "📤 Updating Cloud Run service with $($envVars.Count) environment variables..." -ForegroundColor Yellow
Write-Host ""

# Build the gcloud command
$cmd = "gcloud run services update $ServiceName --region $Region"
foreach ($var in $envVars) {
    $cmd += " --set-env-vars `"$var`""
}

# Execute the command
try {
    Invoke-Expression $cmd
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Environment variables updated successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🌐 Your service URL:" -ForegroundColor Cyan
        $serviceUrl = gcloud run services describe $ServiceName --region $Region --format="value(status.url)"
        Write-Host "   $serviceUrl" -ForegroundColor Green
        Write-Host ""
        Write-Host "🧪 Test your deployment:" -ForegroundColor Yellow
        Write-Host "   curl $serviceUrl/health" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "❌ Failed to update environment variables!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📝 Note: Sensitive values should be stored in Secret Manager" -ForegroundColor Yellow
Write-Host "   Learn more: https://cloud.google.com/secret-manager" -ForegroundColor White
Write-Host ""
