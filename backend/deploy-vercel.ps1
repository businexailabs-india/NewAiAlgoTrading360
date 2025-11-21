# SmartTrade Backend - Vercel Deployment Script

Write-Host "Deploying SmartTrade Backend to Vercel..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if vercel is installed
try {
    $vercelVersion = vercel --version 2>&1
    Write-Host "Vercel CLI: $vercelVersion" -ForegroundColor Green
} catch {
    Write-Host "Error: Vercel CLI not found!" -ForegroundColor Red
    Write-Host "Install with: npm install -g vercel" -ForegroundColor Yellow
    exit 1
}

# Remove existing .vercel config if any
if (Test-Path ".vercel") {
    Write-Host "Removing existing .vercel configuration..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force .vercel
}

# Set git config to avoid team access issues
Write-Host "Configuring git author..." -ForegroundColor Yellow
git config user.email "admin@edgexailabs.com"
git config user.name "BusineXAiLab"

Write-Host ""
Write-Host "Starting deployment..." -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT: When prompted:" -ForegroundColor Yellow
Write-Host "  1. Set up and deploy? -> Press Y" -ForegroundColor White
Write-Host "  2. Which scope? -> Select BusineXAiLab (or your personal account)" -ForegroundColor White
Write-Host "  3. Link to existing project? -> Press N (for new) or Y (for existing)" -ForegroundColor White
Write-Host "  4. Project name? -> Enter: smarttrade-backend" -ForegroundColor White
Write-Host ""

# Deploy
vercel --prod

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Add environment variables in Vercel dashboard" -ForegroundColor White
Write-Host "  2. Go to: https://vercel.com/dashboard" -ForegroundColor White
Write-Host "  3. Select your project -> Settings -> Environment Variables" -ForegroundColor White
Write-Host ""
