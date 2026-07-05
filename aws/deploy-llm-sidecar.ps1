# Build Python LLM sidecar image and update ECS task with llm-service container
param(
    [string]$Region = "ap-south-1",
    [string]$StackName = "smarttrade-platform",
    [string]$LlmRepoName = "smarttrade-llm-service",
    [string]$Profile = "AiAuthority_AWS",
    [switch]$SkipLlmBuild,
    [switch]$SkipStackUpdate
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Aws = @("--profile", $Profile, "--region", $Region)

function Invoke-CodeBuildLlmImage {
    param([string]$AccountId, [string]$ImageUri)

    $BuildBucket = "smarttrade-build-$AccountId"
    $RoleName = "smarttrade-codebuild-role"
    $ProjectName = "smarttrade-llm-build"

    Write-Host "  Using AWS CodeBuild for LLM service..." -ForegroundColor Cyan

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

    aws ecr describe-repositories --repository-names $script:LlmRepoName @Aws 2>$null
    if ($LASTEXITCODE -ne 0) {
        aws ecr create-repository --repository-name $script:LlmRepoName @Aws | Out-Null
    }

    $ErrorActionPreference = $prevEap

    $staging = Join-Path $env:TEMP "smarttrade-llm-build-src"
    if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
    New-Item -ItemType Directory -Path $staging | Out-Null
    Copy-Item "$Root\backend\llm-service\*" $staging -Recurse -Force
    Copy-Item "$Root\aws\buildspec-llm.yml" "$staging\buildspec.yml" -Force

    $zipPath = Join-Path $env:TEMP "smarttrade-llm-src.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    tar -acf $zipPath -C $staging .
    if ($LASTEXITCODE -ne 0) { throw "Failed to create LLM source zip" }
    aws s3 cp $zipPath "s3://$BuildBucket/llm-source.zip" @Aws | Out-Null

    $roleArn = aws iam get-role --role-name $RoleName --query "Role.Arn" --output text @Aws
    if ($LASTEXITCODE -ne 0) { throw "CodeBuild role $RoleName not found. Run deploy-full.ps1 first." }

    $projectConfig = @{
        name = $ProjectName
        source = @{ type = "S3"; location = "$BuildBucket/llm-source.zip" }
        artifacts = @{ type = "NO_ARTIFACTS" }
        environment = @{
            type = "LINUX_CONTAINER"
            image = "aws/codebuild/standard:7.0"
            computeType = "BUILD_GENERAL1_LARGE"
            privilegedMode = $true
            environmentVariables = @(
                @{ name = "AWS_DEFAULT_REGION"; value = $Region; type = "PLAINTEXT" }
                @{ name = "AWS_ACCOUNT_ID"; value = $AccountId; type = "PLAINTEXT" }
                @{ name = "IMAGE_REPO_NAME"; value = $script:LlmRepoName; type = "PLAINTEXT" }
                @{ name = "IMAGE_URI"; value = $ImageUri; type = "PLAINTEXT" }
            )
        }
        serviceRole = $roleArn
    }
    $projectFile = Join-Path $env:TEMP "codebuild-llm-project.json"
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
        Start-Sleep -Seconds 20
        $status = aws codebuild batch-get-builds --ids $buildId @Aws --query "builds[0].buildStatus" --output text
        Write-Host "  Build status: $status" -ForegroundColor Gray
    }
    if ($status -ne "SUCCEEDED") { throw "LLM CodeBuild failed: $status" }
}

Write-Host "=== SmartTrade LLM Sidecar Deployment ===" -ForegroundColor Cyan

$identity = aws sts get-caller-identity @Aws --output json | ConvertFrom-Json
$AccountId = $identity.Account
$LlmImageUri = "${AccountId}.dkr.ecr.${Region}.amazonaws.com/${LlmRepoName}:latest"

Write-Host "`n[1/3] Building LLM service image..." -ForegroundColor Yellow
if (-not $SkipLlmBuild) {
    Invoke-CodeBuildLlmImage -AccountId $AccountId -ImageUri $LlmImageUri
} else {
    Write-Host "  Skipping LLM build (-SkipLlmBuild)" -ForegroundColor Yellow
}
Write-Host "  LLM image: $LlmImageUri" -ForegroundColor Green

if ($SkipStackUpdate) {
    Write-Host "`n[2/3] Skipping stack update (-SkipStackUpdate)" -ForegroundColor Yellow
} else {
    Write-Host "`n[2/3] Updating CloudFormation stack with LLM sidecar..." -ForegroundColor Yellow
    $VpcId = aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" @Aws --query "Vpcs[0].VpcId" --output text
    $SubnetIds = aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VpcId" @Aws --query "Subnets[*].SubnetId" --output text
    $SubnetParam = (($SubnetIds -split "\s+") -join ",")

    $cfnParams = @(
        @{ ParameterKey = "EnvironmentName"; ParameterValue = "smarttrade" }
        @{ ParameterKey = "LlmServiceImageUri"; ParameterValue = $LlmImageUri }
        @{ ParameterKey = "VpcId"; ParameterValue = $VpcId }
        @{ ParameterKey = "PublicSubnetIds"; ParameterValue = $SubnetParam }
        @{ ParameterKey = "FrontendUrl"; ParameterValue = "https://smarttrade-portfolio.vercel.app" }
        @{ ParameterKey = "BackendImageUri"; UsePreviousValue = $true }
        @{ ParameterKey = "MlServiceImageUri"; UsePreviousValue = $true }
        @{ ParameterKey = "DBUsername"; UsePreviousValue = $true }
        @{ ParameterKey = "DBPassword"; UsePreviousValue = $true }
        @{ ParameterKey = "JwtSecret"; UsePreviousValue = $true }
    )
    $paramsFile = Join-Path $env:TEMP "smarttrade-llm-cfn-params.json"
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
            Write-Host "  Stack already up to date - forcing ECS rollout..." -ForegroundColor Yellow
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
Write-Host "`n[3/3] Forcing ECS rollout and waiting for stability..." -ForegroundColor Yellow
aws ecs update-service --cluster $cluster --service $service --force-new-deployment @Aws | Out-Null
aws ecs wait services-stable --cluster $cluster --services $service @Aws

$backendUrl = aws cloudformation describe-stacks --stack-name $StackName @Aws --query "Stacks[0].Outputs[?OutputKey=='BackendUrl'].OutputValue" --output text

Write-Host "`n=== LLM deployment complete ===" -ForegroundColor Green
Write-Host "  Backend:    $backendUrl" -ForegroundColor Green
Write-Host "  LLM status: $backendUrl/api/llm/status" -ForegroundColor Green
