# Contact Enrichment Implementation

## Overview

This implementation provides pre-import contact enrichment from external APIs in the **core (AGPL)** codebase, built outside the `/ee/` directory.

## Files Created

### Core Service
- **`lib/contact-enrichment.ts`** - Main enrichment service with API integration
- **`lib/contact-enrichment.test.ts`** - Comprehensive test suite

### Types
- **`types/enrichment.ts`** - TypeScript types and Zod schemas for enrichment configuration

### Components
- **`components/upload-contacts-button.tsx`** - CSV upload UI with enrichment workflow
- **`components/enrichment-config-form.tsx`** - Configuration form for API settings
- **`components/csv-table.tsx`** - Data preview table component

### Actions
- **`actions.ts`** - Server actions for contact import

### Documentation
- **`README.md`** - User-facing documentation with examples
- **`IMPLEMENTATION.md`** - This file
- **`index.ts`** - Module exports

## Architecture

### Enrichment Flow

```
1. User uploads CSV file
   ↓
2. CSV is parsed and validated
   ↓
3. User configures enrichment (optional)
   - API URL and method
   - Authentication
   - Lookup column
   - Response field mapping
   ↓
4. Enrichment service calls external API
   - Processes contacts in batches (max 5 concurrent)
   - Shows progress indicator
   - Handles partial failures gracefully
   ↓
5. User previews enriched data
   - Can switch between original and enriched views
   ↓
6. User confirms import
   ↓
7. Contacts are imported to database
```

### Key Features

1. **Flexible API Integration**
   - Supports GET and POST requests
   - Multiple authentication methods (Bearer, API Key, Basic)
   - Custom request body templates for POST
   - Configurable timeout

2. **Smart Response Mapping**
   - Dot notation for nested fields (e.g., `data.user.firstName`)
   - Maps API response to contact attributes
   - Preserves original data if enrichment fails

3. **Robust Error Handling**
   - Validates configuration before API calls
   - Handles network timeouts
   - Graceful partial failures
   - Detailed error messages

4. **User Experience**
   - Live preview of both original and enriched data
   - Progress indicator during enrichment
   - Drag-and-drop CSV upload
   - Example CSV download

## API Configuration

### Supported Authentication Types

```typescript
type AuthType = "none" | "bearer" | "apiKey" | "basic";
```

### Configuration Schema

```typescript
{
  apiUrl: string;           // External API endpoint
  apiMethod: "GET" | "POST"; // HTTP method
  authType: AuthType;       // Authentication type
  authValue?: string;       // Auth token/key (if needed)
  lookupColumn: string;     // CSV column for API lookup
  requestBodyTemplate?: string; // POST body template
  responseMapping: Record<string, string>; // API field → Contact attribute
  timeout: number;          // Request timeout (ms)
}
```

## Example Integrations

### Clearbit Person API

```typescript
{
  apiUrl: "https://person.clearbit.com/v2/people/find",
  apiMethod: "GET",
  authType: "bearer",
  authValue: "sk_your_api_key",
  lookupColumn: "email",
  responseMapping: {
    "name.givenName": "firstName",
    "name.familyName": "lastName",
    "employment.title": "jobTitle",
    "employment.name": "company"
  },
  timeout: 5000
}
```

### Custom REST API

```typescript
{
  apiUrl: "https://api.yourservice.com/enrich",
  apiMethod: "POST",
  authType: "apiKey",
  authValue: "your-api-key",
  lookupColumn: "userId",
  requestBodyTemplate: JSON.stringify({
    userId: "{{lookupValue}}",
    fields: ["profile", "preferences"]
  }),
  responseMapping: {
    "profile.fullName": "fullName",
    "profile.phone": "phoneNumber"
  },
  timeout: 10000
}
```

## Testing

Run tests with:
```bash
npm test apps/web/modules/contacts/lib/contact-enrichment.test.ts
```

Test coverage includes:
- Configuration validation
- GET/POST request handling
- Authentication methods
- Nested field mapping
- Error handling
- Batch processing
- Progress callbacks

## Performance Considerations

1. **Batch Processing**: Processes max 5 contacts concurrently to avoid overwhelming APIs
2. **Timeout**: Default 5s timeout prevents hanging requests
3. **File Size**: 800KB max CSV size, 10,000 max records
4. **Client-side Preview**: Shows first 11 rows only for performance

## Security Considerations

1. **Authentication**: Credentials stored in component state (not persisted)
2. **Server-side Validation**: All imports validated via server actions
3. **CORS**: External APIs must allow CORS from Formbricks domain
4. **Rate Limiting**: Batch processing limits concurrent requests

## Future Enhancements

Potential improvements for future iterations:

1. **Saved Configurations**: Store frequently used API configs
2. **Async Processing**: Queue large enrichments as background jobs
3. **Retry Logic**: Automatic retry for failed enrichments
4. **API Templates**: Pre-configured templates for popular services
5. **Webhook Support**: Trigger enrichment via webhooks
6. **Field Transformation**: Apply transformations (uppercase, trim, etc.)
7. **Caching**: Cache API responses to avoid duplicate calls

## Integration with Existing Code

This implementation is built in **core** (`/apps/web/modules/contacts/`) rather than `/ee/`, making it available in the AGPL version of Formbricks.

To use in existing contact management UI:

```tsx
import { UploadContactsCSVButton } from "@/modules/contacts";

<UploadContactsCSVButton
  environmentId={environmentId}
  onUploadComplete={(contacts) => {
    // Handle imported contacts
    router.refresh();
  }}
/>
```

## Dependencies

- `csv-parse/sync` - CSV parsing
- `zod` - Schema validation
- `react-hot-toast` - Toast notifications
- `lucide-react` - Icons
- UI components from `@/modules/ui/components`

## License

This code is part of the Formbricks core (AGPL v3) and is available to all users.
