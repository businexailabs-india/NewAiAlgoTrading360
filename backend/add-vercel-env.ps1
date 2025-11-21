# Add Environment Variables to Vercel
# This script helps you add environment variables one by one

Write-Host "Adding Environment Variables to Vercel" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

$projectName = "tradingbackend"

Write-Host "This will add environment variables to: $projectName" -ForegroundColor Yellow
Write-Host ""

# Define required variables
$requiredVars = @(
    @{Name="NODE_ENV"; Description="Environment (production)"; DefaultValue="production"},
    @{Name="SUPABASE_URL"; Description="Your Supabase project URL"; DefaultValue="https://dfzrjfrplludgnycfqbj.supabase.co"},
    @{Name="SUPABASE_ANON_KEY"; Description="Your Supabase anon key"; DefaultValue=""},
    @{Name="SUPABASE_SERVICE_KEY"; Description="Your Supabase service role key"; DefaultValue=""},
    @{Name="JWT_SECRET"; Description="JWT secret (32+ characters)"; DefaultValue=""},
    @{Name="REFRESH_TOKEN_SECRET"; Description="Refresh token secret (32+ characters)"; DefaultValue=""},
    @{Name="ENCRYPTION_KEY"; Description="32-byte encryption key"; DefaultValue=""},
    @{Name="JWT_EXPIRES_IN"; Description="JWT expiration time"; DefaultValue="7d"},
    @{Name="CORS_ORIGIN"; Description="Frontend URL for CORS"; DefaultValue=""},
    @{Name="RATE_LIMIT_WINDOW_MS"; Description="Rate limit window"; DefaultValue="900000"},
    @{Name="RATE_LIMIT_MAX_REQUESTS"; Description="Max requests per window"; DefaultValue="100"},
    @{Name="LOG_LEVEL"; Description="Logging level"; DefaultValue="info"}
)

Write-Host "We'll add the following variables:" -ForegroundColor Yellow
foreach ($var in $requiredVars) {
    Write-Host "  - $($var.Name): $($var.Description)" -ForegroundColor White
}
Write-Host ""

$proceed = Read-Host "Do you want to proceed? (Y/n)"
if ($proceed -eq 'n' -or $proceed -eq 'N') {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Adding variables..." -ForegroundColor Cyan
Write-Host ""

foreach ($var in $requiredVars) {
    Write-Host "Adding: $($var.Name)" -ForegroundColor Yellow
    Write-Host "Description: $($var.Description)" -ForegroundColor Gray
    
    if ($var.DefaultValue) {
        Write-Host "Default value: $($var.DefaultValue)" -ForegroundColor Gray
        $useDefault = Read-Host "Use default value? (Y/n)"
        
        if ($useDefault -eq '' -or $useDefault -eq 'Y' -or $useDefault -eq 'y') {
            $value = $var.DefaultValue
        } else {
            $value = Read-Host "Enter value for $($var.Name)"
        }
    } else {
        $value = Read-Host "Enter value for $($var.Name)"
    }
    
    if ($value) {
        Write-Host "Setting $($var.Name)..." -ForegroundColor Cyan
        Write-Output $value | vercel env add $($var.Name) production
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  Success!" -ForegroundColor Green
        } else {
            Write-Host "  Failed!" -ForegroundColor Red
        }
    } else {
        Write-Host "  Skipped (no value provided)" -ForegroundColor Yellow
    }
    
    Write-Host ""
}

Write-Host ""
Write-Host "Environment variables added!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Redeploy your project: vercel --prod" -ForegroundColor White
Write-Host "  2. Test your deployment: .\test-deployment.ps1" -ForegroundColor White
Write-Host ""
