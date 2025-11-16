# Setup Environment Variables Script
# This script creates the .env file with your Supabase credentials

Write-Host "🚀 Setting up SmartTrade Backend Environment..." -ForegroundColor Cyan
Write-Host ""

$envContent = @"
# Server Configuration
NODE_ENV=development
PORT=3001
API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000

# Supabase
SUPABASE_URL=https://dfzrjfrplludgnycfqbj.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmenJqZnJwbGx1ZGdueWNmcWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDI1NjQsImV4cCI6MjA3NzkxODU2NH0.Ets93kZA1EJLF4oA2fbIPGxzjFtvnDDAjLKfZjUWLpw
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmenJqZnJwbGx1ZGdueWNmcWJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjM0MjU2NCwiZXhwIjoyMDc3OTE4NTY0fQ.snngrniPa7GQD04NWKpkK4gR81_rDH-c1_gshE4Osco

# Database
DATABASE_URL=postgres://postgres.dfzrjfrplludgnycfqbj:D61KWh2ypiYPX9sy@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require

# Redis (Optional)
REDIS_URL=redis://localhost:6379

# JWT Secrets
JWT_SECRET=smarttrade-jwt-secret-key-2025-change-in-production
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=smarttrade-refresh-token-secret-2025

# Encryption
ENCRYPTION_KEY=smarttrade-encryption-key-32bytes

# Zerodha Kite Connect (Add your keys when ready)
ZERODHA_API_KEY=your_zerodha_api_key
ZERODHA_API_SECRET=your_zerodha_api_secret
ZERODHA_REDIRECT_URL=http://localhost:3001/api/broker/zerodha/callback

# Upstox API (Add your keys when ready)
UPSTOX_API_KEY=your_upstox_api_key
UPSTOX_API_SECRET=your_upstox_api_secret
UPSTOX_REDIRECT_URL=http://localhost:3001/api/broker/upstox/callback

# AngelOne API (Add your keys when ready)
ANGELONE_API_KEY=your_angelone_api_key
ANGELONE_API_SECRET=your_angelone_api_secret

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log

# CORS
CORS_ORIGIN=http://localhost:3000

# Session
SESSION_SECRET=smarttrade-session-secret-2025
"@

# Create .env file
$envPath = Join-Path $PSScriptRoot ".env"

if (Test-Path $envPath) {
    Write-Host "⚠️  .env file already exists!" -ForegroundColor Yellow
    $response = Read-Host "Do you want to overwrite it? (y/n)"
    if ($response -ne "y") {
        Write-Host "❌ Setup cancelled." -ForegroundColor Red
        exit
    }
}

$envContent | Out-File -FilePath $envPath -Encoding UTF8
Write-Host "✅ .env file created successfully!" -ForegroundColor Green
Write-Host ""

# Check if node_modules exists
$nodeModulesPath = Join-Path $PSScriptRoot "node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
    npm install
    Write-Host "✅ Dependencies installed!" -ForegroundColor Green
    Write-Host ""
}

Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Run 'npm run dev' to start the development server" -ForegroundColor White
Write-Host "2. Server will be available at http://localhost:3001" -ForegroundColor White
Write-Host "3. Add your broker API keys to .env when ready" -ForegroundColor White
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "   - SUPABASE_SETUP.md - Database setup guide" -ForegroundColor White
Write-Host "   - README.md - Complete API documentation" -ForegroundColor White
Write-Host ""
