# SmartTrade Backend - GCP Deployment Script
# This script helps deploy the backend to Google Cloud Platform

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('cloud-run', 'app-engine', 'compute-engine')]
    [string]$DeploymentType = 'cloud-run',
    
    [Parameter(Mandatory=$false)]
    [string]$ProjectId,
    
    [Parameter(Mandatory=$false)]
    [string]$Region = 'asia-south1'
)

Write-Host "🚀 SmartTrade Backend - GCP Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if gcloud is installed
try {
    $gcloudVersion = gcloud --version 2>&1 | Select-Object -First 1
    Write-Host "✅ Google Cloud SDK: $gcloudVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Google Cloud SDK not found!" -ForegroundColor Red
    Write-Host "Please install from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Get current project if not specified
if (-not $ProjectId) {
    $currentProject = gcloud config get-value project 2>$null
    if ($currentProject) {
        Write-Host "📋 Current GCP Project: $currentProject" -ForegroundColor Yellow
        $useCurrentProject = Read-Host "Use this project? (Y/n)"
        if ($useCurrentProject -eq '' -or $useCurrentProject -eq 'Y' -or $useCurrentProject -eq 'y') {
            $ProjectId = $currentProject
        } else {
            $ProjectId = Read-Host "Enter your GCP Project ID"
        }
    } else {
        $ProjectId = Read-Host "Enter your GCP Project ID"
    }
}

Write-Host ""
Write-Host "📦 Deployment Configuration:" -ForegroundColor Cyan
Write-Host "   Type: $DeploymentType" -ForegroundColor White
Write-Host "   Project: $ProjectId" -ForegroundColor White
Write-Host "   Region: $Region" -ForegroundColor White
Write-Host ""

# Set the project
Write-Host "🔧 Setting GCP project..." -ForegroundColor Yellow
gcloud config set project $ProjectId

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  Warning: .env file not found!" -ForegroundColor Yellow
    Write-Host "   Please create .env file with production values" -ForegroundColor Yellow
    Write-Host "   You can copy from .env.example and update values" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne 'y' -and $continue -ne 'Y') {
        exit 1
    }
}

# Deploy based on type
switch ($DeploymentType) {
    'cloud-run' {
        Write-Host ""
        Write-Host "🚀 Deploying to Cloud Run..." -ForegroundColor Cyan
        Write-Host ""
        
        # Build and deploy
        Write-Host "📦 Building container image..." -ForegroundColor Yellow
        gcloud builds submit --tag gcr.io/$ProjectId/smarttrade-backend
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Container built successfully!" -ForegroundColor Green
            Write-Host ""
            Write-Host "🚀 Deploying to Cloud Run..." -ForegroundColor Yellow
            
            # Deploy to Cloud Run
            gcloud run deploy smarttrade-backend `
                --image gcr.io/$ProjectId/smarttrade-backend `
                --platform managed `
                --region $Region `
                --allow-unauthenticated `
                --port 3001 `
                --memory 512Mi `
                --cpu 1 `
                --min-instances 0 `
                --max-instances 10 `
                --timeout 300
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "✅ Deployment successful!" -ForegroundColor Green
                Write-Host ""
                
                # Get service URL
                $serviceUrl = gcloud run services describe smarttrade-backend --region $Region --format="value(status.url)"
                Write-Host "🌐 Your backend is live at:" -ForegroundColor Cyan
                Write-Host "   $serviceUrl" -ForegroundColor Green
                Write-Host ""
                Write-Host "📝 Next steps:" -ForegroundColor Yellow
                Write-Host "   1. Set environment variables in Cloud Run console" -ForegroundColor White
                Write-Host "   2. Update frontend VITE_API_URL to: $serviceUrl" -ForegroundColor White
                Write-Host "   3. Test the deployment: curl $serviceUrl/health" -ForegroundColor White
            } else {
                Write-Host "❌ Deployment failed!" -ForegroundColor Red
                exit 1
            }
        } else {
            Write-Host "❌ Container build failed!" -ForegroundColor Red
            exit 1
        }
    }
    
    'app-engine' {
        Write-Host ""
        Write-Host "🚀 Deploying to App Engine..." -ForegroundColor Cyan
        Write-Host ""
        
        # Check if app.yaml exists
        if (-not (Test-Path "app.yaml")) {
            Write-Host "❌ app.yaml not found!" -ForegroundColor Red
            exit 1
        }
        
        # Build the project
        Write-Host "📦 Building project..." -ForegroundColor Yellow
        npm run build
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Build successful!" -ForegroundColor Green
            Write-Host ""
            Write-Host "🚀 Deploying to App Engine..." -ForegroundColor Yellow
            
            # Deploy to App Engine
            gcloud app deploy --quiet
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "✅ Deployment successful!" -ForegroundColor Green
                Write-Host ""
                Write-Host "🌐 Your backend is live at:" -ForegroundColor Cyan
                Write-Host "   https://$ProjectId.appspot.com" -ForegroundColor Green
                Write-Host ""
                Write-Host "📝 Next steps:" -ForegroundColor Yellow
                Write-Host "   1. Update environment variables in app.yaml" -ForegroundColor White
                Write-Host "   2. Update frontend VITE_API_URL to: https://$ProjectId.appspot.com" -ForegroundColor White
                Write-Host "   3. Test the deployment: curl https://$ProjectId.appspot.com/health" -ForegroundColor White
            } else {
                Write-Host "❌ Deployment failed!" -ForegroundColor Red
                exit 1
            }
        } else {
            Write-Host "❌ Build failed!" -ForegroundColor Red
            exit 1
        }
    }
    
    'compute-engine' {
        Write-Host ""
        Write-Host "🚀 Setting up Compute Engine..." -ForegroundColor Cyan
        Write-Host ""
        Write-Host "This will create a VM instance and deploy the backend" -ForegroundColor Yellow
        Write-Host ""
        
        $instanceName = "smarttrade-backend"
        $zone = "$Region-a"
        
        # Check if instance exists
        $existingInstance = gcloud compute instances list --filter="name=$instanceName" --format="value(name)" 2>$null
        
        if ($existingInstance) {
            Write-Host "⚠️  Instance '$instanceName' already exists!" -ForegroundColor Yellow
            $recreate = Read-Host "Delete and recreate? (y/N)"
            if ($recreate -eq 'y' -or $recreate -eq 'Y') {
                Write-Host "🗑️  Deleting existing instance..." -ForegroundColor Yellow
                gcloud compute instances delete $instanceName --zone=$zone --quiet
            } else {
                Write-Host "❌ Deployment cancelled" -ForegroundColor Red
                exit 1
            }
        }
        
        # Create VM instance
        Write-Host "🖥️  Creating VM instance..." -ForegroundColor Yellow
        gcloud compute instances create $instanceName `
            --zone=$zone `
            --machine-type=e2-micro `
            --image-family=ubuntu-2004-lts `
            --image-project=ubuntu-os-cloud `
            --boot-disk-size=10GB `
            --tags=http-server,https-server
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ VM instance created!" -ForegroundColor Green
            Write-Host ""
            Write-Host "🔧 Setting up firewall rules..." -ForegroundColor Yellow
            
            # Create firewall rule
            gcloud compute firewall-rules create allow-backend `
                --allow tcp:3001 `
                --source-ranges 0.0.0.0/0 `
                --target-tags=http-server 2>$null
            
            # Get external IP
            $externalIp = gcloud compute instances describe $instanceName --zone=$zone --format="value(networkInterfaces[0].accessConfigs[0].natIP)"
            
            Write-Host ""
            Write-Host "✅ Setup complete!" -ForegroundColor Green
            Write-Host ""
            Write-Host "📝 Manual steps required:" -ForegroundColor Yellow
            Write-Host "   1. SSH into the instance:" -ForegroundColor White
            Write-Host "      gcloud compute ssh $instanceName --zone=$zone" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "   2. Run these commands on the VM:" -ForegroundColor White
            Write-Host "      # Install Node.js" -ForegroundColor Gray
            Write-Host "      curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -" -ForegroundColor Cyan
            Write-Host "      sudo apt-get install -y nodejs" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "      # Install PM2" -ForegroundColor Gray
            Write-Host "      sudo npm install -g pm2" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "      # Clone and setup" -ForegroundColor Gray
            Write-Host "      git clone <your-repo-url>" -ForegroundColor Cyan
            Write-Host "      cd portfolio-trading/backend" -ForegroundColor Cyan
            Write-Host "      npm install" -ForegroundColor Cyan
            Write-Host "      npm run build" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "      # Create .env file with production values" -ForegroundColor Gray
            Write-Host "      nano .env" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "      # Start with PM2" -ForegroundColor Gray
            Write-Host "      pm2 start dist/server.js --name smarttrade-backend" -ForegroundColor Cyan
            Write-Host "      pm2 startup" -ForegroundColor Cyan
            Write-Host "      pm2 save" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "🌐 Your backend will be available at:" -ForegroundColor Cyan
            Write-Host "   http://$externalIp:3001" -ForegroundColor Green
        } else {
            Write-Host "❌ VM creation failed!" -ForegroundColor Red
            exit 1
        }
    }
}

Write-Host ""
Write-Host "🎉 Deployment process completed!" -ForegroundColor Green
Write-Host ""
