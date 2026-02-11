# Contact Enrichment Module

This module provides contact CSV upload functionality with pre-import enrichment from external APIs.

## Features

- **CSV Upload**: Upload contact data from CSV files (up to 800KB, max 10,000 records)
- **Pre-Import Enrichment**: Enrich contact data from external APIs before importing
- **Flexible API Configuration**: Support for GET/POST requests with various authentication methods
- **Response Mapping**: Map API response fields to contact attributes using dot notation
- **Preview**: Preview both original and enriched data before importing
- **Error Handling**: Graceful handling of API failures with partial success support

## Components

### UploadContactsCSVButton

Main component for uploading contacts with enrichment capabilities.

```tsx
import { UploadContactsCSVButton } from "@/modules/contacts";

<UploadContactsCSVButton
  environmentId="env_123"
  onUploadComplete={(contacts) => {
    // Handle uploaded contacts
    console.log(`Uploaded ${contacts.length} contacts`);
  }}
/>
```

### EnrichmentConfigForm

Form component for configuring external API enrichment.

```tsx
import { EnrichmentConfigForm } from "@/modules/contacts";

<EnrichmentConfigForm
  csvColumns={["email", "userId", "firstName"]}
  onConfigChange={(config) => {
    // Handle config changes
    console.log("Enrichment config:", config);
  }}
/>
```

## Enrichment Service

The enrichment service (`contact-enrichment.ts`) provides functions to enrich contact data from external APIs.

### enrichContactFromAPI

Enriches a single contact record:

```typescript
import { enrichContactFromAPI } from "@/modules/contacts";

const result = await enrichContactFromAPI(
  { email: "user@example.com", firstName: "John" },
  {
    apiUrl: "https://api.clearbit.com/v2/people/find",
    apiMethod: "GET",
    authType: "bearer",
    authValue: "your-api-key",
    lookupColumn: "email",
    responseMapping: {
      "name.givenName": "firstName",
      "name.familyName": "lastName",
      "employment.title": "jobTitle",
      "employment.name": "company",
    },
    timeout: 5000,
  }
);
```

### enrichContactsBatch

Enriches multiple contacts in parallel with progress tracking:

```typescript
import { enrichContactsBatch } from "@/modules/contacts";

const result = await enrichContactsBatch(contacts, enrichmentConfig, {
  maxConcurrent: 5,
  onProgress: (processed, total) => {
    console.log(`Processed ${processed}/${total}`);
  },
});
```

## Enrichment Configuration

### API Methods

- **GET**: Appends lookup value as query parameter
- **POST**: Sends lookup value in request body (supports custom templates)

### Authentication Types

- **none**: No authentication
- **bearer**: Bearer token authentication (`Authorization: Bearer <token>`)
- **apiKey**: API key authentication (`X-API-Key: <key>`)
- **basic**: Basic authentication (`Authorization: Basic <base64(username:password)>`)

### Response Mapping

Use dot notation to map nested API response fields:

```typescript
{
  "data.user.firstName": "firstName",
  "data.user.lastName": "lastName",
  "data.user.contact.email": "email"
}
```

### Request Body Template

For POST requests, use `{{lookupValue}}` as a placeholder:

```json
{
  "email": "{{lookupValue}}",
  "enrichmentFields": ["name", "company", "location"]
}
```

## Example: Clearbit Integration

```typescript
const clearbitConfig = {
  apiUrl: "https://person.clearbit.com/v2/people/find",
  apiMethod: "GET",
  authType: "bearer",
  authValue: "sk_your_clearbit_api_key",
  lookupColumn: "email",
  responseMapping: {
    "name.givenName": "firstName",
    "name.familyName": "lastName",
    "employment.title": "jobTitle",
    "employment.name": "company",
    "geo.city": "city",
    "geo.country": "country",
  },
  timeout: 5000,
};
```

## Example: Custom API Integration

```typescript
const customApiConfig = {
  apiUrl: "https://api.yourservice.com/enrich",
  apiMethod: "POST",
  authType: "apiKey",
  authValue: "your-api-key",
  lookupColumn: "userId",
  requestBodyTemplate: JSON.stringify({
    userId: "{{lookupValue}}",
    fields: ["profile", "preferences"],
  }),
  responseMapping: {
    "profile.fullName": "fullName",
    "profile.phone": "phoneNumber",
    "preferences.language": "language",
  },
  timeout: 10000,
};
```

## Error Handling

The enrichment service handles errors gracefully:

- **Network errors**: Timeout after specified duration
- **API errors**: Captures error messages from failed requests
- **Partial success**: Returns both successful and failed enrichments
- **Validation**: Validates configuration before making API calls

## Testing

You can validate enrichment configuration without making API calls:

```typescript
import { validateEnrichmentConfig } from "@/modules/contacts";

const validation = validateEnrichmentConfig({
  apiUrl: "https://api.example.com/enrich",
  apiMethod: "GET",
  lookupColumn: "email",
  responseMapping: { name: "fullName" },
});

if (!validation.valid) {
  console.error("Config errors:", validation.errors);
}
```

## File Size Limits

- Maximum CSV file size: 800KB
- Maximum records per upload: 10,000 contacts
- Concurrent API requests: Configurable (default: 5)
