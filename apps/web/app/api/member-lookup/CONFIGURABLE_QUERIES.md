## ✅ YES! Queries are Now Fully Configurable

You can now add, modify, or remove queries **without touching any code** - just edit the JSON configuration file!

## 🎯 What's Configurable?

Everything:
- ✅ SQL queries
- ✅ Database/schema names
- ✅ Parameters
- ✅ Field mappings
- ✅ Caching settings
- ✅ Security rules

## 📝 How to Configure Queries

### Method 1: JSON Configuration File ⭐ (Easiest)

Edit `apps/web/app/api/member-lookup/query-config.json`:

```json
{
  "queries": {
    "my-custom-query": {
      "name": "My Custom Query",
      "description": "Description of what this query does",
      "sql": "SELECT id, name, email FROM my_table WHERE id = :userId LIMIT 1",
      "parameters": ["userId"],
      "fields": {
        "userId": "id",
        "fullName": "name",
        "emailAddress": "email"
      },
      "cache": {
        "enabled": true,
        "ttl": 300
      }
    }
  }
}
```

**That's it!** No code changes needed.

### Use Your New Query:

```bash
# Immediately available!
curl 'http://localhost:3000/api/query/my-custom-query?userId=123' \
  -H 'X-API-Key: your-key'
```

## 🚀 Quick Start

### Step 1: View Available Queries

```bash
curl 'http://localhost:3000/api/query' \
  -H 'X-API-Key: your-key'
```

**Response:**
```json
{
  "success": true,
  "queries": [
    {
      "id": "member-basic",
      "name": "Basic Member Info",
      "description": "Minimal member information for quick surveys"
    },
    {
      "id": "member-detailed",
      "name": "Detailed Member Profile",
      "description": "Complete member information..."
    }
  ]
}
```

### Step 2: Use a Query

```bash
curl 'http://localhost:3000/api/query/member-basic?recordNumber=12345' \
  -H 'X-API-Key: your-key'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recordNumber": "12345",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com"
  },
  "queryId": "member-basic"
}
```

### Step 3: Configure in Formbricks

```json
{
  "name": "Member Lookup (Basic)",
  "apiUrl": "https://your-domain.com/api/query/member-basic",
  "method": "GET",
  "authType": "apiKey",
  "authToken": "your-api-key",
  "parameterMapping": {
    "recordNumber": "{{recordNumber}}"
  },
  "responseMapping": {
    "data.firstName": "firstName",
    "data.lastName": "lastName",
    "data.email": "email"
  }
}
```

## 📋 Pre-Configured Queries

6 queries ready to use out of the box:

### 1. `member-basic`
**Minimal member info for quick surveys**

Parameters: `recordNumber`

Returns: `recordNumber`, `firstName`, `lastName`, `email`

Example:
```bash
GET /api/query/member-basic?recordNumber=12345
```

### 2. `member-detailed`
**Complete member profile**

Parameters: `recordNumber`

Returns: All member fields including address, membership level, dates

Example:
```bash
GET /api/query/member-detailed?recordNumber=12345
```

### 3. `member-premium`
**Premium/VIP members with benefits**

Parameters: `recordNumber`

Returns: Member info + list of benefits

Example:
```bash
GET /api/query/member-premium?recordNumber=12345
```

### 4. `employee`
**Employee information from HR system**

Parameters: `employeeId`

Returns: Employee details, department, manager, hire date

Example:
```bash
GET /api/query/employee?employeeId=EMP001
```

### 5. `customer-orders`
**Customer with purchase history**

Parameters: `customerId`

Returns: Customer info + order count + lifetime value

Example:
```bash
GET /api/query/customer-orders?customerId=CUST999
```

### 6. `member-by-email`
**Find member by email instead of ID**

Parameters: `email`

Returns: Member info

Example:
```bash
GET /api/query/member-by-email?email=john@example.com
```

## ➕ Adding New Queries

### Example: Add a "Recent Orders" Query

Edit `query-config.json`:

```json
{
  "queries": {
    "recent-orders": {
      "name": "Recent Customer Orders",
      "description": "Last 5 orders for a customer",
      "sql": "SELECT order_id, order_date, order_total, order_status FROM orders WHERE customer_id = :customerId ORDER BY order_date DESC LIMIT 5",
      "parameters": ["customerId"],
      "fields": {
        "orderId": "order_id",
        "orderDate": "order_date",
        "orderTotal": "order_total",
        "orderStatus": "order_status"
      },
      "cache": {
        "enabled": false
      }
    }
  }
}
```

**Use immediately:**
```bash
curl 'http://localhost:3000/api/query/recent-orders?customerId=CUST123' \
  -H 'X-API-Key: your-key'
```

## 🔧 Query Configuration Format

### Full Query Schema:

```json
{
  "query-id": {
    "name": "Human-readable name",
    "description": "What this query returns",
    "database": "{{SNOWFLAKE_DATABASE}}",  // Optional, uses env var
    "schema": "{{SNOWFLAKE_SCHEMA}}",      // Optional, uses env var
    "sql": "SELECT * FROM table WHERE id = :paramName LIMIT 1",
    "parameters": ["paramName"],           // Required params
    "fields": {                             // Output field mapping
      "outputField": "sql_column_name"
    },
    "cache": {
      "enabled": true,
      "ttl": 300                           // Cache TTL in seconds
    }
  }
}
```

### SQL Parameter Format:

Use **named parameters** with colon prefix:

```sql
-- Good: Named parameters
SELECT * FROM members WHERE record_number = :recordNumber

-- Good: Multiple parameters
SELECT * FROM orders
WHERE customer_id = :customerId
  AND order_date > :startDate

-- Bad: Positional parameters (not supported)
SELECT * FROM members WHERE record_number = ?
```

### Field Mapping:

Maps SQL column names to output JSON fields:

```json
{
  "fields": {
    "firstName": "first_name",      // Output: firstName, SQL: FIRST_NAME
    "lastName": "last_name",
    "emailAddress": "email",        // Can rename fields
    "totalOrders": "order_count"
  }
}
```

### Environment Variable Interpolation:

Use `{{VAR_NAME}}` to interpolate environment variables:

```json
{
  "database": "{{SNOWFLAKE_DATABASE}}",
  "schema": "{{SNOWFLAKE_SCHEMA}}",
  "sql": "SELECT * FROM {{SNOWFLAKE_DATABASE}}.{{SNOWFLAKE_SCHEMA}}.members"
}
```

## 🔒 Security Features

Built-in security rules prevent dangerous queries:

```json
{
  "security": {
    "allowCustomQueries": false,                  // No arbitrary SQL
    "maxQueryLength": 2000,                       // Prevent huge queries
    "allowedStatements": ["SELECT"],              // Only SELECT allowed
    "blockedKeywords": ["DROP", "DELETE", ...],  // Block dangerous ops
    "requireWhereClause": true,                   // Must have WHERE
    "requireLimit": true,                         // Must have LIMIT
    "maxRows": 1                                  // Max 1 row returned
  }
}
```

### Security Validation:

Every query is validated before execution:

✅ Only SELECT statements allowed
✅ Must include WHERE clause
✅ Must include LIMIT clause
✅ Blocks: DROP, DELETE, UPDATE, INSERT, ALTER, etc.
✅ Maximum query length enforced

## 💾 Caching

Control caching per query:

```json
{
  "cache": {
    "enabled": true,    // Enable caching
    "ttl": 300          // Cache for 5 minutes
  }
}
```

**When to cache:**
- ✅ Static data (member profiles, employee info)
- ✅ Infrequently changing data
- ✅ High-traffic queries

**When NOT to cache:**
- ❌ Real-time data (current orders, inventory)
- ❌ User-specific data that changes frequently
- ❌ Financial/sensitive data

## 🎨 Advanced Examples

### Example 1: Multi-Table Join

```json
{
  "member-with-org": {
    "name": "Member with Organization Details",
    "sql": "SELECT m.record_number, m.first_name, m.last_name, m.email, o.org_name, o.org_type, o.member_count FROM members m JOIN organizations o ON m.organization_id = o.org_id WHERE m.record_number = :recordNumber LIMIT 1",
    "parameters": ["recordNumber"],
    "fields": {
      "recordNumber": "record_number",
      "firstName": "first_name",
      "lastName": "last_name",
      "email": "email",
      "organizationName": "org_name",
      "organizationType": "org_type",
      "orgMemberCount": "member_count"
    }
  }
}
```

### Example 2: Aggregation Query

```json
{
  "member-activity-summary": {
    "name": "Member Activity Summary",
    "sql": "SELECT m.record_number, m.first_name, COUNT(DISTINCT e.event_id) as total_events, MAX(e.event_date) as last_activity FROM members m LEFT JOIN events e ON m.record_number = e.record_number WHERE m.record_number = :recordNumber GROUP BY m.record_number, m.first_name LIMIT 1",
    "parameters": ["recordNumber"],
    "fields": {
      "recordNumber": "record_number",
      "firstName": "first_name",
      "totalEvents": "total_events",
      "lastActivity": "last_activity"
    },
    "cache": {
      "enabled": true,
      "ttl": 60
    }
  }
}
```

### Example 3: Conditional Logic

```json
{
  "member-status-enhanced": {
    "name": "Member Status with Computed Fields",
    "sql": "SELECT record_number, first_name, last_name, membership_level, CASE WHEN renewal_date < CURRENT_DATE THEN 'Expired' WHEN renewal_date < DATEADD(day, 30, CURRENT_DATE) THEN 'Expiring Soon' ELSE 'Active' END as renewal_status, DATEDIFF(day, CURRENT_DATE, renewal_date) as days_until_renewal FROM members WHERE record_number = :recordNumber LIMIT 1",
    "parameters": ["recordNumber"],
    "fields": {
      "recordNumber": "record_number",
      "firstName": "first_name",
      "lastName": "last_name",
      "membershipLevel": "membership_level",
      "renewalStatus": "renewal_status",
      "daysUntilRenewal": "days_until_renewal"
    }
  }
}
```

## 🔄 Hot Reloading (Development)

Configuration is cached for 1 minute. To reload immediately:

```bash
# Restart your dev server
pnpm dev

# Or wait 60 seconds for auto-reload
```

In production, changes take effect within 1 minute without restart.

## 🧪 Testing Queries

### Test Before Using:

```bash
# 1. Validate query syntax
# Edit query-config.json and save

# 2. List queries to verify it's loaded
curl 'http://localhost:3000/api/query' -H 'X-API-Key: your-key'

# 3. Test with sample data
curl 'http://localhost:3000/api/query/your-query?param=testvalue' \
  -H 'X-API-Key: your-key'

# 4. Check response time and caching
# First call: slow (hits database)
# Second call: fast (cached)
```

## 📊 Monitoring & Debugging

### Check Available Queries:

```bash
curl 'http://localhost:3000/api/query' -H 'X-API-Key: your-key'
```

### View Query Details:

Check server logs:
```
[Query Config] Loaded 6 query configurations
[Configurable Query] Executing member-basic with params: { recordNumber: '12345' }
[Configurable Query] Success for member-basic (45ms)
[Configurable Query] Cache hit for member-detailed (2ms)
```

### Performance Metrics:

Response headers include timing:
```
X-Response-Time: 45ms
X-RateLimit-Remaining: 18
```

## 🚀 Migration from Hardcoded Queries

### Before (Hardcoded):
```typescript
// Had to modify code for each new query
const query = `SELECT * FROM members WHERE record_number = ?`;
const rows = await executeQuery(query, [recordNumber]);
```

### After (Configurable):
```json
// Just edit JSON - no code changes!
{
  "my-query": {
    "sql": "SELECT * FROM members WHERE record_number = :recordNumber",
    "parameters": ["recordNumber"],
    "fields": { ... }
  }
}
```

```bash
# Use immediately
GET /api/query/my-query?recordNumber=123
```

## 🎯 Best Practices

### ✅ DO:
- Keep queries simple and focused
- Always include LIMIT clause
- Use descriptive query IDs (kebab-case)
- Document queries with name and description
- Test queries with sample data first
- Use caching for static data
- Version your config file in git

### ❌ DON'T:
- Don't use SELECT * (specify columns)
- Don't forget WHERE clause (performance!)
- Don't return more than needed
- Don't disable security rules
- Don't cache sensitive/real-time data
- Don't use complex joins unless necessary

## 🔧 Troubleshooting

### "Query configuration not found"
- Check query ID spelling in URL
- List available queries: `GET /api/query`
- Verify query exists in `query-config.json`

### "Missing required parameters"
- Check parameter names match exactly
- Verify you're passing all required parameters
- Check parameter case sensitivity

### "Invalid query configuration"
- Check security rules (WHERE clause, LIMIT, etc.)
- Verify SQL syntax is valid
- Check for blocked keywords

### "Field not found in result"
- SQL column names are UPPER_CASE in results
- Check field mapping matches actual columns
- Run query in Snowflake to see column names

## 📚 Additional Resources

- **Query Config File:** `apps/web/app/api/member-lookup/query-config.json`
- **Configuration Schema:** `query-config.schema.json`
- **Original Guide:** `QUERY_CUSTOMIZATION.md`
- **Environment Setup:** `ENV_SETUP_GUIDE.md`

## 🎉 Summary

**Before:** Hardcoded queries, code changes needed for each new query

**Now:** Fully configurable via JSON:
1. Edit `query-config.json`
2. Save file
3. Use immediately!

No restarts, no code changes, no deployments needed! 🚀
