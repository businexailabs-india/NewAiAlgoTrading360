# 🚀 Deploy to GCP - Quick Start

## ⚡ Fastest Way to Deploy (5 minutes)

### Step 1: Prepare Environment Variables

Create a `.env` file in the backend folder with production values:

```bash
cp .env.example .env
# Edit .env with your production values
```

**Required variables:**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon key
- `SUPABASE_SERVICE_KEY` - Your Supabase service key
- `JWT_SECRET` - Strong secret (min 32 characters)
- `REFRESH_TOKEN_SECRET` - Strong secret (min 32 characters)
- `ENCRYPTION_KEY` - 32-byte encryption key

### Step 2: Choose Your Deployment Method

#### Option A: Cloud Run (Recommended) ⭐

```powershell
# Deploy with one command
npm run deploy:cloud-run

# When prompted, enter your GCP Project ID
```

#### Option B: App Engine

```powershell
# Deploy with one command
npm run deploy:app-engine

# When prompted, enter your GCP Project ID
```

#### Option C: Compute Engine (Advanced)

```powershell
# Deploy with one command
npm run deploy:compute

# When prompted, enter your GCP Project ID
```

### Step 3: Set Environment Variables (Cloud Run only)

After deployment, set your environment variables:

```powershell
# Set your project ID
$PROJECT_ID = "your-project-id"

# Run the environment setup script
npm run gcp:set-env -- -ProjectId $PROJECT_ID
```

### Step 4: Test Your Deployment

```powershell
# Get your service URL
gcloud run services describe smarttrade-backend --region asia-south1 --format="value(status.url)"

# Test health endpoint
curl https://your-service-url.run.app/health
```

---

## 📋 Manual Deployment (Cloud Run)

If you prefer manual control:

```powershell
# 1. Set your project
gcloud config set project YOUR_PROJECT_ID

# 2. Build and deploy in one command
gcloud run deploy smarttrade-backend `
  --source . `
  --platform managed `
  --region asia-south1 `
  --allow-unauthenticated `
  --port 3001 `
  --memory 512Mi

# 3. Set environment variables
gcloud run services update smarttrade-backend `
  --region asia-south1 `
  --set-env-vars "NODE_ENV=production,SUPABASE_URL=your_url,SUPABASE_ANON_KEY=your_key"
```

---

## 🔧 Troubleshooting

### "Project not found"
```powershell
# List your projects
gcloud projects list

# Set the correct project
gcloud config set project YOUR_PROJECT_ID
```

### "API not enabled"
```powershell
# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### "Authentication required"
```powershell
# Login to GCP
gcloud auth login

# Set application default credentials
gcloud auth application-default login
```

### Build fails
- Check if Dockerfile exists
- Verify all dependencies are in package.json
- Check if TypeScript compiles: `npm run build`

---

## 📊 What Gets Deployed?

### Cloud Run
- ✅ Docker container with your backend
- ✅ Auto-scaling (0 to 10 instances)
- ✅ HTTPS enabled automatically
- ✅ Health checks configured
- ✅ Logs in Cloud Logging

### App Engine
- ✅ Node.js 18 runtime
- ✅ Auto-scaling configured
- ✅ HTTPS enabled automatically
- ✅ Health checks configured
- ✅ Logs in Cloud Logging

---

## 🌐 After Deployment

### Update Your Frontend

Update your frontend `.env` file:

```bash
VITE_API_URL=https://your-backend-url.run.app
```

### Test All Endpoints

```powershell
# Health check
curl https://your-backend-url.run.app/health

# Market data
curl https://your-backend-url.run.app/api/market/indices

# Register user
curl -X POST https://your-backend-url.run.app/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com","password":"Test123!","name":"Test"}'
```

### Monitor Your Service

```powershell
# View logs
gcloud run services logs read smarttrade-backend --region asia-south1

# View metrics in console
# https://console.cloud.google.com/run
```

---

## 💰 Cost Estimate

### Cloud Run (Recommended)
- **Free tier**: 2M requests/month
- **Typical cost**: $5-15/month for small apps
- **Scales to zero**: No cost when idle

### App Engine
- **Free tier**: 28 instance hours/day
- **Typical cost**: $10-20/month
- **Always running**: Fixed cost

---

## 🔐 Security Checklist

Before going live:

- [ ] Change all default secrets in `.env`
- [ ] Use strong JWT secrets (min 32 characters)
- [ ] Enable CORS for your frontend domain only
- [ ] Set up rate limiting (already configured)
- [ ] Enable Supabase Row Level Security
- [ ] Set up monitoring and alerts
- [ ] Use Secret Manager for sensitive data (recommended)

---

## 📞 Need Help?

- **Full Guide**: See `GCP_DEPLOYMENT_GUIDE.md`
- **Deployment Options**: See `DEPLOYMENT.md`
- **GCP Console**: https://console.cloud.google.com
- **Cloud Run Docs**: https://cloud.google.com/run/docs

---

## 🎉 You're Done!

Your backend is now live on Google Cloud Platform!

**Next steps:**
1. Update frontend with new API URL
2. Test all endpoints
3. Set up monitoring
4. Configure custom domain (optional)
5. Enable backups

**Your backend URL:**
```
https://smarttrade-backend-xxxxx-as.a.run.app
```

🚀 **Happy deploying!**
