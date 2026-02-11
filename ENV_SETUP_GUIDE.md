# Environment Variables Setup Guide

This guide shows you how to securely set up your environment variables for the Snowflake Member Lookup API.

## 🔒 Security First

✅ Your `.env` file is **already gitignored** - it will never be committed
✅ Only `.env.example` (with empty values) is in the repo
✅ Each developer has their own `.env` file locally

## 📝 Setup Instructions

### 1. Your `.env` File Already Exists

When you ran `cp .env.example .env`, it created your private environment file.

**Location:** `/Users/gcohen/dev/formbricks/.env`

### 2. Add Your Snowflake Credentials

Open `.env` and find the section:

```bash
#############################
#  MEMBER LOOKUP API        #
#############################

# API key for member lookup endpoint (generate with: openssl rand -base64 32)
MEMBER_LOOKUP_API_KEY=

# Snowflake connection (required if using member lookup API)
SNOWFLAKE_ACCOUNT=
SNOWFLAKE_USERNAME=
SNOWFLAKE_PASSWORD=
SNOWFLAKE_DATABASE=
SNOWFLAKE_SCHEMA=
SNOWFLAKE_WAREHOUSE=
```

### 3. Fill In Your Values

```bash
# Generate a secure API key
MEMBER_LOOKUP_API_KEY=t2siNqEpykFKXIAemOyFU/+Dp9cb7Ng50WfjGYIYcII=

# Your Snowflake connection details
SNOWFLAKE_ACCOUNT=xy12345.us-east-1.snowflakecomputing.com
SNOWFLAKE_USERNAME=formbricks_user
SNOWFLAKE_PASSWORD=your-secure-password-here
SNOWFLAKE_DATABASE=MEMBERS_DB
SNOWFLAKE_SCHEMA=PUBLIC
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
```

### 4. Get Your Snowflake Connection Details

#### Finding Your Snowflake Account

1. Log into Snowflake web UI
2. Look at the URL in your browser:
   - Format: `https://app.snowflake.com/REGION/ACCOUNT/...`
   - Your account: `ACCOUNT.REGION.snowflakecomputing.com`

**Examples:**
- URL: `https://app.snowflake.com/us-east-1/abc12345/`
- Account: `abc12345.us-east-1.snowflakecomputing.com`

#### Finding Your Database & Schema

Run this in Snowflake:
```sql
-- See your current context
SELECT CURRENT_DATABASE(), CURRENT_SCHEMA();

-- List all databases you have access to
SHOW DATABASES;

-- List schemas in a database
SHOW SCHEMAS IN DATABASE your_database;
```

#### Finding Your Warehouse

```sql
-- List available warehouses
SHOW WAREHOUSES;

-- Check current warehouse
SELECT CURRENT_WAREHOUSE();
```

### 5. Create a Dedicated Snowflake User (Recommended)

For security, create a dedicated user for Formbricks:

```sql
-- Create role
CREATE ROLE formbricks_role;

-- Grant database access
GRANT USAGE ON DATABASE your_database TO ROLE formbricks_role;
GRANT USAGE ON SCHEMA your_database.public TO ROLE formbricks_role;

-- Grant select on members table
GRANT SELECT ON TABLE your_database.public.members TO ROLE formbricks_role;

-- Grant warehouse usage
GRANT USAGE ON WAREHOUSE compute_wh TO ROLE formbricks_role;

-- Create user
CREATE USER formbricks_user
  PASSWORD = 'your-secure-password'
  DEFAULT_ROLE = formbricks_role
  DEFAULT_WAREHOUSE = compute_wh;

-- Assign role to user
GRANT ROLE formbricks_role TO USER formbricks_user;
```

## 🧪 Test Your Configuration

### Test 1: Verify Environment Variables Load

```bash
# In your Formbricks directory
node -e "require('dotenv').config(); console.log('API Key:', process.env.MEMBER_LOOKUP_API_KEY ? '✅ Set' : '❌ Missing'); console.log('Snowflake Account:', process.env.SNOWFLAKE_ACCOUNT ? '✅ Set' : '❌ Missing');"
```

### Test 2: Test Snowflake Connection

Create a test script: `test-snowflake.js`

```javascript
require('dotenv').config();
const snowflake = require('snowflake-sdk');

const connection = snowflake.createConnection({
  account: process.env.SNOWFLAKE_ACCOUNT,
  username: process.env.SNOWFLAKE_USERNAME,
  password: process.env.SNOWFLAKE_PASSWORD,
  database: process.env.SNOWFLAKE_DATABASE,
  schema: process.env.SNOWFLAKE_SCHEMA,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE,
});

connection.connect((err) => {
  if (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }

  console.log('✅ Connected to Snowflake!');

  connection.execute({
    sqlText: 'SELECT CURRENT_VERSION() as version',
    complete: (err, stmt, rows) => {
      if (err) {
        console.error('❌ Query failed:', err.message);
      } else {
        console.log('✅ Snowflake version:', rows[0].VERSION);
      }
      connection.destroy();
    }
  });
});
```

Run it:
```bash
node test-snowflake.js
```

### Test 3: Test the API Endpoint

```bash
# Start your Formbricks server
pnpm dev

# In another terminal, test the API
curl -X GET \
  'http://localhost:3000/api/member-lookup?recordNumber=TEST123' \
  -H "X-API-Key: ${MEMBER_LOOKUP_API_KEY}"
```

## 🚨 Security Best Practices

### ✅ DO:
- Keep `.env` file local only (it's gitignored)
- Use strong, unique passwords
- Create dedicated Snowflake user with minimal permissions
- Rotate API keys regularly
- Use different credentials for dev/staging/production
- Store production secrets in a secrets manager (AWS Secrets Manager, 1Password, etc.)

### ❌ DON'T:
- Never commit `.env` to git
- Never share your `.env` file via Slack/email
- Never use production credentials in development
- Never hardcode secrets in code
- Never push API keys to public repos

## 🔐 Double-Check Git Safety

Verify your secrets won't be committed:

```bash
# Check git status - .env should NOT appear
git status

# Check ignored files - .env SHOULD appear here
git status --ignored | grep .env

# Try to add .env (should fail or be ignored)
git add .env
git status  # Should show nothing staged

# If .env appears as staged, reset it
git reset HEAD .env
```

## 🌍 Team Collaboration

When working with a team:

### For New Team Members:

1. **Clone the repo** - They get `.env.example`
2. **Copy to `.env`**: `cp .env.example .env`
3. **Get credentials** from your secrets manager or team lead
4. **Fill in their `.env`** file
5. **Never commit `.env`** - it stays local

### Sharing Credentials Securely:

- **1Password** - Create a shared vault for team credentials
- **AWS Secrets Manager** - Store and rotate secrets automatically
- **HashiCorp Vault** - Enterprise secret management
- **Encrypted communication** - Use Signal, not Slack/Email

### Example 1Password Setup:

```bash
# Install 1Password CLI
brew install --cask 1password-cli

# Login
op signin

# Store Snowflake password
op item create \
  --category=login \
  --title="Formbricks Snowflake" \
  --vault="Team" \
  "username=formbricks_user" \
  "password=your-secure-password"

# Retrieve in scripts
SNOWFLAKE_PASSWORD=$(op item get "Formbricks Snowflake" --fields password)
```

## 📋 Environment Variables Checklist

Copy this checklist when setting up:

```bash
# Core Formbricks (you may already have these)
[ ] WEBAPP_URL
[ ] NEXTAUTH_URL
[ ] NEXTAUTH_SECRET
[ ] ENCRYPTION_KEY
[ ] CRON_SECRET
[ ] DATABASE_URL

# Member Lookup API (new)
[ ] MEMBER_LOOKUP_API_KEY (generate with: openssl rand -base64 32)
[ ] SNOWFLAKE_ACCOUNT (format: account.region.snowflakecomputing.com)
[ ] SNOWFLAKE_USERNAME (your Snowflake username)
[ ] SNOWFLAKE_PASSWORD (your Snowflake password)
[ ] SNOWFLAKE_DATABASE (database name)
[ ] SNOWFLAKE_SCHEMA (usually 'PUBLIC')
[ ] SNOWFLAKE_WAREHOUSE (warehouse name)
```

## 🔄 Production Deployment

When deploying to production (Vercel, Render, etc.):

### Vercel:

```bash
# Set environment variables via CLI
vercel env add MEMBER_LOOKUP_API_KEY production
vercel env add SNOWFLAKE_ACCOUNT production
vercel env add SNOWFLAKE_USERNAME production
vercel env add SNOWFLAKE_PASSWORD production
vercel env add SNOWFLAKE_DATABASE production
vercel env add SNOWFLAKE_SCHEMA production
vercel env add SNOWFLAKE_WAREHOUSE production
```

Or via Vercel Dashboard:
1. Go to Project Settings
2. Click "Environment Variables"
3. Add each variable for Production/Preview/Development

### Railway/Render:

Add variables in their dashboard:
- Railway: Settings → Variables
- Render: Environment → Environment Variables

### Docker:

```bash
# Use .env file
docker run --env-file .env your-image

# Or pass individually
docker run \
  -e MEMBER_LOOKUP_API_KEY=xxx \
  -e SNOWFLAKE_ACCOUNT=xxx \
  your-image
```

## 🆘 Troubleshooting

### "Connection failed"
- Verify Snowflake account URL format
- Check username/password are correct
- Ensure warehouse is running (not suspended)
- Check network access (VPN, firewall)

### "Invalid API key"
- Ensure `MEMBER_LOOKUP_API_KEY` is set in `.env`
- Restart your dev server after changing `.env`
- Check for typos in the API key

### "Database not found"
- Run `SHOW DATABASES;` in Snowflake to see available databases
- Verify you have access to the database
- Check database name spelling (case-sensitive)

### "Warehouse not found"
- Run `SHOW WAREHOUSES;` in Snowflake
- Ensure warehouse is not suspended
- Check warehouse name spelling

## 📚 Additional Resources

- [Snowflake Connection Parameters](https://docs.snowflake.com/en/user-guide/nodejs-driver-use.html#connection-parameters)
- [Snowflake Security Best Practices](https://docs.snowflake.com/en/user-guide/security-access-control.html)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)

## 💡 Pro Tips

1. **Use different accounts per environment:**
   ```bash
   # .env.development
   SNOWFLAKE_ACCOUNT=dev-account.snowflakecomputing.com

   # .env.production
   SNOWFLAKE_ACCOUNT=prod-account.snowflakecomputing.com
   ```

2. **Set up read-only replicas:**
   - Use a separate read-only database for surveys
   - Prevents any accidental writes from Formbricks

3. **Monitor API usage:**
   - Track API calls in Snowflake
   - Set up alerts for unusual activity
   - Use Snowflake's query history to audit access

4. **Rotate credentials regularly:**
   ```sql
   -- Change password every 90 days
   ALTER USER formbricks_user SET PASSWORD = 'new-secure-password';
   ```

---

**Remember:** Your `.env` file is gitignored and will never be committed to the public repo! 🔒
