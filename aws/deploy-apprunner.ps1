# Deploy SmartTrade backend to AWS App Runner (simpler than full CloudFormation)
param(
    [string]$Region = "ap-south-1",
    [string]$ServiceName = "smarttrade-backend",
    [string]$RepoName = "smarttrade-backend"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "=== SmartTrade AWS App Runner Deployment ===" -ForegroundColor Cyan

# Check AWS CLI
try {
    $AccountId = aws sts get-caller-identity --query Account --output text 2>&1
    if ($LASTEXITCODE -ne 0) { throw "AWS CLI not configured" }
    Write-Host "AWS Account: $AccountId" -ForegroundColor Green
} catch {
    Write-Host "ERROR: AWS CLI not configured. Run 'aws configure' first." -ForegroundColor Red
    exit 1
}

$EcrUri = "${AccountId}.dkr.ecr.${Region}.amazonaws.com/${RepoName}"

# Build Docker image
Write-Host "`n[1/4] Building Docker image..." -ForegroundColor Yellow
Push-Location "$Root\backend"
docker build -t $RepoName .
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
Pop-Location

# ECR login and push
Write-Host "`n[2/4] Pushing to ECR..." -ForegroundColor Yellow
aws ecr describe-repositories --repository-names $RepoName --region $Region 2>$null
if ($LASTEXITCODE -ne 0) {
    aws ecr create-repository --repository-name $RepoName --region $Region
}
aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin "${AccountId}.dkr.ecr.${Region}.amazonaws.com"
docker tag "${RepoName}:latest" "${EcrUri}:latest"
docker push "${EcrUri}:latest"

# Create/update App Runner service
Write-Host "`n[3/4] Deploying App Runner service..." -ForegroundColor Yellow

$apprunnerConfig = @{
    ServiceName = $ServiceName
    SourceConfiguration = @{
        ImageRepository = @{
            ImageIdentifier = "${EcrUri}:latest"
            ImageRepositoryType = "ECR"
            ImageConfiguration = @{
                Port = "8080"
                RuntimeEnvironmentVariables = @{
                    NODE_ENV = "production"
                    PORT = "8080"
                }
            }
        }
        AutoDeploymentsEnabled = $true
    }
    InstanceConfiguration = @{
        Cpu = "1024"
        Memory = "2048"
    }
} | ConvertTo-Json -Depth 10

$configFile = "$env:TEMP\apprunner-config.json"
$apprunnerConfig | Out-File -FilePath $configFile -Encoding utf8

$existing = aws apprunner list-services --region $Region --query "ServiceSummaryList[?ServiceName=='$ServiceName'].ServiceArn" --output text 2>$null

if ($existing) {
    Write-Host "Updating existing service: $existing"
    aws apprunner update-service --service-arn $existing --source-configuration file://$configFile --region $Region
} else {
    Write-Host "Creating new App Runner service..."
    aws apprunner create-service --cli-input-json file://$configFile --region $Region
}

Write-Host "`n[4/4] Waiting for service URL..." -ForegroundColor Yellow
Start-Sleep -Seconds 10
$serviceUrl = aws apprunner list-services --region $Region --query "ServiceSummaryList[?ServiceName=='$ServiceName'].ServiceUrl" --output text

Write-Host "`n=== Deployment Complete ===" -ForegroundColor Green
Write-Host "Service URL: https://$serviceUrl"
Write-Host "Health check: https://$serviceUrl/health"
Write-Host "`nSet VITE_API_URL=https://$serviceUrl/api in Vercel"
