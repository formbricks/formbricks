# Member Lookup API

API endpoint for querying member information from Snowflake database. Used by Formbricks surveys for dynamic data pre-population.

## Setup

### 1. Install Snowflake SDK

```bash
pnpm add snowflake-sdk
```

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# Snowflake Connection
SNOWFLAKE_ACCOUNT=your-account.snowflakecomputing.com
SNOWFLAKE_USERNAME=your_username
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_DATABASE=your_database
SNOWFLAKE_SCHEMA=your_schema
SNOWFLAKE_WAREHOUSE=your_warehouse

# API Security
MEMBER_LOOKUP_API_KEY=your-secure-random-api-key-here
```

**Generate a secure API key:**
```bash
openssl rand -base64 32
```

### 3. Customize Snowflake Query

Edit `snowflake-service.ts` to match your database schema:

```typescript
const query = `
  SELECT
    record_number,
    first_name,
    last_name,
    email,
    // Add your custom fields here
  FROM your_table_name
  WHERE record_number = ?
  LIMIT 1
`;
```

### 4. Update Type Definitions

Edit `types.ts` to match your data structure:

```typescript
export type TMemberData = {
  recordNumber: string;
  firstName: string;
  lastName: string;
  // Add your custom fields here
};
```

## Usage

### API Request

**Endpoint:** `GET /api/member-lookup`

**Authentication:** API Key in header or query parameter

**Parameters:**
- `recordNumber` (required) - Member record number to lookup

**Headers:**
```
X-API-Key: your-api-key
```

**Example Request:**
```bash
curl -X GET \
  'https://your-domain.com/api/member-lookup?recordNumber=12345' \
  -H 'X-API-Key: your-api-key'
```

**Alternative (query parameter):**
```bash
curl -X GET \
  'https://your-domain.com/api/member-lookup?recordNumber=12345&api_key=your-api-key'
```

### API Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "recordNumber": "12345",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "organization": "Acme Corp",
    "membershipLevel": "Premium",
    "membershipStatus": "ACTIVE",
    "joinDate": "2023-01-15"
  }
}
```

**Not Found (404):**
```json
{
  "success": false,
  "error": "Record not found",
  "message": "No member found with record number: 12345"
}
```

**Rate Limited (429):**
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later."
}
```

**Unauthorized (401):**
```json
{
  "success": false,
  "error": "Invalid API key"
}
```

**Server Error (500):**
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "An error occurred while processing your request"
}
```

## Formbricks Configuration

### 1. Add External Data Source

In your Formbricks survey editor:

1. Go to **Survey Settings** → **External Data Sources**
2. Click **Add Data Source**
3. Configure:

```json
{
  "name": "Member Lookup",
  "apiUrl": "https://your-domain.com/api/member-lookup",
  "method": "GET",
  "authType": "apiKey",
  "authToken": "your-api-key",
  "authLocation": "header",
  "timeout": 10000
}
```

### 2. Configure Survey Logic

**Question 1: Record Number**
- Type: Open Text
- ID: `recordNumber`
- Headline: "Enter your member record number"
- Required: Yes

**Add Logic:**
- Condition: "After this question is answered"
- Action: "Call External API"
- Data Source: "Member Lookup"
- Parameter Mapping:
  ```json
  {
    "recordNumber": "{{recordNumber}}"
  }
  ```
- Response Mapping:
  ```json
  {
    "data.firstName": "firstName",
    "data.lastName": "lastName",
    "data.email": "email",
    "data.organization": "organization",
    "data.membershipLevel": "membershipLevel"
  }
  ```

**Question 2: Confirm Name**
- Type: Open Text
- Headline: "Confirm your name"
- Initial Value: `{{firstName}} {{lastName}}`

**Question 3: Confirm Email**
- Type: Contact Info (Email)
- Headline: "Confirm your email"
- Initial Value: `{{email}}`

## Security Features

### 1. API Key Authentication
- Required for all requests
- Supports header or query parameter
- Compared using constant-time comparison to prevent timing attacks

### 2. Rate Limiting
- 10 requests per minute per IP address
- Returns `429 Too Many Requests` when exceeded
- Includes rate limit headers in response

### 3. Input Validation
- Record number format validation (alphanumeric + hyphens/underscores only)
- Prevents SQL injection through parameterized queries
- Sanitizes all user input

### 4. Connection Security
- Credentials stored in environment variables
- Connection pooling for efficiency
- Automatic reconnection on connection loss

## Testing

### Test API Endpoint

```bash
# Test with valid record number
curl -X GET \
  'http://localhost:3000/api/member-lookup?recordNumber=12345' \
  -H 'X-API-Key: your-api-key'

# Test with invalid API key
curl -X GET \
  'http://localhost:3000/api/member-lookup?recordNumber=12345' \
  -H 'X-API-Key: wrong-key'

# Test with missing record number
curl -X GET \
  'http://localhost:3000/api/member-lookup' \
  -H 'X-API-Key: your-api-key'

# Test rate limiting (run 15 times quickly)
for i in {1..15}; do
  curl -X GET \
    'http://localhost:3000/api/member-lookup?recordNumber=12345' \
    -H 'X-API-Key: your-api-key'
done
```

### Test Snowflake Connection

Add a test endpoint in `route.ts`:

```typescript
export async function POST(request: NextRequest) {
  const { testConnection } = await import('./snowflake-service');
  const result = await testConnection();
  return NextResponse.json({ connected: result });
}
```

Then test:
```bash
curl -X POST http://localhost:3000/api/member-lookup \
  -H 'X-API-Key: your-api-key'
```

## Production Considerations

### 1. Use Redis for Rate Limiting

Replace in-memory rate limiting with Redis:

```typescript
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

async function checkRateLimit(identifier: string) {
  const key = `rate-limit:${identifier}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 60); // 1 minute
  }

  return {
    allowed: count <= RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - count)
  };
}
```

### 2. Add Caching

Cache frequently requested members:

```typescript
import { Redis } from '@upstash/redis';

const CACHE_TTL = 300; // 5 minutes

async function querySnowflakeMember(recordNumber: string) {
  const cacheKey = `member:${recordNumber}`;

  // Check cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return cached as TMemberData;
  }

  // Query database
  const member = await queryFromDatabase(recordNumber);

  // Cache result
  if (member) {
    await redis.set(cacheKey, member, { ex: CACHE_TTL });
  }

  return member;
}
```

### 3. Add Monitoring

Track API usage and performance:

```typescript
import { track } from '@/lib/analytics';

// In route.ts
track('member_lookup', {
  recordNumber,
  duration: endTime - startTime,
  success: true,
  ip: request.ip
});
```

### 4. Add Logging

Use structured logging:

```typescript
import logger from '@/lib/logger';

logger.info('Member lookup request', {
  recordNumber,
  ip: request.ip,
  duration: endTime - startTime
});
```

### 5. Connection Pooling

For high-traffic scenarios, implement proper connection pooling:

```typescript
import { Pool } from 'snowflake-sdk';

const pool = new Pool({
  account: process.env.SNOWFLAKE_ACCOUNT!,
  username: process.env.SNOWFLAKE_USERNAME!,
  password: process.env.SNOWFLAKE_PASSWORD!,
  // Pool configuration
  min: 2,
  max: 10,
  acquireTimeoutMillis: 30000,
  idleTimeoutMillis: 600000
});
```

## Troubleshooting

### Connection Errors

**Error:** `Failed to connect to Snowflake`

**Solutions:**
- Verify environment variables are set correctly
- Check Snowflake account URL format
- Verify network access to Snowflake (firewall, VPN)
- Ensure warehouse is running

### Query Timeouts

**Error:** `Query timeout exceeded`

**Solutions:**
- Increase timeout in connection config
- Optimize Snowflake query (add indexes, limit results)
- Check warehouse size and scaling

### Rate Limit Issues

**Error:** `Rate limit exceeded`

**Solutions:**
- Increase rate limit for production use
- Implement Redis-based rate limiting
- Add API key-based rate limits (different limits per key)

### Invalid Record Numbers

**Error:** `Invalid record number format`

**Solutions:**
- Update validation regex in `route.ts` to match your format
- Standardize record number format in Snowflake
- Document expected format for users

## License

Part of Formbricks - Licensed under AGPL v3
