# 🚀 SmartTrade Backend - GCP Deployment Ready

Your backend is **fully configured** and ready to deploy to Google Cloud Platform!

## ✅ What's Been Set Up

### Deployment Files Created
- ✅ `deploy-gcp.ps1` - Automated deployment script for all GCP services
- ✅ `set-gcp-env.ps1` - Environment variable setup script
- ✅ `cloudbuild.yaml` - Cloud Build configuration for CI/CD
- ✅ `.gcloudignore` - Files to exclude from deployment
- ✅ `app.yaml` - App Engine configuration (updated)
- ✅ `Dockerfile` - Container configuration (already existed)
- ✅ `GCP_DEPLOYMENT_GUIDE.md` - Comprehensive deployment guide
- ✅ `DEPLOY_NOW.md` - Quick start deployment guide

### NPM Scripts Added
- ✅ `npm run deploy:cloud-run` - Deploy to Cloud Run
- ✅ `npm run deploy:app-engine` - Deploy to App Engine
- ✅ `npm run deploy:compute` - Deploy to Compute Engine
- ✅ `npm run gcp:set-env` - Set environment variables

---

## 🎯 Quick Deploy (Choose One)

### Option 1: Cloud Run (Recommended) ⭐
**Best for:** Auto-scaling, serverless, pay-per-use

```powershell
cd backend
npm run deploy:cloud-run
```

### Option 2: App Engine
**Best for:** Fully managed, simple deployment

```powershell
cd backend
npm run deploy:app-engine
```

### Option 3: Compute Engine
**Best for:** Full control, custom setup

```powershell
cd backend
npm run deploy:compute
```

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| **DEPLOY_NOW.md** | ⚡ Quick start - Deploy in 5 minutes |
| **GCP_DEPLOYMENT_GUIDE.md** | 📖 Complete guide with all options |
| **DEPLOYMENT.md** | 🌐 All deployment platforms (Vercel, GCP, etc.) |

---

## 🔧 Prerequisites

1. **Google Cloud SDK** - ✅ Already installed (v539.0.0)
2. **GCP Project** - Create at [console.cloud.google.com](https://console.cloud.google.com)
3. **Billing Enabled** - Required for deployment
4. **Environment Variables** - Copy `.env.example` to `.env` and update

---

## ⚡ Fastest Deployment Path

```powershell
# 1. Navigate to backend
cd backend

# 2. Create .env file (if not exists)
cp .env.example .env
# Edit .env with your production values

# 3. Deploy to Cloud Run (recommended)
npm run deploy:cloud-run

# 4. When prompted, enter your GCP Project ID

# 5. Set environment variables
npm run gcp:set-env -- -ProjectId YOUR_PROJECT_ID

# 6. Get your service URL
gcloud run services describe smarttrade-backend --region asia-south1 --format="value(status.url)"

# 7. Test deployment
curl https://your-service-url.run.app/health
```

**That's it! Your backend is live! 🎉**

---

## 🌐 Service URLs

After deployment, your backend will be available at:

### Cloud Run
```
https://smarttrade-backend-xxxxx-as.a.run.app
```

### App Engine
```
https://YOUR_PROJECT_ID.appspot.com
```

### Compute Engine
```
http://EXTERNAL_IP:3001
```

---

## 🔐 Environment Variables Required

Minimum required for production:

```bash
NODE_ENV=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
JWT_SECRET=your-strong-secret-min-32-chars
REFRESH_TOKEN_SECRET=your-refresh-secret-min-32-chars
ENCRYPTION_KEY=your-32-byte-encryption-key
```

Optional (for broker integration):
```bash
ZERODHA_API_KEY=your_key
ZERODHA_API_SECRET=your_secret
UPSTOX_API_KEY=your_key
UPSTOX_API_SECRET=your_secret
```

---

## 💰 Cost Comparison

| Service | Free Tier | Typical Cost | Best For |
|---------|-----------|--------------|----------|
| **Cloud Run** | 2M requests/mo | $5-15/mo | Auto-scaling apps |
| **App Engine** | 28 hrs/day | $10-20/mo | Simple deployment |
| **Compute Engine** | 1 e2-micro | FREE-$13/mo | Full control |

---

## 🧪 Testing Your Deployment

```powershell
# Health check
curl https://your-backend-url/health

# Market indices
curl https://your-backend-url/api/market/indices

# Register user
curl -X POST https://your-backend-url/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com","password":"Test123!","name":"Test"}'
```

---

## 📊 Monitoring

### View Logs
```powershell
# Cloud Run
gcloud run services logs read smarttrade-backend --region asia-south1

# App Engine
gcloud app logs tail
```

### View Metrics
- Cloud Run: https://console.cloud.google.com/run
- App Engine: https://console.cloud.google.com/appengine
- Compute Engine: https://console.cloud.google.com/compute

---

## 🔄 Continuous Deployment

Set up automatic deployments on every push:

1. Go to [Cloud Build Console](https://console.cloud.google.com/cloud-build/triggers)
2. Click "Create Trigger"
3. Connect your repository
4. Configure:
   - Event: Push to branch
   - Branch: `^main$`
   - Configuration: `backend/cloudbuild.yaml`
5. Save

Now every push to `main` automatically deploys! 🚀

---

## 🆘 Troubleshooting

### Authentication Issues
```powershell
gcloud auth login
gcloud auth application-default login
```

### Enable Required APIs
```powershell
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### View Build Logs
```powershell
gcloud builds list
gcloud builds log BUILD_ID
```

---

## 📞 Support

- **Quick Start**: `DEPLOY_NOW.md`
- **Full Guide**: `GCP_DEPLOYMENT_GUIDE.md`
- **All Options**: `DEPLOYMENT.md`
- **GCP Console**: https://console.cloud.google.com
- **Cloud Run Docs**: https://cloud.google.com/run/docs

---

## 🎉 Next Steps After Deployment

1. **Update Frontend** - Set `VITE_API_URL` to your backend URL
2. **Test Endpoints** - Verify all API routes work
3. **Set Up Monitoring** - Configure alerts in Cloud Console
4. **Enable Backups** - Set up Supabase backups
5. **Custom Domain** - Add your domain (optional)
6. **SSL Certificate** - Automatic on Cloud Run/App Engine
7. **Performance Test** - Load test your API
8. **Documentation** - Update API docs with production URL

---

## 🔒 Security Checklist

- [ ] Strong JWT secrets (min 32 characters)
- [ ] CORS configured for frontend domain only
- [ ] Rate limiting enabled (already configured)
- [ ] Supabase Row Level Security enabled
- [ ] Environment variables secured
- [ ] HTTPS enabled (automatic)
- [ ] Monitoring and alerts set up
- [ ] Database backups configured

---

## 📈 Scaling

Your backend is configured to auto-scale:

### Cloud Run
- Min instances: 0 (scales to zero)
- Max instances: 10
- Memory: 512Mi
- CPU: 1

### App Engine
- Min instances: 0
- Max instances: 10
- Instance class: F1

Adjust in deployment scripts or GCP Console as needed.

---

## 🎯 Production Checklist

Before going live:

- [ ] Environment variables set with production values
- [ ] Supabase project configured
- [ ] JWT secrets changed from defaults
- [ ] CORS configured for production domain
- [ ] Monitoring enabled
- [ ] Logs configured
- [ ] Backups enabled
- [ ] Health checks working
- [ ] All endpoints tested
- [ ] Frontend connected to production API

---

**Your SmartTrade backend is production-ready! 🚀**

Deploy now with: `npm run deploy:cloud-run`
