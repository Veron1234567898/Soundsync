# Vercel Deployment Guide for Soundboard Application

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Git Repository**: Push your code to GitHub, GitLab, or Bitbucket
3. **Environment Variables**: Prepare your database and API credentials

## Recommended Vercel Settings

### Project Configuration

- **Framework Preset**: Other
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Environment Variables Required

Set these in your Vercel dashboard under Project Settings → Environment Variables:

```bash
# Database (Required for full functionality)
DATABASE_URL=your_postgresql_connection_string

# Node Environment
NODE_ENV=production

# Optional: If using external services
UPLOAD_MAX_SIZE=50MB
```

### Build Settings

The included `vercel.json` configures:
- Static file serving from `dist/` folder
- API routes handling via serverless functions
- CORS headers for API endpoints
- 30-second function timeout

## Deployment Steps

### Option 1: Git Integration (Recommended)

1. **Connect Repository**:
   - Go to Vercel Dashboard
   - Click "New Project"
   - Import your Git repository

2. **Configure Settings**:
   - Framework Preset: "Other"
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. **Set Environment Variables**:
   - Add `DATABASE_URL` and other required variables
   - Set `NODE_ENV=production`

4. **Deploy**:
   - Click "Deploy"
   - Vercel will build and deploy automatically

### Option 2: Vercel CLI

1. **Install CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   # Preview deployment
   vercel
   
   # Production deployment
   vercel --prod
   ```

## Important Limitations for Vercel

### Current Implementation Challenges

1. **WebSocket Support**: 
   - Vercel doesn't support persistent WebSocket connections
   - Voice chat and real-time features won't work without modifications
   - Consider using Vercel's WebSocket integration or external service

2. **File Uploads**:
   - Serverless functions have size and execution time limits
   - Audio file uploads may need external storage (AWS S3, Cloudinary)

3. **In-Memory Storage**:
   - Your current in-memory storage will reset on each function execution
   - Database storage is required for persistence

### Recommended Modifications for Production

1. **Replace WebSocket Implementation**:
   - Use Vercel's real-time features
   - Or migrate to a service like Pusher/Ably
   - Or deploy WebSocket server separately

2. **File Storage**:
   - Integrate with cloud storage (AWS S3, Vercel Blob)
   - Update file upload endpoints

3. **Database**:
   - Ensure PostgreSQL database is configured
   - Update storage to use database instead of in-memory

## Alternative Deployment Options

If Vercel limitations are blocking your features:

### Railway (Recommended for WebSocket apps)
- Full WebSocket support
- Persistent storage
- Simple deployment from Git

### Render
- WebSocket support
- Free tier available
- Easy database integration

### Heroku
- Full featured hosting
- WebSocket support
- Add-ons ecosystem

## Testing Your Deployment

1. **Basic Functionality**:
   - Visit your Vercel URL
   - Test room creation/joining
   - Check API endpoints at `/api/health`

2. **Database Connection**:
   - Verify environment variables are set
   - Check application logs for database errors

3. **File Uploads**:
   - Test with small audio files first
   - Monitor function execution time

## Troubleshooting

### Common Issues

1. **Build Failures**:
   - Check Node.js version compatibility
   - Verify all dependencies are in `package.json`
   - Review build logs in Vercel dashboard

2. **Runtime Errors**:
   - Check function logs in Vercel dashboard
   - Verify environment variables
   - Test API endpoints individually

3. **CORS Issues**:
   - Verify `vercel.json` CORS configuration
   - Check API endpoint responses

### Getting Help

- Vercel Documentation: [vercel.com/docs](https://vercel.com/docs)
- Community Support: [vercel.com/community](https://vercel.com/community)
- Status Page: [vercel-status.com](https://vercel-status.com)

## Cost Considerations

- **Hobby Plan**: Free tier with usage limits
- **Pro Plan**: $20/month for production apps
- **Enterprise**: Custom pricing for larger applications

Monitor your usage in the Vercel dashboard to avoid unexpected charges.