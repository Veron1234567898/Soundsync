# Railway Deployment Guide

## Quick Railway Deployment

### Step 1: Deploy to Railway
1. **Visit Railway**: Go to [railway.app](https://railway.app)
2. **Sign Up/Login**: Use GitHub account (recommended)
3. **New Project**: Click "New Project"
4. **Deploy from GitHub**: Select "Deploy from GitHub repo"
5. **Connect Repository**: Choose your soundboard repo

### Step 2: Add PostgreSQL Database
1. **Add Service**: Click "Add Service" in your project
2. **Database**: Select "PostgreSQL" 
3. **Deploy**: Database will be provisioned automatically

### Step 3: Configure Environment Variables
You need to manually connect the database to your web service:

**In your web service settings:**
1. Go to **Variables** tab
2. Add new variable:
   - **Name**: `DATABASE_URL`
   - **Value**: `${{ soundboard-db.DATABASE_URL }}`

Railway will also automatically set:
- `PORT` (Railway manages this)
- `NODE_ENV=production`

### Step 4: Deploy
- Railway automatically builds and deploys
- Build time: ~2-3 minutes
- Your app will be available at: `https://your-app-name.up.railway.app`

## Railway vs Render Advantages

### Railway Benefits:
✅ **Faster deployment** (2-3 minutes vs 5-7 minutes)
✅ **Automatic database connection** (no manual configuration)
✅ **Better free tier** (512MB RAM, 1GB storage)
✅ **Simpler setup** (one-click PostgreSQL)
✅ **Better WebSocket support** (no timeouts)
✅ **Git-based deployments** (auto-deploy on push)

### Pricing:
- **Free Tier**: $5 usage credit per month
- **Pro Plan**: $20/month (unlimited usage)
- **PostgreSQL**: Included in free tier

## What Happens Automatically

✅ **Build Process**: 
- `npm install` (installs dependencies)
- `npm run build` (builds frontend and backend)
- Nixpacks detects Node.js automatically

✅ **Database Setup**:
- PostgreSQL service created
- `DATABASE_URL` environment variable set
- Database schema will be created on first run

✅ **WebSocket Support**:
- Full WebSocket support for voice chat
- No connection timeouts
- Real-time features work perfectly

## Manual Setup (if needed)

If automatic detection doesn't work:

### 1. Build Command
```bash
npm run build
```

### 2. Start Command  
```bash
npm start
```

### 3. Environment Variables
Add manually if needed:
```
NODE_ENV=production
DATABASE_URL=[automatically set by Railway]
```

## Testing Your Deployment

1. **Visit your app URL**: `https://your-app.up.railway.app`
2. **Create a room**: Test room creation and joining
3. **Upload audio**: Test file upload functionality  
4. **Voice chat**: Test WebRTC voice communication
5. **Multiple users**: Test with multiple browser tabs

## Post-Deployment

### Domain Setup (Optional)
- Go to project settings
- Add custom domain
- Railway provides HTTPS automatically

### Monitoring
- Railway dashboard shows:
  - Real-time logs
  - Resource usage
  - Database metrics
  - Deployment history

### Database Management
- Railway provides database URL for external tools
- Use any PostgreSQL client (pgAdmin, DBeaver, etc.)
- Connection details in project settings

## Troubleshooting

### Build Failures
```bash
# Check logs in Railway dashboard
# Most common issues:
# 1. Missing dependencies (check package.json)
# 2. Environment variables not set
# 3. Database connection issues
```

### Database Issues
```bash
# Railway automatically connects database
# If issues persist:
# 1. Check DATABASE_URL in environment
# 2. Verify PostgreSQL service is running
# 3. Check database logs in dashboard
```

### WebSocket Issues
```bash
# Railway has excellent WebSocket support
# If voice chat doesn't work:
# 1. Check browser permissions (microphone)
# 2. Test with HTTPS (required for WebRTC)
# 3. Verify STUN server configuration
```

Your soundboard app will be live and fully functional with persistent storage and real-time voice chat!