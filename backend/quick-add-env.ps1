# Quick Add Environment Variables to Vercel
# This script adds essential variables with prompts

Write-Host "Quick Setup - Vercel Environment Variables" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Function to add environment variable
function Add-VercelEnv {
    param($Name, $Value)
    
    Write-Host "Adding $Name..." -ForegroundColor Yellow
    $tempFile = New-TemporaryFile
    Set-Content -Path $tempFile.FullName -Value $Value
    Get-Content $tempFile.FullName | vercel env add $Name production 2>&1 | Out-Null
    Remove-Item $tempFile.FullName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  $Name added successfully!" -ForegroundColor Green
    } else {
        Write-Host "  Failed to add $Name" -ForegroundColor Red
    }
}

# Add NODE_ENV
Write-Host "1. Setting NODE_ENV to production..." -ForegroundColor Cyan
Add-VercelEnv "NODE_ENV" "production"
Write-Host ""

# Add SUPABASE_URL
Write-Host "2. Supabase URL" -ForegroundColor Cyan
$supabaseUrl = Read-Host "Enter your Supabase URL (or press Enter for default: https://dfzrjfrplludgnycfqbj.supabase.co)"
if (-not $supabaseUrl) {
    $supabaseUrl = "https://dfzrjfrplludgnycfqbj.supabase.co"
}
Add-VercelEnv "SUPABASE_URL" $supabaseUrl
Write-Host ""

# Add SUPABASE_ANON_KEY
Write-Host "3. Supabase Anon Key" -ForegroundColor Cyan
$supabaseAnonKey = Read-Host "Enter your Supabase Anon Key"
if ($supabaseAnonKey) {
    Add-VercelEnv "SUPABASE_ANON_KEY" $supabaseAnonKey
} else {
    Write-Host "  Skipped" -ForegroundColor Yellow
}
Write-Host ""

# Add SUPABASE_SERVICE_KEY
Write-Host "4. Supabase Service Key" -ForegroundColor Cyan
$supabaseServiceKey = Read-Host "Enter your Supabase Service Key"
if ($supabaseServiceKey) {
    Add-VercelEnv "SUPABASE_SERVICE_KEY" $supabaseServiceKey
} else {
    Write-Host "  Skipped" -ForegroundColor Yellow
}
Write-Host ""

# Generate and add JWT_SECRET
Write-Host "5. JWT Secret" -ForegroundColor Cyan
$generateJwt = Read-Host "Generate random JWT secret? (Y/n)"
if ($generateJwt -eq '' -or $generateJwt -eq 'Y' -or $generateJwt -eq 'y') {
    $jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    Add-VercelEnv "JWT_SECRET" $jwtSecret
    Write-Host "  Generated: $jwtSecret" -ForegroundColor Gray
} else {
    $jwtSecret = Read-Host "Enter JWT secret (32+ characters)"
    if ($jwtSecret) {
        Add-VercelEnv "JWT_SECRET" $jwtSecret
    }
}
Write-Host ""

# Generate and add REFRESH_TOKEN_SECRET
Write-Host "6. Refresh Token Secret" -ForegroundColor Cyan
$generateRefresh = Read-Host "Generate random refresh token secret? (Y/n)"
if ($generateRefresh -eq '' -or $generateRefresh -eq 'Y' -or $generateRefresh -eq 'y') {
    $refreshSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    Add-VercelEnv "REFRESH_TOKEN_SECRET" $refreshSecret
    Write-Host "  Generated: $refreshSecret" -ForegroundColor Gray
} else {
    $refreshSecret = Read-Host "Enter refresh token secret (32+ characters)"
    if ($refreshSecret) {
        Add-VercelEnv "REFRESH_TOKEN_SECRET" $refreshSecret
    }
}
Write-Host ""

# Generate and add ENCRYPTION_KEY
Write-Host "7. Encryption Key" -ForegroundColor Cyan
$generateEncryption = Read-Host "Generate random encryption key? (Y/n)"
if ($generateEncryption -eq '' -or $generateEncryption -eq 'Y' -or $generateEncryption -eq 'y') {
    $encryptionKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    Add-VercelEnv "ENCRYPTION_KEY" $encryptionKey
    Write-Host "  Generated: $encryptionKey" -ForegroundColor Gray
} else {
    $encryptionKey = Read-Host "Enter encryption key (32 characters)"
    if ($encryptionKey) {
        Add-VercelEnv "ENCRYPTION_KEY" $encryptionKey
    }
}
Write-Host ""

# Add JWT_EXPIRES_IN
Write-Host "8. JWT Expiration" -ForegroundColor Cyan
Add-VercelEnv "JWT_EXPIRES_IN" "7d"
Write-Host ""

# Add CORS_ORIGIN
Write-Host "9. CORS Origin (Frontend URL)" -ForegroundColor Cyan
$corsOrigin = Read-Host "Enter your frontend URL (e.g., https://yourapp.vercel.app)"
if ($corsOrigin) {
    Add-VercelEnv "CORS_ORIGIN" $corsOrigin
} else {
    Write-Host "  Skipped - You can add this later" -ForegroundColor Yellow
}
Write-Host ""

# Add rate limiting
Write-Host "10. Rate Limiting" -ForegroundColor Cyan
Add-VercelEnv "RATE_LIMIT_WINDOW_MS" "900000"
Add-VercelEnv "RATE_LIMIT_MAX_REQUESTS" "100"
Write-Host ""

# Add logging
Write-Host "11. Logging Level" -ForegroundColor Cyan
Add-VercelEnv "LOG_LEVEL" "info"
Write-Host ""

Write-Host ""
Write-Host "Environment variables setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Redeploy: vercel --prod" -ForegroundColor White
Write-Host "  2. Test: .\test-deployment.ps1" -ForegroundColor White
Write-Host ""
Write-Host "View all variables at:" -ForegroundColor Cyan
Write-Host "https://vercel.com/busine-xa-i-lab/tradingbackend/settings/environment-variables" -ForegroundColor White
Write-Host ""
