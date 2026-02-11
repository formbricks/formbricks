# Query Customization Guide

## Current Behavior

**The SQL query is NOT survey-specific** - the same hardcoded query runs for all surveys.

```typescript
// Same query for ALL surveys
const query = `SELECT * FROM members WHERE record_number = ?`;
```

**What IS survey-specific:**
- Response field mapping (configured in Formbricks per survey)

## Making Queries Survey-Specific

### Option 1: Multiple Endpoints (Simplest) ⭐ Recommended

Create separate API endpoints for different use cases:

```
/api/member-lookup       → Query members table
/api/employee-lookup     → Query employees table
/api/customer-lookup     → Query customers table
```

**Pros:**
- ✅ Simple and clear
- ✅ Easy to maintain
- ✅ Different authentication per endpoint
- ✅ Separate rate limits

**Cons:**
- ❌ More code duplication
- ❌ More endpoints to manage

**Implementation:**
See `apps/web/app/api/employee-lookup/` for example.

---

### Option 2: Query Type Parameter (More Flexible)

Add `queryType` parameter to select from pre-defined query templates:

```bash
# Basic query
GET /api/member-lookup?recordNumber=12345&queryType=basic

# Detailed query
GET /api/member-lookup?recordNumber=12345&queryType=detailed

# Premium members only
GET /api/member-lookup?recordNumber=12345&queryType=premium
```

**Pros:**
- ✅ Single endpoint
- ✅ Easy to add new query types
- ✅ Centralized query management

**Cons:**
- ❌ All query types share same rate limit
- ❌ Same authentication for all types

**Implementation:**

1. **Use query templates** (already created in `query-templates.ts`):

```typescript
import { getQueryTemplate } from "./query-templates";

export async function querySnowflakeMember(
  recordNumber: string,
  queryType: string = "detailed"
) {
  const template = getQueryTemplate(queryType);
  const rows = await executeQuery(template.sql, [recordNumber]);
  // ... rest of code
}
```

2. **Update route.ts to accept queryType**:

```typescript
export async function GET(request: NextRequest) {
  // ... authentication code ...

  const recordNumber = request.nextUrl.searchParams.get("recordNumber");
  const queryType = request.nextUrl.searchParams.get("queryType") || "detailed";

  // Validate queryType
  const validTypes = ["basic", "detailed", "premium", "employee", "customer"];
  if (!validTypes.includes(queryType)) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid query type",
        message: `Valid types: ${validTypes.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const memberData = await querySnowflakeMember(recordNumber, queryType);
  // ... rest of code
}
```

3. **Configure in Formbricks**:

```json
{
  "name": "Member Lookup (Premium Only)",
  "apiUrl": "https://your-domain.com/api/member-lookup",
  "method": "GET",
  "authType": "apiKey",
  "authToken": "your-api-key",
  "timeout": 10000,
  "customHeaders": {},
  "parameterMapping": {
    "recordNumber": "{{recordNumber}}",
    "queryType": "premium"  // ← Add query type
  }
}
```

---

### Option 3: Survey-ID Based Routing (Most Flexible)

Map survey IDs to specific queries:

```typescript
const SURVEY_QUERY_MAP = {
  "survey_abc123": "premium",  // Premium member survey
  "survey_def456": "employee", // Employee survey
  "survey_xyz789": "basic",    // Basic info survey
};

export async function GET(request: NextRequest) {
  const surveyId = request.headers.get("X-Survey-ID");
  const queryType = SURVEY_QUERY_MAP[surveyId] || "detailed";

  const memberData = await querySnowflakeMember(recordNumber, queryType);
  // ...
}
```

**Pros:**
- ✅ Automatic query selection per survey
- ✅ No need to configure queryType in each survey
- ✅ Centralized mapping

**Cons:**
- ❌ Need to pass survey ID from Formbricks
- ❌ Tight coupling between API and survey IDs
- ❌ Need to update map for every new survey

---

### Option 4: Custom SQL (Most Powerful - Security Risk!)

**⚠️ WARNING: Not recommended due to SQL injection risk**

Allow passing custom SQL queries (sanitized):

```typescript
// DON'T DO THIS unless you have strict validation
const customQuery = request.body.sqlQuery;
```

**DO NOT IMPLEMENT** unless you have:
- ✅ Strict query validation/parsing
- ✅ Query whitelist/blacklist
- ✅ SQL injection prevention
- ✅ Query complexity limits
- ✅ Execution time limits

---

## Comparison Table

| Approach | Complexity | Flexibility | Security | Maintenance |
|----------|-----------|-------------|----------|-------------|
| **Multiple Endpoints** | Low | Medium | ✅ High | Medium |
| **Query Type Param** | Medium | High | ✅ High | Low |
| **Survey-ID Routing** | High | High | ✅ High | High |
| **Custom SQL** | Very High | Very High | ⚠️ Risk | Very High |

## Recommended Approach

### For Most Use Cases: **Query Type Parameter**

This provides the best balance of flexibility and simplicity:

1. ✅ Easy to configure per survey in Formbricks
2. ✅ No code changes needed for new surveys
3. ✅ Add new query types by updating `query-templates.ts`
4. ✅ Type-safe with TypeScript
5. ✅ Secure (pre-defined queries only)

### For Few, Distinct Use Cases: **Multiple Endpoints**

If you only have 2-3 distinct query types:

1. ✅ Clearest separation of concerns
2. ✅ Different rate limits per endpoint
3. ✅ Easier to monitor and debug

## Implementation Steps

### To Add Query Type Support:

1. **Update snowflake-service.ts**:

```typescript
import { getQueryTemplate } from "./query-templates";

export async function querySnowflakeMember(
  recordNumber: string,
  queryType: string = "detailed"
): Promise<TMemberData | null> {
  try {
    const template = getQueryTemplate(queryType);
    const rows = await executeQuery(template.sql, [recordNumber]);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];

    // Dynamic field mapping based on what's returned
    const memberData: any = {};
    Object.keys(row).forEach((key) => {
      const camelKey = key.toLowerCase().replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      memberData[camelKey] = row[key];
    });

    return memberData;
  } catch (error) {
    console.error(`[Snowflake Service] Query failed for type ${queryType}:`, error);
    throw error;
  }
}
```

2. **Update route.ts** (add queryType parameter):

```typescript
const recordNumber = request.nextUrl.searchParams.get("recordNumber");
const queryType = request.nextUrl.searchParams.get("queryType") || "detailed";

const memberData = await querySnowflakeMember(recordNumber, queryType);
```

3. **Configure in Formbricks** (add queryType to parameter mapping):

```json
{
  "parameterMapping": {
    "recordNumber": "{{recordNumber}}",
    "queryType": "premium"
  }
}
```

## Example Use Cases

### Use Case 1: Simple vs Detailed Surveys

```json
// Survey A: Quick feedback (basic info only)
{
  "apiUrl": "/api/member-lookup",
  "parameterMapping": {
    "recordNumber": "{{recordNumber}}",
    "queryType": "basic"  // Only name + email
  }
}

// Survey B: In-depth interview (all details)
{
  "apiUrl": "/api/member-lookup",
  "parameterMapping": {
    "recordNumber": "{{recordNumber}}",
    "queryType": "detailed"  // Everything including address
  }
}
```

### Use Case 2: Different Member Tiers

```json
// Premium Member Survey
{
  "parameterMapping": {
    "recordNumber": "{{recordNumber}}",
    "queryType": "premium"  // Premium members only + benefits
  }
}

// All Members Survey
{
  "parameterMapping": {
    "recordNumber": "{{recordNumber}}",
    "queryType": "detailed"  // All members
  }
}
```

### Use Case 3: Different Databases

```json
// Employee Survey
{
  "parameterMapping": {
    "employeeId": "{{employeeId}}",
    "queryType": "employee"  // Query employees table
  }
}

// Customer Survey
{
  "parameterMapping": {
    "customerId": "{{customerId}}",
    "queryType": "customer"  // Query customers table
  }
}
```

## Performance Considerations

### Query Optimization Tips:

1. **Create indexes** on lookup columns:
```sql
CREATE INDEX idx_members_record_number ON members(record_number);
CREATE INDEX idx_employees_employee_id ON employees(employee_id);
```

2. **Use LIMIT 1** in all queries

3. **Only select needed fields** (use "basic" for simple surveys)

4. **Consider caching** frequently requested records:
```typescript
const CACHE_TTL = 300; // 5 minutes
const cache = new Map();

export async function querySnowflakeMember(recordNumber: string, queryType: string) {
  const cacheKey = `${queryType}:${recordNumber}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const result = await executeQuery(/* ... */);

  cache.set(cacheKey, result);
  setTimeout(() => cache.delete(cacheKey), CACHE_TTL * 1000);

  return result;
}
```

## Testing Different Query Types

```bash
# Test basic query
curl -X GET \
  'http://localhost:3000/api/member-lookup?recordNumber=12345&queryType=basic' \
  -H 'X-API-Key: your-key'

# Test premium query
curl -X GET \
  'http://localhost:3000/api/member-lookup?recordNumber=12345&queryType=premium' \
  -H 'X-API-Key: your-key'

# Test employee query
curl -X GET \
  'http://localhost:3000/api/member-lookup?recordNumber=EMP001&queryType=employee' \
  -H 'X-API-Key: your-key'
```

## Summary

**Current State:**
- ❌ Same query for all surveys
- ✅ Survey-specific response mapping

**Recommended Solution:**
- ✅ Add `queryType` parameter
- ✅ Use query templates for different use cases
- ✅ Configure queryType per survey in Formbricks

This gives you maximum flexibility while maintaining security and simplicity!
