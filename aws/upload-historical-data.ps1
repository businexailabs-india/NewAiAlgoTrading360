# Upload local historical JSON files to AWS S3
param(
    [string]$Region = "ap-south-1",
    [string]$StackName = "smarttrade-platform",
    [string]$BucketName = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$dataDir = "$Root\backend\data\historical"

if (-not $BucketName) {
    $BucketName = aws cloudformation describe-stacks `
        --stack-name $StackName `
        --region $Region `
        --query "Stacks[0].Outputs[?OutputKey=='DataBucketName'].OutputValue" `
        --output text
}

if (-not $BucketName -or $BucketName -eq "None") {
    Write-Host "ERROR: Could not resolve S3 bucket. Deploy stack first or pass -BucketName" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $dataDir)) {
    Write-Host "ERROR: No data at $dataDir. Run: cd backend && npm run collect-data" -ForegroundColor Red
    exit 1
}

Write-Host "Uploading $dataDir -> s3://$BucketName/historical/" -ForegroundColor Cyan
aws s3 sync $dataDir "s3://$BucketName/historical/" --region $Region
Write-Host "Done. $($((Get-ChildItem $dataDir -Filter *.json).Count)) files synced." -ForegroundColor Green
