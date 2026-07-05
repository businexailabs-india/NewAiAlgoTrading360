# Build Python ML sidecar image and update ECS task with sidecar container
param(
    [string]$Region = "ap-south-1",
    [string]$StackName = "smarttrade-platform",
    [string]$MlRepoName = "smarttrade-ml-service",
    [string]$BackendRepoName = "smarttrade-backend",
    [string]$Profile = "AiAuthority_AWS",
    [switch]$SkipBackendBuild,
    [switch]$SkipMlBuild,
    [switch]$SkipStackUpdate
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Aws = @("--profile", $Profile, "--region", $Region)

function Invoke-CodeBuildMlImage {
    param([string]$AccountId, [string]$ImageUri)

    $BuildBucket = "smarttrade-build-$AccountId"
    $RoleName = "smarttrade-codebuild-role"
    $ProjectName = "smarttrade-ml-build"

    Write-Host "  Using AWS CodeBuild for ML service..." -ForegroundColor Cyan

    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'

    aws s3api head-bucket --bucket $BuildBucket @Aws 2>$null
    if ($LASTEXITCODE -ne 0) {
        if ($Region -eq "us-east-1") {
            aws s3api create-bucket --bucket $BuildBucket @Aws | Out-Null
        } else {
            aws s3api create-bucket --bucket $BuildBucket @Aws --create-bucket-configuration LocationConstraint=$Region | Out-Null
        }
    }

    aws ecr describe-repositories --repository-names $script:MlRepoName @Aws 2>$null
    if ($LASTEXITCODE -ne 0) {
        aws ecr create-repository --repository-name $script:MlRepoName @Aws | Out-Null
    }

    $ErrorActionPreference = $prevEap

    $staging = Join-Path $env:TEMP "smarttrade-ml-build-src"
    if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
    New-Item -ItemType Directory -Path $staging | Out-Null
    Copy-Item "$Root\backend\ml-service\*" $staging -Recurse -Force
    Copy-Item "$Root\aws\buildspec-ml.yml" "$staging\buildspec.yml" -Force

    $zipPath = Join-Path $env:TEMP "smarttrade-ml-src.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    tar -acf $zipPath -C $staging .
    if ($LASTEXITCODE -ne 0) { throw "Failed to create ML source zip" }
    aws s3 cp $zipPath "s3://$BuildBucket/ml-source.zip" @Aws | Out-Null

    $roleArn = aws iam get-role --role-name $RoleName --query "Role.Arn" --output text @Aws
    if ($LASTEXITCODE -ne 0) { throw "CodeBuild role $RoleName not found. Run deploy-full.ps1 first." }

    $projectConfig = @{
        name = $ProjectName
        source = @{ type = "S3"; location = "$BuildBucket/ml-source.zip" }
        artifacts = @{ type = "NO_ARTIFACTS" }
        environment = @{
            type = "LINUX_CONTAINER"
            image = "aws/codebuild/standard:7.0"
            computeType = "BUILD_GENERAL1_MEDIUM"
            privilegedMode = $true
            environmentVariables = @(
                @{ name = "AWS_DEFAULT_REGION"; value = $Region; type = "PLAINTEXT" }
                @{ name = "AWS_ACCOUNT_ID"; value = $AccountId; type = "PLAINTEXT" }
                @{ name = "IMAGE_REPO_NAME"; value = $script:MlRepoName; type = "PLAINTEXT" }
                @{ name = "IMAGE_URI"; value = $ImageUri; type = "PLAINTEXT" }
            )
        }
        serviceRole = $roleArn
    }
    $projectFile = Join-Path $env:TEMP "codebuild-ml-project.json"
    $projectConfig | ConvertTo-Json -Depth 6 | Out-File $projectFile -Encoding ascii

    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    $existing = aws codebuild batch-get-projects --names $ProjectName @Aws --query "projects[0].name" --output text 2>$null
    $ErrorActionPreference = $prevEap
    if ($existing -eq "None" -or -not $existing) {
        aws codebuild create-project --cli-input-json "file://$($projectFile -replace '\\','/')" @Aws | Out-Null
    } else {
        aws codebuild update-project --cli-input-json "file://$($projectFile -replace '\\','/')" @Aws | Out-Null
    }

    $buildId = aws codebuild start-build --project-name $ProjectName @Aws --query "build.id" --output text
    Write-Host "  CodeBuild started: $buildId" -ForegroundColor Gray

    $status = "IN_PROGRESS"
    while ($status -eq "IN_PROGRESS") {
        Start-Sleep -Seconds 15
        $status = aws codebuild batch-get-builds --ids $buildId @Aws --query "builds[0].buildStatus" --output text
        Write-Host "  Build status: $status" -ForegroundColor Gray
    }
    if ($status -ne "SUCCEEDED") { throw "ML CodeBuild failed: $status" }
}

Write-Host "=== SmartTrade ML Sidecar Deployment ===" -ForegroundColor Cyan

$identity = aws sts get-caller-identity @Aws --output json | ConvertFrom-Json
$AccountId = $identity.Account
$MlImageUri = "${AccountId}.dkr.ecr.${Region}.amazonaws.com/${MlRepoName}:latest"
$BackendImageUri = "${AccountId}.dkr.ecr.${Region}.amazonaws.com/${BackendRepoName}:latest"

Write-Host "`n[1/4] Building ML service image..." -ForegroundColor Yellow
if (-not $SkipMlBuild) {
    Invoke-CodeBuildMlImage -AccountId $AccountId -ImageUri $MlImageUri
} else {
    Write-Host "  Skipping ML build (-SkipMlBuild)" -ForegroundColor Yellow
}
Write-Host "  ML image: $MlImageUri" -ForegroundColor Green

function Invoke-CodeBuildBackend {
    param([string]$AccountId, [string]$ImageUri)

    $BuildBucket = "smarttrade-build-$AccountId"
    $RoleName = "smarttrade-codebuild-role"
    $ProjectName = "smarttrade-backend-build"

    Write-Host "  Using AWS CodeBuild for backend..." -ForegroundColor Cyan

    $staging = Join-Path $env:TEMP "smarttrade-build-src"
    if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
    New-Item -ItemType Directory -Path $staging | Out-Null
    $exclude = @('node_modules', 'dist', 'data')
    Get-ChildItem "$Root\backend" | Where-Object { $exclude -notcontains $_.Name } | ForEach-Object {
        Copy-Item $_.FullName -Destination $staging -Recurse -Force
    }
    Copy-Item "$Root\aws\buildspec.yml" "$staging\buildspec.yml" -Force
    $zipPath = Join-Path $env:TEMP "smarttrade-backend-src.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    tar -acf $zipPath -C $staging .
    aws s3 cp $zipPath "s3://$BuildBucket/source.zip" @Aws | Out-Null

    $roleArn = aws iam get-role --role-name $RoleName --query "Role.Arn" --output text @Aws
    $buildId = aws codebuild start-build --project-name $ProjectName @Aws --query "build.id" --output text
    Write-Host "  CodeBuild started: $buildId" -ForegroundColor Gray

    $status = "IN_PROGRESS"
    while ($status -eq "IN_PROGRESS") {
        Start-Sleep -Seconds 15
        $status = aws codebuild batch-get-builds --ids $buildId @Aws --query "builds[0].buildStatus" --output text
        Write-Host "  Build status: $status" -ForegroundColor Gray
    }
    if ($status -ne "SUCCEEDED") { throw "Backend CodeBuild failed: $status" }
}

if (-not $SkipBackendBuild) {
    Write-Host "`n[2/4] Rebuilding backend image (includes ml-client)..." -ForegroundColor Yellow
    Invoke-CodeBuildBackend -AccountId $AccountId -ImageUri $BackendImageUri
    Write-Host "  Backend image: $BackendImageUri" -ForegroundColor Green
} else {
    Write-Host "`n[2/4] Skipping backend rebuild (-SkipBackendBuild)" -ForegroundColor Yellow
}

if ($SkipStackUpdate) {
    Write-Host "`n[3/4] Skipping stack update (-SkipStackUpdate)" -ForegroundColor Yellow
} else {
Write-Host "`n[3/4] Updating CloudFormation stack with ML sidecar..." -ForegroundColor Yellow
$VpcId = aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" @Aws --query "Vpcs[0].VpcId" --output text
$SubnetIds = aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VpcId" @Aws --query "Subnets[*].SubnetId" --output text
$SubnetParam = (($SubnetIds -split "\s+") -join ",")

$cfnParams = @(
    @{ ParameterKey = "EnvironmentName"; ParameterValue = "smarttrade" }
    @{ ParameterKey = "BackendImageUri"; ParameterValue = $BackendImageUri }
    @{ ParameterKey = "MlServiceImageUri"; ParameterValue = $MlImageUri }
    @{ ParameterKey = "LlmServiceImageUri"; UsePreviousValue = $true }
    @{ ParameterKey = "VpcId"; ParameterValue = $VpcId }
    @{ ParameterKey = "PublicSubnetIds"; ParameterValue = $SubnetParam }
    @{ ParameterKey = "FrontendUrl"; ParameterValue = "https://smarttrade-portfolio.vercel.app" }
    @{ ParameterKey = "DBUsername"; UsePreviousValue = $true }
    @{ ParameterKey = "DBPassword"; UsePreviousValue = $true }
    @{ ParameterKey = "JwtSecret"; UsePreviousValue = $true }
)
$paramsFile = Join-Path $env:TEMP "smarttrade-cfn-params.json"
$cfnParams | ConvertTo-Json -Depth 3 | Out-File $paramsFile -Encoding ascii

$templatePath = "$Root\aws\infrastructure.yaml"
aws cloudformation update-stack `
    --stack-name $StackName `
    --template-body "file://$($templatePath -replace '\\','/')" `
    --parameters "file://$($paramsFile -replace '\\','/')" `
    --capabilities CAPABILITY_IAM `
    @Aws

if ($LASTEXITCODE -ne 0) {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    $stackStatus = aws cloudformation describe-stacks --stack-name $StackName @Aws --query "Stacks[0].StackStatus" --output text 2>$null
    $ErrorActionPreference = $prevEap
    if ($stackStatus -match "COMPLETE") {
        Write-Host "  Stack already up to date - forcing ECS rollout of new images..." -ForegroundColor Yellow
    } else {
        throw "CloudFormation update failed"
    }
} else {
    Write-Host "  Waiting for stack update..." -ForegroundColor Gray
    aws cloudformation wait stack-update-complete --stack-name $StackName @Aws
}
}

$cluster = aws cloudformation describe-stacks --stack-name $StackName @Aws --query "Stacks[0].Outputs[?OutputKey=='ECSClusterName'].OutputValue" --output text
$service = aws cloudformation describe-stacks --stack-name $StackName @Aws --query "Stacks[0].Outputs[?OutputKey=='ECSServiceName'].OutputValue" --output text
Write-Host "  Forcing ECS rollout..." -ForegroundColor Gray
aws ecs update-service --cluster $cluster --service $service --force-new-deployment @Aws | Out-Null

Write-Host "`n[4/4] Waiting for ECS service to stabilize..." -ForegroundColor Yellow
aws ecs wait services-stable --cluster $cluster --services $service @Aws

$healthUrl = aws cloudformation describe-stacks --stack-name $StackName @Aws --query "Stacks[0].Outputs[?OutputKey=='HealthCheckUrl'].OutputValue" --output text
$backendUrl = aws cloudformation describe-stacks --stack-name $StackName @Aws --query "Stacks[0].Outputs[?OutputKey=='BackendUrl'].OutputValue" --output text

Write-Host "`n=== Deployment complete ===" -ForegroundColor Green
Write-Host "  Backend:   $backendUrl" -ForegroundColor Green
Write-Host "  Health:    $healthUrl" -ForegroundColor Green
Write-Host "  ML status: $backendUrl/api/predictions/ml-status" -ForegroundColor Green
