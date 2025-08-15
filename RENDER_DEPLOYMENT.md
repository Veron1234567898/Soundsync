# Render Deployment Guide for Soundboard Application

## Why Render?

Render is perfect for your soundboard app because it supports:
- ✅ WebSocket connections (for voice chat)
- ✅ File uploads and storage
- ✅ PostgreSQL databases
- ✅ Real-time features
- ✅ Simple deployment from Git

## Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **Git Repository**: Push your code to GitHub, GitLab, or Bitbucket
3. **Database**: Set up PostgreSQL database (Render provides free tier)

## Deployment Steps

### Step 1: Prepare Your Repository

Your code is already configured with:
- ✅ `render.yaml` - Render service configuration
- ✅ Correct build and start scripts in `package.json`
- ✅ Environment variable support

### Step 2: Create Render Services

#### Option A: Blueprint Deployment (Recommended)
1. Go to [render.com/dashboard](https://render.com/dashboard)
2. Click "New" → "Blueprint"
3. Connect your Git repository
4. Render will automatically detect the `render.yaml` file
5. Click "Apply" to create all services

#### Option B: Manual Service Creation
1. **Create Web Service**:
   - Go to Render Dashboard
   - Click "New" → "Web Service"
   - Connect your Git repository
   - Configure settings:
     - **Name**: `soundboard-app`
     - **Environment**: `Node`
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm start`
     - **Plan**: Free (or Starter for better performance)

2. **Create Database** (if needed):
   - Click "New" → "PostgreSQL"
   - **Name**: `soundboard-db`
   - **Plan**: Free (1GB storage)
   - Copy the database URL for environment variables

### Step 3: Configure Environment Variables

In your Web Service settings, add:

```bash
# Required
NODE_ENV=production
PORT=10000

# Database (get from your PostgreSQL service)
DATABASE_URL=postgresql://username:password@host:port/database

# Optional - File Upload Settings
UPLOAD_MAX_SIZE=50MB
MAX_FILE_COUNT=10

# Optional - Session Configuration
SESSION_SECRET=your-random-secret-key
```

### Step 4: Deploy

1. **Automatic Deployment**:
   - Render auto-deploys when you push to your main branch
   - Monitor deployment logs in the dashboard

2. **Manual Deployment**:
   - Click "Deploy latest commit" in your service dashboard

## Configuration Files Created

### render.yaml
```yaml
services:
  - type: web
    name: soundboard-app
    env: node
    plan: free
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
```

## Important Settings

### Build Configuration
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Node Version**: Render auto-detects from your package.json

### Networking
- **Port**: 10000 (Render default)
- **Health Check**: Automatic HTTP health checks
- **HTTPS**: Automatically provided with SSL certificate

### File Storage
- **Persistent Disk**: Available on paid plans
- **Temporary Storage**: Available on free tier (resets on deployment)

## Database Setup

### Option 1: Render PostgreSQL (Recommended)
1. Create PostgreSQL service in Render
2. Copy the connection URL
3. Add as `DATABASE_URL` environment variable

### Option 2: External Database
- Neon Database (free PostgreSQL)
- Supabase (free PostgreSQL with features)
- PlanetScale (MySQL alternative)

## Domain Configuration

### Free Domain
- Render provides: `your-app-name.onrender.com`
- Automatically configured with SSL

### Custom Domain
1. Go to service settings → "Custom Domains"
2. Add your domain
3. Configure DNS records as instructed
4. SSL certificate auto-generated

## Monitoring and Logs

### Real-time Logs
- View in Render Dashboard
- Live stream during deployment and runtime

### Metrics
- CPU and memory usage
- Request count and response times
- Error rates

### Health Checks
- Automatic HTTP health checks
- Service restart on failures

## Cost Structure

### Free Tier
- 512MB RAM
- Shared CPU
- 750 hours/month (sleeps after 15min inactivity)
- Free PostgreSQL (1GB storage)

### Starter Plan ($7/month)
- 512MB RAM
- No sleep mode
- Priority support
- Better performance

### Pro Plans
- More resources available
- Persistent disk storage
- Advanced features

## Troubleshooting

### Common Issues

1. **Build Failures**:
   ```bash
   # Check logs for specific errors
   # Verify package.json scripts
   # Ensure Node.js version compatibility
   ```

2. **Database Connection**:
   ```bash
   # Verify DATABASE_URL format
   # Check database service status
   # Test connection in logs
   ```

3. **WebSocket Issues**:
   ```bash
   # Render fully supports WebSockets
   # No additional configuration needed
   # Check client connection URLs
   ```

4. **File Upload Problems**:
   ```bash
   # Check file size limits
   # Verify upload directory permissions
   # Monitor disk usage
   ```

### Performance Optimization

1. **Enable Caching**:
   - Add cache headers for static assets
   - Use CDN for better global performance

2. **Database Optimization**:
   - Add indexes for frequently queried data
   - Use connection pooling

3. **Memory Management**:
   - Monitor memory usage in dashboard
   - Optimize code for memory efficiency

## Deployment Checklist

- [ ] Repository connected to Render
- [ ] `render.yaml` committed to repository
- [ ] Environment variables configured
- [ ] Database created and connected
- [ ] Build completes successfully
- [ ] Application starts without errors
- [ ] WebSocket connections working
- [ ] File uploads functioning
- [ ] Voice chat features operational

## Support and Resources

- **Documentation**: [render.com/docs](https://render.com/docs)
- **Community**: [community.render.com](https://community.render.com)
- **Status**: [status.render.com](https://status.render.com)
- **Support**: Available through dashboard

Your soundboard application is perfectly suited for Render deployment with full WebSocket support for voice chat!