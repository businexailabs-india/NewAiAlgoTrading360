# Add All Environment Variables to Vercel at Once

Write-Host "Adding All Environment Variables to Vercel" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Function to add environment variable
function Add-VercelEnv {
    param($Name, $Value)
    
    Write-Host "Adding $Name..." -ForegroundColor Yellow
    $tempFile = New-TemporaryFile
    Set-Content -Path $tempFile.FullName -Value $Value -NoNewline
    Get-Content $tempFile.FullName | vercel env add $Name production 2>&1 | Out-Null
    Remove-Item $tempFile.FullName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Success!" -ForegroundColor Green
        return $true
    } else {
        Write-Host "  Failed!" -ForegroundColor Red
        return $false
    }
}

# Supabase credentials
$SUPABASE_URL = "https://dfzrjfrplludgnycfqbj.supabase.co"
$SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmenJqZnJwbGx1ZGdueWNmcWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDI1NjQsImV4cCI6MjA3NzkxODU2NH0.Ets93kZA1EJLF4oA2fbIPGxzjFtvnDDAjLKfZjUWLpw"
$SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmenJqZnJwbGx1ZGdueWNmcWJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjM0MjU2NCwiZXhwIjoyMDc3OTE4NTY0fQ.snngrniPa7GQD04NWKpkK4gR81_rDH-c1_gshE4Osco"

# Generate secure random secrets
$JWT_SECRET = -join ((65..90) + (97..122) + (48..57) + (33..47) | Get-Random -Count 48 | ForEach-Object {[char]$_})
$REFRESH_TOKEN_SECRET = -join ((65..90) + (97..122) + (48..57) + (33..47) | Get-Random -Count 48 | ForEach-Object {[char]$_})
$ENCRYPTION_KEY = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$SESSION_SECRET = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})

Write-Host "Generated secure secrets:" -ForegroundColor Cyan
Write-Host "  JWT_SECRET: $JWT_SECRET" -ForegroundColor Gray
Write-Host "  REFRESH_TOKEN_SECRET: $REFRESH_TOKEN_SECRET" -ForegroundColor Gray
Write-Host "  ENCRYPTION_KEY: $ENCRYPTION_KEY" -ForegroundColor Gray
Write-Host "  SESSION_SECRET: $SESSION_SECRET" -ForegroundColor Gray
Write-Host ""

$successCount = 0
$failCount = 0

# Add all environment variables
Write-Host "Adding environment variables..." -ForegroundColor Cyan
Write-Host ""

if (Add-VercelEnv "NODE_ENV" "production") { $successCount++ } else { $failCount++ }
if (Add-VercelEnv "PORT" "3001") { $successCount++ } else { $failCount++ }
if (Add-VercelEnv "SUPABASE_URL" $SUPABASE_URL) { $successCount++ } else { $failCount++ }
if (Add-VercelEnv "SUPABASE_ANON_KEY" $SUPABASE_ANON_KEY) { $successCount++ } else { $failCount++ }
if (Add-VercelEnv "SUPABASE_SERVICE_KEY" $SUPABASE_SERVICE_KEY) { $successCount++ } else { $failCount++ }
if (Add-VercelEnv "JWT_SECRET" $JWT_SECRET) { $successCount++ } else { $failCount++ }
if (Add-VercelEnv "JWT_EXPIRES_IN" "7d") { $successCount++ } else { $failCount++ }
if (Add-VercelEnv "REFRESH_TOKEN_SECRET" $REFRESH_TOKEN_SECRET) { $successCount++ } else { $failCount++ }
if (Add-VercelEnv "ENCRYPTION_KEY" $ENCRYPTION_KEY) { $successCount++ } else { $failCount++ }
if (Add-VercelEnv "SESSION_SECRET" $SESSION_SECRET) { $successCount++ } else { $failCount++ }
if (Add-VercelEnv "RATE_LIMIT_WINDOW_MS" "900000") { $successCount++ } else { $failCount++ }
if (Add-VercelEnv "RATE_LIMIT_MAX_REQUESTS" "100") { $successCount++ } else { $failCount++ }
if (Add-VercelEnv "LOG_LEVEL" "info") { $successCount++ } else { $failCount++ }

Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Success: $successCount" -ForegroundColor Green
Write-Host "  Failed: $failCount" -ForegroundColor Red
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "All environment variables added successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "IMPORTANT: Save these generated secrets securely!" -ForegroundColor Yellow
    Write-Host "  JWT_SECRET: $JWT_SECRET" -ForegroundColor White
    Write-Host "  REFRESH_TOKEN_SECRET: $REFRESH_TOKEN_SECRET" -ForegroundColor White
    Write-Host "  ENCRYPTION_KEY: $ENCRYPTION_KEY" -ForegroundColor White
    Write-Host "  SESSION_SECRET: $SESSION_SECRET" -ForegroundColor White
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Redeploy: vercel --prod" -ForegroundColor White
    Write-Host "  2. Test: .\test-deployment.ps1" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "Some variables failed to add. Please check the errors above." -ForegroundColor Yellow
    Write-Host "You can add them manually at:" -ForegroundColor Yellow
    Write-Host "https://vercel.com/busine-xa-i-lab/tradingbackend/settings/environment-variables" -ForegroundColor White
    Write-Host ""
}
