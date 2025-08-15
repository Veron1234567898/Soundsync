# Complete Railway Setup Guide

## Current Status
✅ **soundboard-db** - Database deployed and running
❌ **soundboard-app** - Web service needs deployment
❌ **SOUNDBOARD2** - Extra service (can be deleted)

## Step-by-Step Setup

### 1. Fix the Web Service Deployment

**For soundboard-app:**
1. Click on the **soundboard-app** card
2. Go to **Settings** → **Service**
3. Check **Source** - should point to your GitHub repo
4. If source is missing:
   - Click **Connect Repo**
   - Select your soundboard repository
   - Set **Root Directory** to `/` (root)

### 2. Add Environment Variables

**In soundboard-app service:**
1. Go to **Variables** tab
2. Add these variables:

```
Name: DATABASE_URL
Value: ${{ soundboard-db.DATABASE_URL }}

Name: NODE_ENV  
Value: production
```

### 3. Configure Build Settings (if needed)

**If build fails, in Settings → Build:**
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Node Version**: 20

### 4. Deploy the Web Service

1. In **soundboard-app**, click **Deploy**
2. Wait 3-5 minutes for build to complete
3. Check **Deployments** tab for logs

### 5. Generate Public URL

**After successful deployment:**
1. Go to **Settings** → **Networking**
2. Click **Generate Domain**
3. Your app will be live at: `https://soundboard-app-production.up.railway.app`

### 6. Clean Up (Optional)

**Delete SOUNDBOARD2:**
1. Click on **SOUNDBOARD2** service
2. Go to **Settings** → **Danger**
3. Click **Delete Service**

## Troubleshooting

### Build Fails
- Check **Deployments** → **Build Logs**
- Ensure GitHub repo is properly connected
- Verify `package.json` has correct scripts

### Database Connection Issues
- Verify `DATABASE_URL` variable is set correctly
- Check database is in "Available" status
- Test database connection in logs

### App Won't Start
- Check **Runtime Logs** in Deployments
- Ensure all environment variables are set
- Verify Node.js version compatibility

## Expected Result

Your soundboard app will have:
- ✅ PostgreSQL database with persistent storage
- ✅ Real-time voice chat via WebRTC
- ✅ File upload functionality
- ✅ Multi-user room collaboration
- ✅ HTTPS encryption (automatic)

## Testing Your Deployment

1. Visit your generated URL
2. Create a new room
3. Upload an audio file
4. Test voice chat (allow microphone permission)
5. Share room code with others to test collaboration