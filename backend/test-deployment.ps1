# Test Vercel Deployment

param(
    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = "https://tradingbackend-pyfmgr0qs-busine-xa-i-lab.vercel.app"
)

Write-Host "Testing SmartTrade Backend Deployment" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Base URL: $BaseUrl" -ForegroundColor White
Write-Host ""

# Test 1: Health Check
Write-Host "Test 1: Health Check" -ForegroundColor Yellow
Write-Host "Endpoint: $BaseUrl/health" -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get -ErrorAction Stop
    Write-Host "Status: SUCCESS" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor White
} catch {
    Write-Host "Status: FAILED" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Market Indices
Write-Host "Test 2: Market Indices" -ForegroundColor Yellow
Write-Host "Endpoint: $BaseUrl/api/market/indices" -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/market/indices" -Method Get -ErrorAction Stop
    Write-Host "Status: SUCCESS" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Depth 2 -Compress)" -ForegroundColor White
} catch {
    Write-Host "Status: FAILED" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 3: API Root
Write-Host "Test 3: API Root" -ForegroundColor Yellow
Write-Host "Endpoint: $BaseUrl/api" -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api" -Method Get -ErrorAction Stop
    Write-Host "Status: SUCCESS" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor White
} catch {
    Write-Host "Status: FAILED" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

Write-Host "Testing Complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. If tests failed, add environment variables in Vercel" -ForegroundColor White
Write-Host "  2. Go to: https://vercel.com/busine-xa-i-lab/tradingbackend/settings/environment-variables" -ForegroundColor White
Write-Host "  3. Add required variables and redeploy" -ForegroundColor White
Write-Host ""
