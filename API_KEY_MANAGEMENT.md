# API Key Management Guide

Complete guide for generating, managing, and securing API keys for the Snowflake member lookup API.

## 🔑 Quick Start

### Generate an API Key

```bash
# Generate a secure random key (32 bytes, base64 encoded)
openssl rand -base64 32
```

Example output:
```
DcB+9G6fFzIsrtjCGp0wUazNQH3M3h0o0AmaRrUIWTo=
```

### Add to Environment Variables

Edit `.env` file:

```bash
# Member Lookup API Key
MEMBER_LOOKUP_API_KEY=DcB+9G6fFzIsrtjCGp0wUazNQH3M3h0o0AmaRrUIWTo=
```

### Restart Your Server

```bash
# Stop current server (Ctrl+C)
pnpm dev
```

### Test API Key

```bash
curl -X GET \
  'http://localhost:3000/api/query/member-basic?recordNumber=12345' \
  -H 'X-API-Key: YOUR_API_KEY_HERE'
```

## 🎯 Using API Keys

### Method 1: Header (Recommended) ⭐

```bash
curl -X GET \
  'http://localhost:3000/api/query/member-basic?recordNumber=12345' \
  -H 'X-API-Key: DcB+9G6fFzIsrtjCGp0wUazNQH3M3h0o0AmaRrUIWTo='
```

**Pros:**
- ✅ Keys not visible in URL
- ✅ Not logged in access logs
- ✅ More secure
- ✅ Standard practice

### Method 2: Query Parameter

```bash
curl -X GET \
  'http://localhost:3000/api/query/member-basic?recordNumber=12345&api_key=YOUR_KEY'
```

**Pros:**
- ✅ Easy for testing
- ✅ Works in browser address bar

**Cons:**
- ⚠️ Visible in URL
- ⚠️ Logged in access logs
- ⚠️ Can be leaked in referrer headers

**Use header method in production!**

## 🔐 Security Best Practices

### ✅ DO:

1. **Generate Strong Keys**
   ```bash
   # Use OpenSSL for cryptographically secure keys
   openssl rand -base64 32

   # Or use node
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. **Store in Environment Variables**
   ```bash
   # .env file (gitignored)
   MEMBER_LOOKUP_API_KEY=your-key-here
   ```

3. **Use Different Keys per Environment**
   ```bash
   # Development
   MEMBER_LOOKUP_API_KEY=dev_key_abc123

   # Production
   MEMBER_LOOKUP_API_KEY=prod_key_xyz789
   ```

4. **Rotate Keys Regularly**
   - Every 90 days for production
   - Immediately if compromised
   - Keep old key active during transition

5. **Monitor API Usage**
   - Track requests per key
   - Set up alerts for unusual activity
   - Log failed authentication attempts

### ❌ DON'T:

1. **Never Commit Keys to Git**
   ```bash
   # ❌ WRONG - in code
   const API_KEY = "abc123";

   # ✅ RIGHT - from environment
   const API_KEY = process.env.MEMBER_LOOKUP_API_KEY;
   ```

2. **Never Share Keys in Plain Text**
   - ❌ Don't email keys
   - ❌ Don't send in Slack
   - ✅ Use secure password managers (1Password, LastPass)

3. **Never Use Weak Keys**
   ```bash
   # ❌ WEAK - predictable
   MEMBER_LOOKUP_API_KEY=123456
   MEMBER_LOOKUP_API_KEY=password

   # ✅ STRONG - cryptographically random
   MEMBER_LOOKUP_API_KEY=DcB+9G6fFzIsrtjCGp0wUazNQH3M3h0o0AmaRrUIWTo=
   ```

## 🔄 Key Rotation

### Step-by-Step Key Rotation

**1. Generate New Key**
```bash
NEW_KEY=$(openssl rand -base64 32)
echo "New key: $NEW_KEY"
```

**2. Update Environment Variable**
```bash
# Add to .env
MEMBER_LOOKUP_API_KEY=NEW_KEY_HERE
```

**3. Restart Server**
```bash
pnpm dev
```

**4. Update All Clients**
- Update Formbricks external data source configurations
- Update any scripts/automation
- Update documentation

**5. Verify New Key Works**
```bash
curl 'localhost:3000/api/query/member-basic?recordNumber=123' \
  -H 'X-API-Key: NEW_KEY_HERE'
```

**6. Deactivate Old Key**
- Once all clients updated, old key automatically invalid
- Monitor logs for any failed attempts with old key

## 🎭 Multiple API Keys (Advanced)

For different teams, services, or permission levels:

### Implementation:

Create `apps/web/app/api/member-lookup/api-keys.ts`:

```typescript
/**
 * API Key Management
 *
 * Supports multiple API keys with different permissions
 */

export interface ApiKeyConfig {
  key: string;
  name: string;
  permissions: string[];
  rateLimit?: number;
  expiresAt?: Date;
}

// Load from database or config file
export const API_KEYS: ApiKeyConfig[] = [
  {
    key: process.env.MEMBER_LOOKUP_API_KEY!,
    name: "Main API Key",
    permissions: ["read"],
    rateLimit: 100,
  },
  {
    key: process.env.FORMBRICKS_API_KEY!,
    name: "Formbricks Integration",
    permissions: ["read"],
    rateLimit: 500,
  },
  {
    key: process.env.ADMIN_API_KEY!,
    name: "Admin Access",
    permissions: ["read", "admin"],
    rateLimit: 1000,
  },
];

export function validateApiKey(key: string): ApiKeyConfig | null {
  const config = API_KEYS.find(k => k.key === key);

  if (!config) {
    return null;
  }

  // Check expiration
  if (config.expiresAt && new Date() > config.expiresAt) {
    console.warn(`Expired API key used: ${config.name}`);
    return null;
  }

  return config;
}

export function hasPermission(config: ApiKeyConfig, permission: string): boolean {
  return config.permissions.includes(permission);
}
```

### Update Route to Use Multiple Keys:

```typescript
// In route.ts
import { validateApiKey } from './api-keys';

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("X-API-Key");

  const keyConfig = validateApiKey(apiKey);
  if (!keyConfig) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  // Use keyConfig for rate limiting, permissions, etc.
  console.log(`Request from: ${keyConfig.name}`);

  // Apply custom rate limit
  const rateLimit = checkRateLimit(clientIp, keyConfig.rateLimit || 100);

  // ...rest of code
}
```

### Environment Variables:

```bash
# .env
MEMBER_LOOKUP_API_KEY=main_key_here
FORMBRICKS_API_KEY=formbricks_key_here
ADMIN_API_KEY=admin_key_here
```

## 📊 API Key Tracking

### Track Usage Per Key:

```typescript
// Usage tracking
const keyUsage = new Map<string, { count: number; lastUsed: Date }>();

function trackApiKeyUsage(keyConfig: ApiKeyConfig) {
  const stats = keyUsage.get(keyConfig.name) || { count: 0, lastUsed: new Date() };
  stats.count++;
  stats.lastUsed = new Date();
  keyUsage.set(keyConfig.name, stats);

  // Log to monitoring service
  console.log(`[API Key] ${keyConfig.name} - Total uses: ${stats.count}`);
}
```

### Get Usage Stats:

```bash
# Add endpoint to view stats
GET /api/admin/key-stats
```

```typescript
export async function GET(request: NextRequest) {
  const adminKey = request.headers.get("X-API-Key");

  if (adminKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    usage: Array.from(keyUsage.entries()).map(([name, stats]) => ({
      name,
      ...stats
    }))
  });
}
```

## 🔍 Testing & Validation

### Test API Key Authentication:

```bash
# 1. Test with valid key
curl 'localhost:3000/api/query/member-basic?recordNumber=123' \
  -H 'X-API-Key: YOUR_VALID_KEY' \
  -w "\nStatus: %{http_code}\n"
# Expected: Status: 200

# 2. Test with invalid key
curl 'localhost:3000/api/query/member-basic?recordNumber=123' \
  -H 'X-API-Key: invalid-key' \
  -w "\nStatus: %{http_code}\n"
# Expected: Status: 401

# 3. Test without key
curl 'localhost:3000/api/query/member-basic?recordNumber=123' \
  -w "\nStatus: %{http_code}\n"
# Expected: Status: 401

# 4. Test rate limiting (run 25 times)
for i in {1..25}; do
  curl 'localhost:3000/api/query/member-basic?recordNumber=123' \
    -H 'X-API-Key: YOUR_KEY' \
    -w " - Status: %{http_code}\n"
done
# First 20: Status 200
# After 20: Status 429 (rate limited)
```

## 🚀 Production Deployment

### Vercel:

```bash
# Set via CLI
vercel env add MEMBER_LOOKUP_API_KEY production

# Or via dashboard
# 1. Go to Project Settings
# 2. Environment Variables
# 3. Add MEMBER_LOOKUP_API_KEY
# 4. Select Production environment
```

### Railway/Render:

```bash
# Railway
railway variables set MEMBER_LOOKUP_API_KEY=your-key

# Render (via dashboard)
# Settings → Environment → Add Variable
```

### Docker:

```bash
# Pass via environment
docker run -e MEMBER_LOOKUP_API_KEY=your-key your-image

# Or use .env file
docker run --env-file .env your-image
```

### Kubernetes:

```yaml
# Create secret
apiVersion: v1
kind: Secret
metadata:
  name: api-keys
type: Opaque
stringData:
  member-lookup-api-key: "your-key-here"

---
# Use in deployment
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
      - name: formbricks
        env:
        - name: MEMBER_LOOKUP_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: member-lookup-api-key
```

## 🎯 Formbricks Configuration

### Configure External Data Source:

```json
{
  "name": "Member Lookup",
  "apiUrl": "https://your-domain.com/api/query/member-basic",
  "method": "GET",
  "authType": "apiKey",
  "authToken": "YOUR_API_KEY_HERE",
  "authLocation": "header",
  "customHeaders": {
    "X-API-Key": "YOUR_API_KEY_HERE"
  },
  "parameterMapping": {
    "recordNumber": "{{recordNumber}}"
  }
}
```

**Important:** Use the same API key you set in `MEMBER_LOOKUP_API_KEY`!

## 🆘 Troubleshooting

### "Unauthorized" Error

**Check:**
```bash
# 1. Verify key is set in .env
grep MEMBER_LOOKUP_API_KEY .env

# 2. Verify server restarted after adding key
# Stop and restart: pnpm dev

# 3. Test key is being sent
curl -v 'localhost:3000/api/query/member-basic?recordNumber=123' \
  -H 'X-API-Key: YOUR_KEY' 2>&1 | grep "X-API-Key"

# 4. Check server logs for key validation
# Should see: "Request from IP: xxx.xxx.xxx.xxx"
```

### Key Not Working

**Possible causes:**
- Key has special characters → Use base64 encoded keys
- Whitespace in key → Trim whitespace
- Wrong environment → Check .env vs .env.production
- Server not restarted → Restart after .env changes

### Rate Limit Issues

```bash
# Check current rate limit (default: 20 req/min)
# Increase in route.ts:
const RATE_LIMIT_MAX_REQUESTS = 100; // Increase to 100
```

## 📋 API Key Checklist

Use this checklist when setting up:

```
Setup:
[ ] Generated secure API key (32+ bytes, base64)
[ ] Added to .env file
[ ] .env is gitignored
[ ] Server restarted
[ ] Tested with valid key (200 response)
[ ] Tested with invalid key (401 response)
[ ] Configured in Formbricks

Security:
[ ] Key not committed to git
[ ] Key not shared in plain text
[ ] Different keys for dev/staging/prod
[ ] Keys stored in secrets manager (production)
[ ] Rate limiting configured
[ ] Monitoring/logging set up

Documentation:
[ ] Key location documented for team
[ ] Rotation schedule defined
[ ] Emergency contact identified
```

## 📚 Additional Resources

- **OpenSSL Documentation:** https://www.openssl.org/docs/
- **1Password CLI:** https://developer.1password.com/docs/cli/
- **Environment Variables Best Practices:** https://12factor.net/config

## 🎉 Summary

**Generate Key:**
```bash
openssl rand -base64 32
```

**Add to .env:**
```bash
MEMBER_LOOKUP_API_KEY=your-key-here
```

**Restart Server:**
```bash
pnpm dev
```

**Use in Requests:**
```bash
curl -H 'X-API-Key: your-key-here' 'localhost:3000/api/query/...'
```

**That's it!** Your API is now secured with an API key! 🔐
