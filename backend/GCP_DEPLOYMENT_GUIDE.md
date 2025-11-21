# 🚀 GCP Deployment Guide - SmartTrade Backend

This guide will help you deploy the SmartTrade backend to Google Cloud Platform (GCP).

## 📋 Prerequisites

1. **Google Cloud Account** - [Sign up here](https://cloud.google.com/)
2. **Google Cloud SDK** - Already installed ✅
3. **GCP Project** - Create one in [GCP Console](https://console.cloud.google.com/)
4. **Billing Enabled** - Required for deployment

## 🎯 Deployment Options

We support three deployment methods:

| Method | Best For | Cost | Complexity |
|--------|----------|------|------------|
| **Cloud Run** | Serverless, auto-scaling | Pay-per-use (~$5-15/mo) | ⭐ Easy |
| **App Engine** | Managed platform | ~$10-20/mo | ⭐⭐ Medium |
| **Compute Engine** | Full control | FREE tier available | ⭐⭐⭐ Advanced |

---

## 🚀 Option 1: Cloud Run (Recommended)

### Why Cloud Run?
- ✅ Serverless - no server management
- ✅ Auto-scaling - scales to zero when not in use
- ✅ Pay only for what you use
- ✅ Built-in HTTPS
- ✅ Easy rollbacks

### Quick Deploy

```powershell
# Using the deployment script
.\deploy-gcp.ps1 -DeploymentType cloud-run -ProjectId YOUR_PROJECT_ID -Region asia-south1
```

### Manual Deploy

```powershell
# 1. Set your project
gcloud config set project YOUR_PROJECT_ID

# 2. Build and submit container
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/smarttrade-backend

# 3. Deploy to Cloud Run
gcloud run deploy smarttrade-backend `
  --image gcr.io/YOUR_PROJECT_ID/smarttrade-backend `
  --platform managed `
  --region asia-south1 `
  --allow-unauthenticated `
  --port 3001 `
  --memory 512Mi `
  --cpu 1 `
  --min-instances 0 `
  --max-instances 10 `
  --timeout 300
```

### Set Environment Variables

After deployment, set environment variables in Cloud Run:

```powershell
gcloud run services update smarttrade-backend `
  --region asia-south1 `
  --set-env-vars "NODE_ENV=production" `
  --set-env-vars "SUPABASE_URL=your_supabase_url" `
  --set-env-vars "SUPABASE_ANON_KEY=your_anon_key" `
  --set-env-vars "SUPABASE_SERVICE_KEY=your_service_key" `
  --set-env-vars "JWT_SECRET=your_jwt_secret" `
  --set-env-vars "REFRESH_TOKEN_SECRET=your_refresh_secret" `
  --set-env-vars "ENCRYPTION_KEY=your_encryption_key"
```

Or set them in the [Cloud Run Console](https://console.cloud.google.com/run):
1. Go to Cloud Run → Select your service
2. Click "Edit & Deploy New Revision"
3. Go to "Variables & Secrets" tab
4. Add environment variables

### Get Your Service URL

```powershell
gcloud run services describe smarttrade-backend --region asia-south1 --format="value(status.url)"
```

---

## 🚀 Option 2: App Engine

### Why App Engine?
- ✅ Fully managed platform
- ✅ Simple deployment
- ✅ Integrated monitoring
- ✅ Free tier available

### Deploy

```powershell
# Using the deployment script
.\deploy-gcp.ps1 -DeploymentType app-engine -ProjectId YOUR_PROJECT_ID

# Or manually
npm run build
gcloud app deploy
```

### Set Environment Variables

Edit `app.yaml` or set in [App Engine Console](https://console.cloud.google.com/appengine):
1. Go to App Engine → Settings
2. Click "Environment Variables"
3. Add your variables

### Your Service URL

```
https://YOUR_PROJECT_ID.appspot.com
```

---

## 🚀 Option 3: Compute Engine

### Why Compute Engine?
- ✅ Full control over VM
- ✅ Can run background jobs
- ✅ FREE tier (e2-micro)
- ✅ Custom configurations

### Deploy

```powershell
# Using the deployment script
.\deploy-gcp.ps1 -DeploymentType compute-engine -ProjectId YOUR_PROJECT_ID -Region asia-south1
```

### Manual Setup

```powershell
# 1. Create VM instance
gcloud compute instances create smarttrade-backend `
  --zone=asia-south1-a `
  --machine-type=e2-micro `
  --image-family=ubuntu-2004-lts `
  --image-project=ubuntu-os-cloud `
  --boot-disk-size=10GB `
  --tags=http-server,https-server

# 2. Create firewall rule
gcloud compute firewall-rules create allow-backend `
  --allow tcp:3001 `
  --source-ranges 0.0.0.0/0 `
  --target-tags=http-server

# 3. SSH into the VM
gcloud compute ssh smarttrade-backend --zone=asia-south1-a
```

### On the VM:

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Clone your repository
git clone YOUR_REPO_URL
cd portfolio-trading/backend

# Install dependencies
npm install

# Create .env file
nano .env
# Paste your environment variables

# Build
npm run build

# Start with PM2
pm2 start dist/server.js --name smarttrade-backend
pm2 startup
pm2 save

# Check status
pm2 status
pm2 logs smarttrade-backend
```

---

## 🔐 Environment Variables

Required environment variables for production:

```bash
# Server
NODE_ENV=production
PORT=8080  # Cloud Run/App Engine use 8080
API_URL=https://your-backend-url.com
FRONTEND_URL=https://your-frontend-url.com

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your-refresh-token-secret-min-32-chars

# Encryption
ENCRYPTION_KEY=your-32-byte-encryption-key-here

# Redis (optional)
REDIS_URL=redis://your-redis-url:6379

# Broker APIs (optional)
ZERODHA_API_KEY=your_zerodha_api_key
ZERODHA_API_SECRET=your_zerodha_api_secret
ZERODHA_REDIRECT_URL=https://your-backend-url.com/api/broker/zerodha/callback

UPSTOX_API_KEY=your_upstox_api_key
UPSTOX_API_SECRET=your_upstox_api_secret
UPSTOX_REDIRECT_URL=https://your-backend-url.com/api/broker/upstox/callback

# CORS
CORS_ORIGIN=https://your-frontend-url.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

---

## 🧪 Testing Your Deployment

### Health Check

```powershell
curl https://your-backend-url.com/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456
}
```

### API Endpoints

```powershell
# Get market indices
curl https://your-backend-url.com/api/market/indices

# Register a user
curl -X POST https://your-backend-url.com/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"test@example.com\",\"password\":\"Test123!\",\"name\":\"Test User\"}'
```

---

## 📊 Monitoring & Logs

### Cloud Run

```powershell
# View logs
gcloud run services logs read smarttrade-backend --region asia-south1

# View metrics
# Go to: https://console.cloud.google.com/run
```

### App Engine

```powershell
# View logs
gcloud app logs tail

# View metrics
# Go to: https://console.cloud.google.com/appengine
```

### Compute Engine

```bash
# SSH into VM
gcloud compute ssh smarttrade-backend --zone=asia-south1-a

# View PM2 logs
pm2 logs smarttrade-backend

# View PM2 status
pm2 status
```

---

## 🔄 Continuous Deployment

### Set up Cloud Build for automatic deployments

1. **Connect your repository** to Cloud Build
2. **Create a trigger** in [Cloud Build Console](https://console.cloud.google.com/cloud-build/triggers)
3. **Configure trigger**:
   - Event: Push to branch
   - Branch: `^main$`
   - Configuration: Cloud Build configuration file
   - Location: `/backend/cloudbuild.yaml`

Now every push to `main` branch will automatically deploy!

---

## 💰 Cost Estimation

### Cloud Run (Recommended)
- **Free tier**: 2M requests/month
- **After free tier**: ~$5-15/month for small apps
- **Scales to zero**: No cost when not in use

### App Engine
- **Free tier**: 28 instance hours/day
- **F1 instance**: ~$10-20/month
- **Always running**: Fixed cost

### Compute Engine
- **e2-micro**: FREE (1 instance in certain regions)
- **e2-small**: ~$13/month
- **Always running**: Fixed cost

---

## 🔒 Security Checklist

Before going live:

- [ ] Change all default secrets
- [ ] Enable HTTPS (automatic on Cloud Run/App Engine)
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Set up monitoring and alerts
- [ ] Configure firewall rules
- [ ] Enable Supabase Row Level Security
- [ ] Set up database backups
- [ ] Use Secret Manager for sensitive data
- [ ] Enable Cloud Armor (DDoS protection)

---

## 🆘 Troubleshooting

### Build Fails

```powershell
# Check build logs
gcloud builds list
gcloud builds log BUILD_ID
```

### Deployment Fails

```powershell
# Check service logs
gcloud run services logs read smarttrade-backend --region asia-south1 --limit 50
```

### Service Not Responding

1. Check if service is running
2. Check environment variables are set
3. Check firewall rules
4. Check logs for errors

### Database Connection Issues

- Verify Supabase URL and keys
- Check if Supabase project is active
- Verify network connectivity

---

## 📞 Support & Resources

- **GCP Documentation**: https://cloud.google.com/docs
- **Cloud Run Docs**: https://cloud.google.com/run/docs
- **App Engine Docs**: https://cloud.google.com/appengine/docs
- **Supabase Docs**: https://supabase.com/docs
- **Project Issues**: https://github.com/edgexailab/portfolio-trading/issues

---

## 🎉 Next Steps

After successful deployment:

1. **Update Frontend**: Set `VITE_API_URL` to your backend URL
2. **Test All Endpoints**: Verify all API endpoints work
3. **Set Up Monitoring**: Configure alerts for errors
4. **Enable Backups**: Set up database backups
5. **Configure Domain**: Add custom domain (optional)
6. **SSL Certificate**: Enable HTTPS (automatic on Cloud Run)
7. **Performance Testing**: Load test your API
8. **Documentation**: Update API documentation

---

**Your backend is ready for production! 🚀**
