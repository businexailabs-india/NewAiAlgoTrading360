# 🚀 Deployment Guide

## Deployment Options

Your SmartTrade backend can be deployed to multiple platforms. Here are the best options:

---

## ✅ Option 1: Vercel (Recommended - Easiest)

### Why Vercel?
- ✅ **Serverless** - No server management
- ✅ **Free Tier** - Perfect for MVP
- ✅ **Auto Deploy** - Push to GitHub = Deploy
- ✅ **Global CDN** - Fast worldwide
- ✅ **Zero Config** - Works out of the box

### Setup Steps

#### 1. Install Vercel CLI
```bash
npm install -g vercel
```

#### 2. Login to Vercel
```bash
vercel login
```

#### 3. Deploy
```bash
cd backend
vercel
```

Follow the prompts:
- **Set up and deploy?** Yes
- **Which scope?** Your account
- **Link to existing project?** No
- **Project name?** smarttrade-backend
- **Directory?** ./
- **Override settings?** No

#### 4. Add Environment Variables
Go to: https://vercel.com/dashboard

1. Select your project
2. Go to Settings → Environment Variables
3. Add all variables from your `.env` file:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
   - `JWT_SECRET`
   - `REFRESH_TOKEN_SECRET`
   - `ENCRYPTION_KEY`
   - etc.

#### 5. Redeploy
```bash
vercel --prod
```

### Vercel Configuration

Create `vercel.json` in backend folder:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/server.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/server.ts"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### Your Backend URL
After deployment: `https://smarttrade-backend.vercel.app`

---

## ✅ Option 2: Google Cloud Platform (GCP)

### Why GCP?
- ✅ **Scalable** - Handle any load
- ✅ **Reliable** - 99.95% uptime SLA
- ✅ **Flexible** - Full control
- ✅ **Free Tier** - $300 credit for 90 days

### Deployment Options on GCP

#### A. Cloud Run (Recommended - Serverless)

**Best for:** Auto-scaling, pay-per-use

##### 1. Install Google Cloud SDK
Download from: https://cloud.google.com/sdk/docs/install

##### 2. Login & Setup
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

##### 3. Create Dockerfile (already exists)
Your `Dockerfile` is ready in the backend folder.

##### 4. Build & Deploy
```bash
cd backend

# Build container
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/smarttrade-backend

# Deploy to Cloud Run
gcloud run deploy smarttrade-backend \
  --image gcr.io/YOUR_PROJECT_ID/smarttrade-backend \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars "SUPABASE_URL=https://dfzrjfrplludgnycfqbj.supabase.co" \
  --set-env-vars "SUPABASE_ANON_KEY=your_key" \
  --set-env-vars "JWT_SECRET=your_secret"
```

##### 5. Get Your URL
```bash
gcloud run services describe smarttrade-backend --region asia-south1
```

Your backend: `https://smarttrade-backend-xxxxx-as.a.run.app`

#### B. App Engine (Fully Managed)

**Best for:** Traditional apps, simple deployment

##### 1. Create `app.yaml`
```yaml
runtime: nodejs18
env: standard
instance_class: F1

automatic_scaling:
  min_instances: 0
  max_instances: 10

env_variables:
  NODE_ENV: "production"
  SUPABASE_URL: "https://dfzrjfrplludgnycfqbj.supabase.co"
  SUPABASE_ANON_KEY: "your_key"
  JWT_SECRET: "your_secret"
```

##### 2. Deploy
```bash
cd backend
gcloud app deploy
```

Your backend: `https://YOUR_PROJECT_ID.appspot.com`

#### C. Compute Engine (VPS)

**Best for:** Full control, custom setup

##### 1. Create VM Instance
```bash
gcloud compute instances create smarttrade-backend \
  --zone=asia-south1-a \
  --machine-type=e2-micro \
  --image-family=ubuntu-2004-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=10GB
```

##### 2. SSH into VM
```bash
gcloud compute ssh smarttrade-backend --zone=asia-south1-a
```

##### 3. Setup on VM
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Clone your repo
git clone https://github.com/edgexailab/portfolio-trading.git
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
```

##### 4. Setup Firewall
```bash
gcloud compute firewall-rules create allow-backend \
  --allow tcp:3001 \
  --source-ranges 0.0.0.0/0
```

Your backend: `http://EXTERNAL_IP:3001`

---

## 💰 Cost Comparison

### Vercel
| Tier | Price | Features |
|------|-------|----------|
| Hobby | **FREE** | 100GB bandwidth, Serverless functions |
| Pro | $20/mo | 1TB bandwidth, Team features |

### GCP Cloud Run
| Usage | Cost |
|-------|------|
| First 2M requests | **FREE** |
| Per million requests | $0.40 |
| Memory (per GB-second) | $0.0000025 |
| **Estimated monthly** | **$5-15** |

### GCP App Engine
| Tier | Cost |
|------|------|
| F1 instance | **FREE** (28 hrs/day) |
| Additional hours | $0.05/hour |
| **Estimated monthly** | **$10-20** |

### GCP Compute Engine
| Instance | Cost |
|----------|------|
| e2-micro | **FREE** (1 instance) |
| e2-small | $13/month |
| **Estimated monthly** | **FREE-$13** |

---

## 🎯 Recommendation

### For MVP / Small Scale
**Use Vercel** ✅
- Easiest setup (5 minutes)
- Free tier sufficient
- Auto-scaling
- No maintenance

### For Production / Scale
**Use GCP Cloud Run** ✅
- Auto-scaling
- Pay only for usage
- Better for APIs
- More control

### For Full Control
**Use GCP Compute Engine**
- Complete control
- Can run background jobs
- Custom configurations
- Best price/performance

---

## 🔧 Environment Variables Needed

For any deployment, you'll need these:

```bash
# Supabase
SUPABASE_URL=https://dfzrjfrplludgnycfqbj.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# JWT
JWT_SECRET=your-production-secret-key
REFRESH_TOKEN_SECRET=your-refresh-secret-key

# Encryption
ENCRYPTION_KEY=your-32-byte-encryption-key

# Optional - Broker APIs
ZERODHA_API_KEY=your_key
ZERODHA_API_SECRET=your_secret
UPSTOX_API_KEY=your_key
UPSTOX_API_SECRET=your_secret
```

---

## 🌐 Update Frontend

After deployment, update your frontend `.env`:

```bash
# For Vercel
VITE_API_URL=https://smarttrade-backend.vercel.app

# For GCP Cloud Run
VITE_API_URL=https://smarttrade-backend-xxxxx-as.a.run.app

# For GCP Compute Engine
VITE_API_URL=http://YOUR_EXTERNAL_IP:3001
```

---

## 🧪 Test Deployment

```bash
# Health check
curl https://your-backend-url.com/health

# Market data
curl https://your-backend-url.com/api/market/indices

# Register user
curl -X POST https://your-backend-url.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test"}'
```

---

## 📊 Monitoring

### Vercel
- Dashboard: https://vercel.com/dashboard
- Logs: Real-time in dashboard
- Analytics: Built-in

### GCP
- Cloud Console: https://console.cloud.google.com
- Logs: Cloud Logging
- Monitoring: Cloud Monitoring
- Alerts: Set up in Cloud Monitoring

---

## 🔒 Security Checklist

Before going live:

- [ ] Change all default secrets in `.env`
- [ ] Enable HTTPS (automatic on Vercel/Cloud Run)
- [ ] Set up CORS properly
- [ ] Enable rate limiting
- [ ] Set up monitoring/alerts
- [ ] Configure firewall rules (GCP)
- [ ] Enable Row Level Security in Supabase
- [ ] Set up database backups
- [ ] Add API key rotation
- [ ] Enable logging

---

## 🚀 Quick Deploy Commands

### Vercel (Fastest)
```bash
cd backend
vercel --prod
```

### GCP Cloud Run
```bash
cd backend
gcloud run deploy smarttrade-backend \
  --source . \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated
```

### GCP App Engine
```bash
cd backend
gcloud app deploy
```

---

## 📞 Support

- Vercel Docs: https://vercel.com/docs
- GCP Docs: https://cloud.google.com/docs
- Supabase Docs: https://supabase.com/docs

**Your backend is ready to deploy anywhere!** 🎉
