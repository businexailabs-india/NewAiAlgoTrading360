# Push backend image to ECR and deploy to AWS App Runner
param(
    [string]$Region = "ap-south-1",
    [string]$AccountId = "",
    [string]$RepoName = "smarttrade-backend"
)

$ErrorActionPreference = "Stop"

if (-not $AccountId) {
    $AccountId = (aws sts get-caller-identity --query Account --output text)
}

$EcrUri = "$AccountId.dkr.ecr.$Region.amazonaws.com/$RepoName"

Write-Host "Building backend Docker image..."
Push-Location backend
docker build -t $RepoName .
Pop-Location

Write-Host "Logging into ECR..."
aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin "$AccountId.dkr.ecr.$Region.amazonaws.com"

Write-Host "Creating ECR repository if needed..."
aws ecr describe-repositories --repository-names $RepoName --region $Region 2>$null
if ($LASTEXITCODE -ne 0) {
    aws ecr create-repository --repository-name $RepoName --region $Region
}

Write-Host "Pushing image..."
docker tag "${RepoName}:latest" "${EcrUri}:latest"
docker push "${EcrUri}:latest"

Write-Host "Deploying CloudFormation stack..."
aws cloudformation deploy `
    --template-file aws/template.yaml `
    --stack-name smarttrade-prediction `
    --parameter-overrides BackendImageUri="${EcrUri}:latest" `
    --capabilities CAPABILITY_IAM `
    --region $Region

Write-Host "Deployment complete!"
Write-Host "Set AWS_PREDICTION_URL in backend env to the API Gateway output URL"
