# Formbricks Deployment Guide - Azure VM

Complete guide for deploying custom Formbricks builds to the Azure VM (nan01).

## Overview

**Fork:** `github.com/ASLA1899/formbricks`
**Branch:** `feature/dropdown-display-option`
**Production URL:** https://surveys.asla.org
**VM Location:** `/opt/formbricks/`

### Why Build Locally?

The Azure VM (8GB RAM + 4GB swap) cannot build Formbricks Docker images. Next.js builds require 8-10GB+ memory and cause OOM kills on the VM.

**Solution:** Build on your Mac, transfer the image to the VM.

## Prerequisites

- Docker with buildx support
- SSH access to Azure VM
- Build secrets configured (`.secrets/` directory)

### Build Secrets Setup

Create secrets directory with required files:

```bash
cd /Users/gcohen/dev/formbricks
mkdir -p .secrets

# Add your secrets (get from 1Password or existing .env)
echo "postgresql://user:pass@host:5432/db" > .secrets/database_url
echo "your-32-char-encryption-key-here" > .secrets/encryption_key
echo "redis://host:6379" > .secrets/redis_url
echo "" > .secrets/sentry_auth_token  # Optional
```

## Standard Deployment Process

### Step 1: Build Docker Image Locally

```bash
cd /Users/gcohen/dev/formbricks

# Make sure you're on the right branch
git checkout feature/dropdown-display-option
git pull

# Build for linux/amd64 (VM architecture)
docker buildx build \
  --platform linux/amd64 \
  --secret id=database_url,src=.secrets/database_url \
  --secret id=encryption_key,src=.secrets/encryption_key \
  --secret id=redis_url,src=.secrets/redis_url \
  --secret id=sentry_auth_token,src=.secrets/sentry_auth_token \
  -t formbricks-dropdown:amd64 \
  -f apps/web/Dockerfile \
  --load \
  .
```

**Build time:** ~10-15 minutes on M-series Mac

**Troubleshooting:**
- If build fails with TypeScript errors, rebase on upstream
- Sentry auth errors are non-fatal (source maps won't upload but build completes)

### Step 2: Transfer and Deploy to VM

**One-liner deployment:**

```bash
docker save formbricks-dropdown:amd64 | gzip | \
  ssh -i ~/.ssh/id_ed25519_workgh -p 2222 gregcohen@20.185.219.8 \
  "gunzip | docker load && \
   docker tag formbricks-dropdown:amd64 formbricks-local:dropdown-fix-v2-amd64 && \
   cd /opt/formbricks && \
   docker compose down formbricks && \
   docker compose up -d formbricks"
```

**What this does:**
1. Saves and compresses the image (~500MB)
2. Transfers via SSH
3. Loads into Docker on VM
4. Tags with the correct name expected by docker-compose.yml
5. Restarts Formbricks container

### Step 3: Apply Database Schema Changes (If Needed)

If your changes include Prisma schema updates:

```bash
ssh -i ~/.ssh/id_ed25519_workgh -p 2222 gregcohen@20.185.219.8 \
  "cd /opt/formbricks && \
   docker compose exec formbricks sh -c 'cd packages/database && npx prisma db push --skip-generate --accept-data-loss'"
```

**Note:** We use `prisma db push` instead of `migrate deploy` because this fork doesn't maintain migration files.

### Step 4: Verify Deployment

```bash
# Check container status
ssh -i ~/.ssh/id_ed25519_workgh -p 2222 gregcohen@20.185.219.8 \
  "docker ps | grep formbricks"

# Check logs (should see "Ready in Xms")
ssh -i ~/.ssh/id_ed25519_workgh -p 2222 gregcohen@20.185.219.8 \
  "docker logs formbricks --tail 50"

# Test HTTP response
curl -s -o /dev/null -w "%{http_code}" https://surveys.asla.org/
# Should return: 200
```

## Important Notes

### Docker Image Naming

The VM's `docker-compose.yml` expects the image to be named:
```
formbricks-local:dropdown-fix-v2-amd64
```

**Always tag your image** with this name after loading it on the VM:
```bash
docker tag formbricks-dropdown:amd64 formbricks-local:dropdown-fix-v2-amd64
```

### Cache Issues

If you make code changes but the deployed container doesn't reflect them:

```bash
# Rebuild with --no-cache
docker buildx build --no-cache \
  --platform linux/amd64 \
  --secret id=database_url,src=.secrets/database_url \
  --secret id=encryption_key,src=.secrets/encryption_key \
  --secret id=redis_url,src=.secrets/redis_url \
  --secret id=sentry_auth_token,src=.secrets/sentry_auth_token \
  -t formbricks-dropdown:amd64 \
  -f apps/web/Dockerfile \
  --load \
  .
```

### Database Migrations

This fork uses direct schema pushes instead of migration files:

```bash
# Check what changes will be applied
npx prisma db push --help

# Apply schema (use inside container)
docker compose exec formbricks sh -c 'cd packages/database && npx prisma db push --skip-generate'
```

**To check if table exists:**
```bash
ssh -i ~/.ssh/id_ed25519_workgh -p 2222 gregcohen@20.185.219.8 \
  "cd /opt/formbricks && \
   docker compose exec postgres psql -U formbricks -d formbricks -c '\dt'"
```

## VM Configuration

### File Structure

```
/opt/formbricks/
├── docker-compose.yml      # Service definitions
├── .env                    # Environment variables (DATABASE_URL, secrets, etc.)
└── uploads/               # Persistent user uploads
```

### docker-compose.yml Service

```yaml
services:
  formbricks:
    image: formbricks-local:dropdown-fix-v2-amd64
    container_name: formbricks
    restart: unless-stopped
    depends_on:
      - postgres
      - redis
      - minio
    environment:
      WEBAPP_URL: https://surveys.asla.org
      DATABASE_URL: postgresql://formbricks:${POSTGRES_PASSWORD}@postgres:5432/formbricks
      # ... other env vars
```

### Quick Fixes

**Container won't start:**
```bash
# Check logs
ssh -i ~/.ssh/id_ed25519_workgh -p 2222 gregcohen@20.185.219.8 \
  "docker logs formbricks"

# Common issues:
# - Database connection (check DATABASE_URL in .env)
# - Missing environment variables
# - Port conflicts (unlikely with Caddy reverse proxy)
```

**Rollback to previous version:**
```bash
# List available images
ssh -i ~/.ssh/id_ed25519_workgh -p 2222 gregcohen@20.185.219.8 \
  "docker images | grep formbricks"

# Update docker-compose.yml to use previous image, then:
ssh -i ~/.ssh/id_ed25519_workgh -p 2222 gregcohen@20.185.219.8 \
  "cd /opt/formbricks && docker compose up -d formbricks"
```

**Clean up old images:**
```bash
ssh -i ~/.ssh/id_ed25519_workgh -p 2222 gregcohen@20.185.219.8 \
  "docker image prune -a"
```

## Updating the Fork

When upstream Formbricks releases updates:

```bash
cd /Users/gcohen/dev/formbricks

# Add upstream if not already added
git remote add upstream https://github.com/formbricks/formbricks.git

# Fetch and rebase
git fetch upstream
git checkout feature/dropdown-display-option
git rebase upstream/main

# Resolve conflicts if any
# Then force push (careful!)
git push origin feature/dropdown-display-option --force-with-lease

# Rebuild and deploy
```

## Complete Deployment Checklist

Use this for deployments:

```
Pre-deployment:
[ ] Code committed and pushed to origin
[ ] On correct branch (feature/dropdown-display-option)
[ ] Build secrets configured in .secrets/

Build:
[ ] Docker buildx build completed successfully
[ ] Image tagged: formbricks-dropdown:amd64

Deploy:
[ ] Image transferred to VM
[ ] Image tagged: formbricks-local:dropdown-fix-v2-amd64
[ ] Container restarted

Post-deployment:
[ ] Database schema applied (if schema changes)
[ ] Container running (docker ps shows formbricks)
[ ] Logs show "Ready in Xms"
[ ] Site accessible: https://surveys.asla.org/ returns 200
[ ] Feature tested in browser

Cleanup:
[ ] Old local images removed (docker image prune)
[ ] Deployment documented in changelog/notes
```

## Monitoring & Health Checks

**Container health:**
```bash
ssh -i ~/.ssh/id_ed25519_workgh -p 2222 gregcohen@20.185.219.8 \
  "docker ps --filter name=formbricks --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
```

**Database connections:**
```bash
ssh -i ~/.ssh/id_ed25519_workgh -p 2222 gregcohen@20.185.219.8 \
  "cd /opt/formbricks && docker compose exec postgres psql -U formbricks -d formbricks -c 'SELECT count(*) FROM pg_stat_activity;'"
```

**Disk space:**
```bash
ssh -i ~/.ssh/id_ed25519_workgh -p 2222 gregcohen@20.185.219.8 \
  "df -h /var/lib/docker"
```

## Troubleshooting

### Build Issues

**Problem:** TypeScript compilation errors
**Solution:** Rebase on upstream main, resolve conflicts

**Problem:** Out of memory during build
**Solution:** Ensure you're building locally (Mac), not on VM

**Problem:** "Failed to load secrets"
**Solution:** Check `.secrets/` directory exists with all required files

### Deployment Issues

**Problem:** Container shows old code after deployment
**Solution:** Rebuild with `--no-cache` flag

**Problem:** Database table doesn't exist
**Solution:** Run `prisma db push` after deploying

**Problem:** Image tag mismatch
**Solution:** Ensure image is tagged `formbricks-local:dropdown-fix-v2-amd64`

### Runtime Issues

**Problem:** Container crashes/restarts constantly
**Solution:** Check logs for errors, verify DATABASE_URL is correct

**Problem:** "Cannot connect to database"
**Solution:** Verify postgres container is running, check credentials in .env

**Problem:** UI loads but surveys don't work
**Solution:** Check browser console for errors, verify API endpoints

## See Also

- [Azure VM Operations](../azure_vm/AZURE_VM_OPERATIONS_AND_RUNTIME.md) - Full VM documentation
- [DEPLOYMENT_SAVED_OPTION_LISTS.md](./DEPLOYMENT_SAVED_OPTION_LISTS.md) - Feature-specific deployment notes
- [VM Docker Compose](ssh://gregcohen@20.185.219.8:2222//opt/formbricks/docker-compose.yml) - Live config on VM

## Quick Reference Commands

```bash
# Full deployment (one command)
cd /Users/gcohen/dev/formbricks && \
docker buildx build --platform linux/amd64 \
  --secret id=database_url,src=.secrets/database_url \
  --secret id=encryption_key,src=.secrets/encryption_key \
  --secret id=redis_url,src=.secrets/redis_url \
  --secret id=sentry_auth_token,src=.secrets/sentry_auth_token \
  -t formbricks-dropdown:amd64 \
  -f apps/web/Dockerfile --load . && \
docker save formbricks-dropdown:amd64 | gzip | \
  ssh -i ~/.ssh/id_ed25519_workgh -p 2222 gregcohen@20.185.219.8 \
  "gunzip | docker load && \
   docker tag formbricks-dropdown:amd64 formbricks-local:dropdown-fix-v2-amd64 && \
   cd /opt/formbricks && \
   docker compose down formbricks && \
   docker compose up -d formbricks"

# Quick restart (no rebuild)
ssh -i ~/.ssh/id_ed25519_workgh -p 2222 gregcohen@20.185.219.8 \
  "cd /opt/formbricks && docker compose restart formbricks"

# View logs
ssh -i ~/.ssh/id_ed25519_workgh -p 2222 gregcohen@20.185.219.8 \
  "docker logs formbricks -f"

# Check database tables
ssh -i ~/.ssh/id_ed25519_workgh -p 2222 gregcohen@20.185.219.8 \
  "cd /opt/formbricks && docker compose exec postgres psql -U formbricks -d formbricks -c '\dt'"
```

---

**Last Updated:** 2026-02-09
**Maintainer:** Greg Cohen
**VM:** nan01 (20.185.219.8:2222)
