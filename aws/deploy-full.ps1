# SmartTrade - Full AWS deployment (RDS + S3 + ECS Fargate + ALB + API Gateway)
# Prerequisites: AWS CLI configured, Docker Desktop running
param(
    [string]$Region = "ap-south-1",
    [string]$StackName = "smarttrade-platform",
    [string]$RepoName = "smarttrade-backend",
    [string]$EnvironmentName = "smarttrade",
    [string]$FrontendUrl = "https://smarttrade-portfolio.vercel.app",
    [switch]$SkipDocker,
    [switch]$SkipFrontend,
    [switch]$UploadData
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

function New-Secret([int]$Length = 32) {
    -join ((48..57) + (65..90) + (97..122) | Get-Random -Count $Length | ForEach-Object { [char]$_ })
}

Write-Host "=== SmartTrade AWS Full Deployment ===" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Gray

# 1. Validate AWS credentials
Write-Host "`n[1/8] Validating AWS credentials..." -ForegroundColor Yellow
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'
$identityJson = aws sts get-caller-identity --region $Region --output json 2>$null
$awsExit = $LASTEXITCODE
$ErrorActionPreference = $prevEap
if ($awsExit -ne 0 -or -not $identityJson) {
    Write-Host "ERROR: AWS credentials invalid. Run: aws configure" -ForegroundColor Red
    Write-Host "  Then retry: npm run deploy:aws" -ForegroundColor Yellow
    exit 1
}
$identity = $identityJson | ConvertFrom-Json
$AccountId = $identity.Account
Write-Host "  Account: $AccountId" -ForegroundColor Green

$EcrUri = "${AccountId}.dkr.ecr.${Region}.amazonaws.com/${RepoName}"
$MlRepoName = "smarttrade-ml-service"
$MlEcrUri = "${AccountId}.dkr.ecr.${Region}.amazonaws.com/${MlRepoName}"

# 2. Discover VPC / subnets (default VPC)
Write-Host "`n[2/8] Discovering VPC subnets..." -ForegroundColor Yellow
$VpcId = aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --region $Region --query "Vpcs[0].VpcId" --output text
if (-not $VpcId -or $VpcId -eq "None") {
    Write-Host "ERROR: No default VPC found in $Region. Create a VPC or pass custom subnets." -ForegroundColor Red
    exit 1
}
$SubnetIds = aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VpcId" --region $Region --query "Subnets[*].SubnetId" --output text
$SubnetList = $SubnetIds -split "\s+"
if ($SubnetList.Count -lt 2) {
    Write-Host "ERROR: Need at least 2 subnets in VPC $VpcId" -ForegroundColor Red
    exit 1
}
$SubnetParam = ($SubnetList -join ",")
Write-Host "  VPC: $VpcId | Subnets: $SubnetParam" -ForegroundColor Green

# 3. Build & push Docker image
function Invoke-CodeBuildImage {
    param([string]$AccountId, [string]$Region, [string]$RepoName, [string]$ImageUri)

    $BuildBucket = "smarttrade-build-$AccountId"
    $RoleName = "smarttrade-codebuild-role"
    $ProjectName = "smarttrade-backend-build"
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'

    Write-Host "  Using AWS CodeBuild (no local Docker)..." -ForegroundColor Cyan

    aws s3api head-bucket --bucket $BuildBucket --region $Region 2>$null
    if ($LASTEXITCODE -ne 0) {
        if ($Region -eq "us-east-1") {
            aws s3api create-bucket --bucket $BuildBucket --region $Region | Out-Null
        } else {
            aws s3api create-bucket --bucket $BuildBucket --region $Region --create-bucket-configuration LocationConstraint=$Region | Out-Null
        }
    }

    aws ecr describe-repositories --repository-names $RepoName --region $Region 2>$null
    if ($LASTEXITCODE -ne 0) {
        aws ecr create-repository --repository-name $RepoName --region $Region | Out-Null
    }

    $staging = Join-Path $env:TEMP "smarttrade-build-src"
    if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
    New-Item -ItemType Directory -Path $staging | Out-Null
    $exclude = @('node_modules', 'dist', 'data')
    Get-ChildItem "$Root\backend" | Where-Object { $exclude -notcontains $_.Name } | ForEach-Object {
        Copy-Item $_.FullName -Destination $staging -Recurse -Force
    }
    if (-not (Test-Path "$staging\prisma\schema.prisma")) {
        $ErrorActionPreference = $prevEap
        Write-Host "ERROR: prisma folder missing from build staging" -ForegroundColor Red
        exit 1
    }
    Copy-Item "$Root\aws\buildspec.yml" "$staging\buildspec.yml" -Force
    $zipPath = Join-Path $env:TEMP "smarttrade-backend-src.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    tar -acf $zipPath -C $staging .
    if ($LASTEXITCODE -ne 0) {
        $ErrorActionPreference = $prevEap
        Write-Host "ERROR: Failed to create source zip with tar" -ForegroundColor Red
        exit 1
    }
    aws s3 cp $zipPath "s3://$BuildBucket/source.zip" --region $Region | Out-Null

    $trustPolicy = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"codebuild.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
    $trustFile = Join-Path $env:TEMP "codebuild-trust.json"
    $trustPolicy | Out-File $trustFile -Encoding ascii -NoNewline

    aws iam get-role --role-name $RoleName 2>$null
    if ($LASTEXITCODE -ne 0) {
        aws iam create-role --role-name $RoleName --assume-role-policy-document file://$trustFile | Out-Null
        aws iam attach-role-policy --role-name $RoleName --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser | Out-Null
        aws iam attach-role-policy --role-name $RoleName --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess | Out-Null
        aws iam attach-role-policy --role-name $RoleName --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess | Out-Null
        Start-Sleep -Seconds 10
    }

    $roleArn = aws iam get-role --role-name $RoleName --query "Role.Arn" --output text

    $projectConfig = @{
        name = $ProjectName
        source = @{
            type = "S3"
            location = "$BuildBucket/source.zip"
        }
        artifacts = @{ type = "NO_ARTIFACTS" }
        environment = @{
            type = "LINUX_CONTAINER"
            image = "aws/codebuild/standard:7.0"
            computeType = "BUILD_GENERAL1_MEDIUM"
            privilegedMode = $true
            environmentVariables = @(
                @{ name = "AWS_DEFAULT_REGION"; value = $Region; type = "PLAINTEXT" }
                @{ name = "AWS_ACCOUNT_ID"; value = $AccountId; type = "PLAINTEXT" }
                @{ name = "IMAGE_REPO_NAME"; value = $RepoName; type = "PLAINTEXT" }
                @{ name = "IMAGE_URI"; value = $ImageUri; type = "PLAINTEXT" }
            )
        }
        serviceRole = $roleArn
    }
    $projectFile = Join-Path $env:TEMP "codebuild-project.json"
    $projectConfig | ConvertTo-Json -Depth 6 | Out-File $projectFile -Encoding ascii

    $existingProject = aws codebuild batch-get-projects --names $ProjectName --region $Region --query "projects[0].name" --output text 2>$null
    if ($LASTEXITCODE -ne 0 -or $existingProject -eq "None" -or -not $existingProject) {
        aws codebuild create-project --cli-input-json "file://$($projectFile -replace '\\','/')" --region $Region
        if ($LASTEXITCODE -ne 0) {
            $ErrorActionPreference = $prevEap
            Write-Host "ERROR: Failed to create CodeBuild project" -ForegroundColor Red
            Get-Content $projectFile
            exit 1
        }
    } else {
        aws codebuild update-project --cli-input-json "file://$($projectFile -replace '\\','/')" --region $Region | Out-Null
    }

    $buildId = aws codebuild start-build --project-name $ProjectName --region $Region --query "build.id" --output text
    if ($LASTEXITCODE -ne 0 -or -not $buildId) {
        $ErrorActionPreference = $prevEap
        Write-Host "ERROR: Failed to start CodeBuild" -ForegroundColor Red
        exit 1
    }
    Write-Host "  CodeBuild started: $buildId" -ForegroundColor Gray

    $status = "IN_PROGRESS"
    while ($status -eq "IN_PROGRESS") {
        Start-Sleep -Seconds 15
        $status = aws codebuild batch-get-builds --ids $buildId --region $Region --query "builds[0].buildStatus" --output text
        Write-Host "  Build status: $status" -ForegroundColor Gray
    }

    if ($status -ne "SUCCEEDED") {
        $ErrorActionPreference = $prevEap
        Write-Host "ERROR: CodeBuild failed with status $status" -ForegroundColor Red
        aws codebuild batch-get-builds --ids $buildId --region $Region --query "builds[0].phases" --output json
        exit 1
    }
    $ErrorActionPreference = $prevEap
    Write-Host "  Image: $ImageUri" -ForegroundColor Green
}

function Invoke-CodeBuildMlImage {
    param([string]$AccountId, [string]$Region, [string]$RepoName, [string]$ImageUri)

    $BuildBucket = "smarttrade-build-$AccountId"
    $RoleName = "smarttrade-codebuild-role"
    $ProjectName = "smarttrade-ml-build"
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'

    Write-Host "  Using AWS CodeBuild for ML service..." -ForegroundColor Cyan

    aws ecr describe-repositories --repository-names $RepoName --region $Region 2>$null
    if ($LASTEXITCODE -ne 0) {
        aws ecr create-repository --repository-name $RepoName --region $Region | Out-Null
    }

    $staging = Join-Path $env:TEMP "smarttrade-ml-build-src"
    if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
    New-Item -ItemType Directory -Path $staging | Out-Null
    Copy-Item "$Root\backend\ml-service\*" $staging -Recurse -Force
    Copy-Item "$Root\aws\buildspec-ml.yml" "$staging\buildspec.yml" -Force
    $zipPath = Join-Path $env:TEMP "smarttrade-ml-src.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    tar -acf $zipPath -C $staging .
    aws s3 cp $zipPath "s3://$BuildBucket/ml-source.zip" --region $Region | Out-Null

    $roleArn = aws iam get-role --role-name $RoleName --query "Role.Arn" --output text

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
                @{ name = "IMAGE_REPO_NAME"; value = $RepoName; type = "PLAINTEXT" }
                @{ name = "IMAGE_URI"; value = $ImageUri; type = "PLAINTEXT" }
            )
        }
        serviceRole = $roleArn
    }
    $projectFile = Join-Path $env:TEMP "codebuild-ml-project.json"
    $projectConfig | ConvertTo-Json -Depth 6 | Out-File $projectFile -Encoding ascii

    $existing = aws codebuild batch-get-projects --names $ProjectName --region $Region --query "projects[0].name" --output text 2>$null
    if ($LASTEXITCODE -ne 0 -or $existing -eq "None" -or -not $existing) {
        aws codebuild create-project --cli-input-json "file://$($projectFile -replace '\\','/')" --region $Region | Out-Null
    } else {
        aws codebuild update-project --cli-input-json "file://$($projectFile -replace '\\','/')" --region $Region | Out-Null
    }

    $buildId = aws codebuild start-build --project-name $ProjectName --region $Region --query "build.id" --output text
    Write-Host "  ML CodeBuild started: $buildId" -ForegroundColor Gray

    $status = "IN_PROGRESS"
    while ($status -eq "IN_PROGRESS") {
        Start-Sleep -Seconds 15
        $status = aws codebuild batch-get-builds --ids $buildId --region $Region --query "builds[0].buildStatus" --output text
        Write-Host "  ML build status: $status" -ForegroundColor Gray
    }

    if ($status -ne "SUCCEEDED") {
        $ErrorActionPreference = $prevEap
        Write-Host "ERROR: ML CodeBuild failed with status $status" -ForegroundColor Red
        exit 1
    }
    $ErrorActionPreference = $prevEap
    Write-Host "  ML Image: $ImageUri" -ForegroundColor Green
}

if (-not $SkipDocker) {
    Write-Host "`n[3/8] Building and pushing Docker image..." -ForegroundColor Yellow
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Push-Location "$Root\backend"
        npm install
        docker build -t $RepoName .
        if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
        Pop-Location

        aws ecr describe-repositories --repository-names $RepoName --region $Region 2>$null
        if ($LASTEXITCODE -ne 0) {
            aws ecr create-repository --repository-name $RepoName --region $Region
        }
        aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin "${AccountId}.dkr.ecr.${Region}.amazonaws.com"
        docker tag "${RepoName}:latest" "${EcrUri}:latest"
        docker push "${EcrUri}:latest"
        Write-Host "  Image: ${EcrUri}:latest" -ForegroundColor Green
    } else {
        Invoke-CodeBuildImage -AccountId $AccountId -Region $Region -RepoName $RepoName -ImageUri "${EcrUri}:latest"
    }
} else {
    Write-Host "`n[3/8] Skipping Docker build (-SkipDocker)" -ForegroundColor Yellow
}

$ImageUri = "${EcrUri}:latest"
$MlImageUri = "${MlEcrUri}:latest"

if (-not $SkipDocker) {
    Write-Host "`n[3b/8] Building and pushing ML sidecar image..." -ForegroundColor Yellow
    Invoke-CodeBuildMlImage -AccountId $AccountId -Region $Region -RepoName $MlRepoName -ImageUri $MlImageUri
} else {
    Write-Host "`n[3b/8] Skipping ML Docker build (-SkipDocker)" -ForegroundColor Yellow
}

# 4. Generate secrets
$DbPassword = New-Secret 24
$JwtSecret = New-Secret 48
$secretsFile = "$Root\aws\.deploy-secrets.json"
@{
    region = $Region
    dbPassword = $DbPassword
    jwtSecret = $JwtSecret
    deployedAt = (Get-Date -Format o)
} | ConvertTo-Json | Out-File $secretsFile -Encoding utf8
Write-Host "`n[4/8] Secrets saved to aws/.deploy-secrets.json (gitignored)" -ForegroundColor Yellow

# 5. Deploy CloudFormation
Write-Host "`n[5/8] Deploying CloudFormation stack..." -ForegroundColor Yellow
aws cloudformation deploy `
    --template-file "$Root\aws\infrastructure.yaml" `
    --stack-name $StackName `
    --parameter-overrides `
        EnvironmentName=$EnvironmentName `
        BackendImageUri=$ImageUri `
        MlServiceImageUri=$MlImageUri `
        DBPassword=$DbPassword `
        JwtSecret=$JwtSecret `
        VpcId=$VpcId `
        PublicSubnetIds=$SubnetParam `
        FrontendUrl=$FrontendUrl `
    --capabilities CAPABILITY_IAM `
    --region $Region `
    --no-fail-on-empty-changeset

if ($LASTEXITCODE -ne 0) {
    Write-Host "CloudFormation deployment failed." -ForegroundColor Red
    exit 1
}

# 6. Read stack outputs
Write-Host "`n[6/8] Reading stack outputs..." -ForegroundColor Yellow
$outputs = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query "Stacks[0].Outputs" --output json | ConvertFrom-Json
$out = @{}
foreach ($o in $outputs) { $out[$o.OutputKey] = $o.OutputValue }

$BackendUrl = $out.BackendUrl
$PredictionUrl = $out.PredictionApiUrl
$BucketName = $out.DataBucketName
$DbHost = $out.DatabaseEndpoint

Write-Host "  Backend URL:      $BackendUrl" -ForegroundColor Green
Write-Host "  Prediction API:   $PredictionUrl" -ForegroundColor Green
Write-Host "  S3 Bucket:        $BucketName" -ForegroundColor Green
Write-Host "  RDS Endpoint:     $DbHost" -ForegroundColor Green

# Wait for ECS service to stabilize
Write-Host "`n  Waiting for ECS service to become healthy (up to 5 min)..." -ForegroundColor Gray
$healthUrl = $out.HealthCheckUrl
$healthy = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $r = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 10
        if ($r.StatusCode -eq 200) { $healthy = $true; break }
    } catch { }
    Start-Sleep -Seconds 10
}
if ($healthy) {
    Write-Host "  Health check passed: $healthUrl" -ForegroundColor Green
} else {
    Write-Host "  Health check not ready yet - ECS may still be starting. Check CloudWatch logs." -ForegroundColor Yellow
}

# 7. Upload historical data to S3
if ($UploadData) {
    Write-Host "`n[7/8] Uploading historical data to S3..." -ForegroundColor Yellow
    $dataDir = "$Root\backend\data\historical"
    if (Test-Path $dataDir) {
        aws s3 sync $dataDir "s3://$BucketName/historical/" --region $Region
        Write-Host "  Uploaded to s3://$BucketName/historical/" -ForegroundColor Green
    } else {
        Write-Host "  No local data at $dataDir - run 'npm run collect-data' first" -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[7/8] Skipping data upload (use -UploadData to sync local JSON to S3)" -ForegroundColor Yellow
}

# 8. Configure Vercel frontend
if (-not $SkipFrontend) {
    Write-Host "`n[8/8] Updating Vercel frontend..." -ForegroundColor Yellow
    if (Get-Command vercel -ErrorAction SilentlyContinue) {
        Push-Location $Root
        vercel env rm BACKEND_API_URL production --yes 2>$null
        echo $BackendUrl | vercel env add BACKEND_API_URL production
        $env:VITE_API_URL = "/api"
        npm run build
        Push-Location build
        vercel deploy --prod --yes
        Pop-Location
        Pop-Location
        Write-Host "  Frontend redeployed with BACKEND_API_URL=$BackendUrl" -ForegroundColor Green
    } else {
        Write-Host "  Vercel CLI not found. Manually set in Vercel dashboard:" -ForegroundColor Yellow
        Write-Host "    BACKEND_API_URL = $BackendUrl" -ForegroundColor White
        Write-Host "    VITE_API_URL = /api" -ForegroundColor White
    }
} else {
    Write-Host "`n[8/8] Skipping frontend deploy (-SkipFrontend)" -ForegroundColor Yellow
}

# Save deployment manifest
$manifest = @{
    region = $Region
    stackName = $StackName
    backendUrl = $BackendUrl
    healthCheckUrl = $out.HealthCheckUrl
    predictionApiUrl = $PredictionUrl
    s3Bucket = $BucketName
    databaseEndpoint = $DbHost
    frontendUrl = $FrontendUrl
    deployedAt = (Get-Date -Format o)
}
$manifest | ConvertTo-Json | Out-File "$Root\aws\deployment-output.json" -Encoding utf8

Write-Host "`n=== AWS Deployment Complete ===" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Test backend:  curl $($out.HealthCheckUrl)"
Write-Host "  2. Vercel env:    BACKEND_API_URL = $BackendUrl"
Write-Host "  3. Upload data:   aws s3 sync backend/data/historical s3://$BucketName/historical/"
Write-Host "  4. Prediction URL for engines: $PredictionUrl"
Write-Host ""
Write-Host "Local .env for backend (if running against AWS RDS):" -ForegroundColor Gray
Write-Host "  DATABASE_URL=postgresql://smarttrade:<password>@$DbHost`:5432/smarttrade"
Write-Host "  AWS_S3_DATA_BUCKET=$BucketName"
Write-Host "  AWS_PREDICTION_URL=$PredictionUrl"
Write-Host "  AWS_REGION=$Region"
