# Creating a PostgreSQL Database on Render

## Step-by-Step Database Creation

### Method 1: Create Database First (Recommended)

1. **Go to Render Dashboard**
   - Visit [render.com/dashboard](https://render.com/dashboard)
   - Log in to your account

2. **Create New Database**
   - Click the "New +" button
   - Select "PostgreSQL" from the dropdown

3. **Configure Database Settings**
   ```
   Name: soundboard-db
   Database: soundboard_production
   User: soundboard_user
   Region: Oregon (US West) or closest to you
   PostgreSQL Version: 15 (latest)
   Plan: Free (for testing) or Starter ($7/month for production)
   ```

4. **Database Creation**
   - Click "Create Database"
   - Wait for provisioning (usually 1-2 minutes)
   - Database will show as "Available" when ready

5. **Get Connection Details**
   - Click on your database name
   - Go to "Connect" tab
   - Copy the "External Database URL"
   - Example format: `postgresql://username:password@host:port/database`

### Method 2: Blueprint Deployment (Automatic)

Add to your `render.yaml`:

```yaml
databases:
  - name: soundboard-db
    databaseName: soundboard_production
    user: soundboard_user
    plan: free

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
      - key: DATABASE_URL
        fromDatabase:
          name: soundboard-db
          property: connectionString
```

## Database Plans and Pricing

### Free Plan
- **Storage**: 1 GB
- **Connections**: 97 concurrent
- **Backup**: None
- **Cost**: $0/month
- **Good for**: Development and testing

### Starter Plan ($7/month)
- **Storage**: 1 GB
- **Connections**: 97 concurrent  
- **Backup**: 7 days retention
- **Cost**: $7/month
- **Good for**: Small production apps

### Standard Plan ($20/month)
- **Storage**: 10 GB
- **Connections**: 97 concurrent
- **Backup**: 7 days retention
- **High availability**: Included
- **Cost**: $20/month
- **Good for**: Production applications

## Connecting Your App to Database

### 1. Set Environment Variable

In your web service settings:
- Go to "Environment" tab
- Add new environment variable:
  ```
  Key: DATABASE_URL
  Value: [paste your database connection string]
  ```

### 2. Connection String Format

```
postgresql://username:password@hostname:port/database
```

Example:
```
postgresql://soundboard_user:abc123@dpg-example.oregon-postgres.render.com:5432/soundboard_production
```

### 3. Test Connection

Your app should automatically connect using the DATABASE_URL environment variable.

## Database Management

### Connecting with psql
```bash
psql postgresql://username:password@hostname:port/database
```

### Using Database Clients
- **pgAdmin**: Web-based PostgreSQL administration
- **DBeaver**: Free universal database tool
- **TablePlus**: Modern database management tool

### Render Dashboard Features
- **Logs**: View database connection logs
- **Metrics**: Monitor database performance
- **Backups**: Manage automated backups (paid plans)
- **Shell**: Access database shell directly

## Security Best Practices

### 1. Environment Variables
- Never commit database URLs to code
- Use Render's environment variable system
- Rotate passwords regularly

### 2. Connection Limits
- Monitor concurrent connections
- Implement connection pooling if needed
- Close unused connections

### 3. Network Security
- Database is private by default
- Only accessible from your Render services
- SSL/TLS encryption enabled

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   ```
   Error: connect ETIMEDOUT
   ```
   - Check DATABASE_URL format
   - Verify database is "Available"
   - Try restarting web service

2. **Authentication Failed**
   ```
   Error: password authentication failed
   ```
   - Verify username/password in connection string
   - Check for special characters (URL encode if needed)

3. **Database Not Found**
   ```
   Error: database "xyz" does not exist
   ```
   - Verify database name in connection string
   - Check database was created successfully

4. **Too Many Connections**
   ```
   Error: sorry, too many clients already
   ```
   - Implement connection pooling
   - Check for connection leaks in code
   - Consider upgrading plan

### Getting Help

- **Render Docs**: [render.com/docs/databases](https://render.com/docs/databases)
- **Community**: [community.render.com](https://community.render.com)
- **Support**: Available through dashboard

## Migration from Development

If you have a local/development database:

1. **Export Data**
   ```bash
   pg_dump your_local_db > backup.sql
   ```

2. **Import to Render**
   ```bash
   psql $DATABASE_URL < backup.sql
   ```

3. **Update Environment Variables**
   - Replace local DATABASE_URL
   - Test connection

Your Render PostgreSQL database will be ready for your soundboard application!