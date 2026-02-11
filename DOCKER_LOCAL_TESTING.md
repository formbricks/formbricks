# Docker Local Testing Guide

Run Formbricks with your Snowflake member lookup API in Docker for local testing.

## 🚀 Quick Start (5 Steps)

### 1. Generate Required Secrets

```bash
# Generate all secrets at once
echo "NEXTAUTH_SECRET=$(openssl rand -hex 32)" > .env.docker
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env.docker
echo "CRON_SECRET=$(openssl rand -hex 32)" >> .env.docker
echo "MEMBER_LOOKUP_API_KEY=$(openssl rand -base64 32)" >> .env.docker
echo "" >> .env.docker
echo "# Add your Snowflake credentials below:" >> .env.docker
```

### 2. Add Your Snowflake Credentials

```bash
# Edit .env.docker
nano .env.docker
```

Add your Snowflake info:
```bash
SNOWFLAKE_ACCOUNT=your-account.region.snowflakecomputing.com
SNOWFLAKE_USERNAME=your_username
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_DATABASE=your_database
SNOWFLAKE_SCHEMA=PUBLIC
SNOWFLAKE_WAREHOUSE=your_warehouse
```

### 3. Build and Start

```bash
# Build the Docker image
docker-compose -f docker-compose.local.yml build

# Start all services
docker-compose --env-file .env.docker -f docker-compose.local.yml up
```

### 4. Initialize Database

```bash
# In another terminal, run migrations
docker-compose -f docker-compose.local.yml exec formbricks pnpm --filter=@formbricks/web db:migrate:deploy
```

### 5. Access Formbricks

- **App:** http://localhost:3000
- **MailHog (Email UI):** http://localhost:8025
- **MinIO (Storage UI):** http://localhost:9001 (user: minioadmin, pass: minioadmin)

## 📋 What's Included

### Services Running:

| Service | Port | Purpose |
|---------|------|---------|
| **Formbricks** | 3000 | Main application |
| **PostgreSQL** | 5432 | Database |
| **Valkey/Redis** | 6379 | Caching & queues |
| **MailHog** | 8025 | Email testing UI |
| **MailHog SMTP** | 1025 | Email server |
| **MinIO** | 9000 | S3-compatible storage |
| **MinIO Console** | 9001 | MinIO web UI |

### Features:

✅ **Snowflake Integration** - Your member lookup API
✅ **All Dependencies** - PostgreSQL, Redis, MinIO
✅ **Email Testing** - MailHog catches all emails
✅ **Hot Reload** - Query config mounted as volume
✅ **Health Checks** - All services monitored

## 🧪 Testing the Member Lookup API

### Test the API Directly:

```bash
# Get your API key from .env.docker
API_KEY=$(grep MEMBER_LOOKUP_API_KEY .env.docker | cut -d'=' -f2)

# Test member lookup
curl "http://localhost:3000/api/query/member-basic?recordNumber=12345" \
  -H "X-API-Key: $API_KEY"
```

### Test from Formbricks UI:

1. **Sign up:** http://localhost:3000/auth/signup
2. **Create a survey**
3. **Configure External Data Source:**
   ```json
   {
     "name": "Member Lookup",
     "apiUrl": "http://localhost:3000/api/query/member-basic",
     "method": "GET",
     "authType": "apiKey",
     "authToken": "YOUR_API_KEY",
     "authLocation": "header",
     "parameterMapping": {
       "recordNumber": "{{recordNumber}}"
     }
   }
   ```

## 🔧 Useful Commands

### View Logs:

```bash
# All services
docker-compose -f docker-compose.local.yml logs -f

# Just Formbricks
docker-compose -f docker-compose.local.yml logs -f formbricks

# Just database
docker-compose -f docker-compose.local.yml logs -f postgres
```

### Restart Services:

```bash
# Restart everything
docker-compose -f docker-compose.local.yml restart

# Restart just Formbricks
docker-compose -f docker-compose.local.yml restart formbricks
```

### Stop Services:

```bash
# Stop but keep data
docker-compose -f docker-compose.local.yml stop

# Stop and remove containers (keeps volumes/data)
docker-compose -f docker-compose.local.yml down

# Stop and REMOVE ALL DATA (clean start)
docker-compose -f docker-compose.local.yml down -v
```

### Rebuild After Code Changes:

```bash
# Rebuild and restart
docker-compose -f docker-compose.local.yml up --build -d
```

### Execute Commands Inside Container:

```bash
# Get a shell
docker-compose -f docker-compose.local.yml exec formbricks sh

# Run migrations
docker-compose -f docker-compose.local.yml exec formbricks pnpm --filter=@formbricks/web db:migrate:deploy

# Test Snowflake connection
docker-compose -f docker-compose.local.yml exec formbricks node test-snowflake-connection.js
```

## 🔄 Update Query Configuration

Since `query-config.json` is mounted as a volume, you can edit it live:

```bash
# Edit query config
nano apps/web/app/api/member-lookup/query-config.json

# Changes take effect within 60 seconds (config cache)
# Or restart Formbricks to apply immediately:
docker-compose -f docker-compose.local.yml restart formbricks
```

## 🗄️ Database Management

### Access PostgreSQL:

```bash
# Connect to database
docker-compose -f docker-compose.local.yml exec postgres psql -U postgres -d formbricks

# Run SQL queries
docker-compose -f docker-compose.local.yml exec postgres psql -U postgres -d formbricks -c "SELECT * FROM \"User\";"
```

### Backup Database:

```bash
# Backup
docker-compose -f docker-compose.local.yml exec postgres pg_dump -U postgres formbricks > formbricks_backup.sql

# Restore
cat formbricks_backup.sql | docker-compose -f docker-compose.local.yml exec -T postgres psql -U postgres formbricks
```

### Reset Database:

```bash
# Stop services
docker-compose -f docker-compose.local.yml down

# Remove database volume
docker volume rm formbricks_postgres_data

# Start fresh
docker-compose --env-file .env.docker -f docker-compose.local.yml up
```

## 🐛 Troubleshooting

### Issue: "Address already in use"

**Cause:** Port already occupied

**Solution:**
```bash
# Check what's using port 3000
lsof -i :3000

# Stop the process or change the port
# Edit docker-compose.local.yml and change "3000:3000" to "3001:3000"
```

### Issue: "Database connection failed"

**Check:**
```bash
# Check if PostgreSQL is healthy
docker-compose -f docker-compose.local.yml ps

# Check PostgreSQL logs
docker-compose -f docker-compose.local.yml logs postgres

# Wait for health check to pass
docker-compose -f docker-compose.local.yml exec postgres pg_isready -U postgres
```

### Issue: "Snowflake connection failed"

**Check:**
```bash
# Test Snowflake credentials
docker-compose -f docker-compose.local.yml exec formbricks node test-snowflake-connection.js

# Check environment variables are set
docker-compose -f docker-compose.local.yml exec formbricks env | grep SNOWFLAKE
```

### Issue: "Build failed"

**Solutions:**
```bash
# Clear Docker cache
docker system prune -a

# Rebuild without cache
docker-compose -f docker-compose.local.yml build --no-cache
```

### Issue: "Container keeps restarting"

**Check logs:**
```bash
docker-compose -f docker-compose.local.yml logs formbricks
```

**Common causes:**
- Missing environment variables
- Database not ready (wait for health checks)
- Port conflicts

## 🔒 Security Notes

### .env.docker Security:

```bash
# ✅ Verify .env.docker is gitignored
git check-ignore .env.docker
# Should output: .env.docker

# ❌ If not gitignored, add it:
echo ".env.docker" >> .gitignore
```

### Production Deployment:

**Don't use this setup in production!** This configuration is for **local testing only**.

For production:
- Use managed PostgreSQL (RDS, Cloud SQL, etc.)
- Use managed Redis (ElastiCache, Cloud Memorystore)
- Use proper secrets management (AWS Secrets Manager, HashiCorp Vault)
- Enable SSL/TLS
- Configure proper networking and firewalls
- Use Docker Swarm or Kubernetes for orchestration

## 📊 Health Checks

### Check Service Health:

```bash
# All services status
docker-compose -f docker-compose.local.yml ps

# Detailed health info
docker inspect formbricks_formbricks_1 | jq '.[0].State.Health'
```

### Manual Health Checks:

```bash
# Formbricks API
curl -f http://localhost:3000/api/health

# PostgreSQL
docker-compose -f docker-compose.local.yml exec postgres pg_isready -U postgres

# Valkey
docker-compose -f docker-compose.local.yml exec valkey valkey-cli ping

# MinIO
curl -f http://localhost:9000/minio/health/live
```

## 🎯 Development Workflow

### Typical workflow:

```bash
# 1. Start services
docker-compose --env-file .env.docker -f docker-compose.local.yml up -d

# 2. Watch logs
docker-compose -f docker-compose.local.yml logs -f formbricks

# 3. Make code changes
# (Edit query-config.json, add new queries, etc.)

# 4. Rebuild if needed
docker-compose -f docker-compose.local.yml up --build -d

# 5. Test changes
curl "http://localhost:3000/api/query/..." -H "X-API-Key: ..."

# 6. Stop when done
docker-compose -f docker-compose.local.yml down
```

## 📚 Additional Resources

- **Docker Compose Docs:** https://docs.docker.com/compose/
- **Formbricks Docs:** https://formbricks.com/docs
- **PostgreSQL in Docker:** https://hub.docker.com/_/postgres
- **MinIO Docs:** https://min.io/docs/minio/container/index.html

## 🎉 Summary

```bash
# Quick Start Commands:
# 1. Create env file with secrets
echo "NEXTAUTH_SECRET=$(openssl rand -hex 32)" > .env.docker
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env.docker
echo "CRON_SECRET=$(openssl rand -hex 32)" >> .env.docker
echo "MEMBER_LOOKUP_API_KEY=$(openssl rand -base64 32)" >> .env.docker

# 2. Add Snowflake credentials to .env.docker

# 3. Start everything
docker-compose --env-file .env.docker -f docker-compose.local.yml up

# 4. Access at http://localhost:3000
```

**Happy testing!** 🚀
