# Storage Package Rules for Formbricks

## Package Purpose & Design Philosophy

The `@formbricks/storage` package provides a **type-safe, environment-agnostic S3 storage abstraction** for Formbricks. It's designed as a standalone library that can work with any S3-compatible storage provider (AWS S3, MinIO, LocalStack, etc.).

### Key Design Decisions

1. **Result Type Pattern**: All operations return `Result<T, StorageError>` instead of throwing exceptions, enabling explicit error handling
2. **Environment-based Configuration**: Zero hardcoded values - all configuration comes from environment variables
3. **Graceful Degradation**: When S3 is unavailable, the package fails gracefully without crashing the application
4. **Minimal Dependencies**: Only includes necessary AWS SDK packages, avoiding the bloated umbrella package
5. **Internal Implementation Hiding**: Only exports the public API, keeping client creation and constants internal

## Core Use Cases

### File Upload Flow

```typescript
// Generate presigned URL for secure client-side uploads
const uploadResult = await getSignedUploadUrl(
  "user-avatar.jpg",
  "image/jpeg",
  "users/123/avatars",
  5 * 1024 * 1024 // 5MB limit
);

if (uploadResult.ok) {
  // Client uploads directly to S3 using signed URL
  const { signedUrl, presignedFields } = uploadResult.data;
}
```

### File Download Flow

```typescript
// Generate temporary download links for private files
const downloadResult = await getSignedDownloadUrl("users/123/avatars/user-avatar.jpg");

if (downloadResult.ok) {
  // Redirect user to temporary download URL (expires in 30 minutes)
  return redirect(downloadResult.data);
}
```

### Cleanup Operations

```typescript
// Single file deletion
await deleteFile("users/123/temp/upload.pdf");

// Bulk cleanup (handles pagination automatically)
await deleteFilesByPrefix("surveys/456/responses/"); // Deletes all response files
```

## Package Architecture

### Module Responsibilities

- **`service.ts`**: Core business logic - the four main operations
- **`client.ts`**: S3 client factory with environment validation
- **`constants.ts`**: Environment variable exports (internal use only)
- **`types/error.ts`**: Result type system and error definitions
- **`index.ts`**: Public API exports (consumers only see this)

### Error Handling Strategy

```typescript
// All functions use consistent error types (see types/error.ts)
type StorageError = {
  code: ErrorCode; // e.g., ErrorCode.S3ClientError, ErrorCode.S3CredentialsError
};

// Consumers handle errors explicitly
const result = await deleteFilesByPrefix("path/");
if (!result.ok) {
  switch (result.error.code) {
    case ErrorCode.S3CredentialsError:
    // Handle missing/invalid credentials
    case ErrorCode.FileNotFoundError:
    // Handle missing files
    default:
    // Handle unexpected errors
  }
}
```

## Environment Configuration

### Required Variables

```bash
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_REGION=us-east-1
S3_BUCKET_NAME=formbricks-storage
```

### Optional Variables (for non-AWS providers)

```bash
S3_ENDPOINT_URL=http://localhost:9000  # MinIO/LocalStack
S3_FORCE_PATH_STYLE=1                  # Required for MinIO
```

### Configuration Validation

- Validation happens at **client creation time**, not at startup
- Missing credentials result in `s3_credentials_error`
- Invalid credentials are detected during first operation

## Bulk Operations Design

### Why Pagination + Batching?

S3 has two key limitations:

1. **ListObjects** returns max 1000 objects per request → Use pagination
2. **DeleteObjects** accepts max 1000 objects per request → Use batching

### Implementation Pattern

```typescript
// 1. Paginate through all objects with prefix
const paginator = paginateListObjectsV2(client, { Bucket, Prefix });
for await (const page of paginator) {
  // Collect all keys
}

// 2. Batch deletions in groups of 1000
for (let i = 0; i < keys.length; i += 1000) {
  const batch = keys.slice(i, i + 1000);
  await s3Client.send(new DeleteObjectsCommand({ Delete: { Objects: batch } }));
}

// 3. Handle partial failures gracefully
// Log errors but don't fail the entire operation
```

## Integration Patterns

### In Formbricks Web App

```typescript
// Survey file cleanup when survey is deleted
await deleteFilesByPrefix(`surveys/${surveyId}/`);

// Response file cleanup when response is deleted
await deleteFilesByPrefix(`surveys/${surveyId}/responses/${responseId}/`);

// User avatar upload
const uploadUrl = await getSignedUploadUrl(file.name, file.type, `users/${userId}/avatars`, maxAvatarSize);
```

### Testing Strategy

- **Mock the entire `@aws-sdk/client-s3` module** - don't try to mock individual operations
- **Use `paginateListObjectsV2` mocks** with async generators for bulk operations
- **Test error scenarios** - missing credentials, network failures, partial deletions
- **Mock environment variables** consistently across tests

## Performance Considerations

### Presigned URL Expiration

- **Upload URLs**: 2 minutes (short for security)
- **Download URLs**: 30 minutes (balance between security and UX)

### Bulk Operation Optimization

- **Concurrent batch processing**: Delete batches in parallel using `Promise.all()`
- **Memory efficient pagination**: Process one page at a time, don't load all keys into memory
- **Partial failure handling**: Continue processing even if some batches fail

### Client Reuse

- **Single client instance** created at module level
- **Avoid recreating clients** for each operation
- **Fail fast** if client creation fails due to missing credentials

## Common Pitfalls & Solutions

### ❌ Don't expose internal details

```typescript
// Wrong - exposes implementation
export { S3_BUCKET_NAME, createS3Client } from "./internal";
```

### ✅ Keep implementation internal

```typescript
// Correct - only expose business operations
export { deleteFile, getSignedUploadUrl } from "./service";
```

### ❌ Don't use generic error handling

```typescript
// Wrong - loses error context
catch (error) {
  throw new Error("Something went wrong");
}
```

### ✅ Use specific error types

```typescript
// Correct - categorize errors appropriately
catch (error) {
  logger.error({ error }, "S3 operation failed");
  return err({ code: ErrorCode.S3ClientError });
}
```

### ❌ Don't hardcode configuration

```typescript
// Wrong - not environment-agnostic
const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: "https://s3.amazonaws.com",
});
```

### ✅ Use environment variables

```typescript
// Correct - works with any S3-compatible provider
const s3Client = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT_URL,
  forcePathStyle: S3_FORCE_PATH_STYLE,
});
```

## Dependencies & Versioning

### AWS SDK Strategy

- **Use specific packages** (`@aws-sdk/client-s3`) not umbrella package (`aws-sdk`)
- **Pin exact versions** to avoid breaking changes
- **External dependencies**: All AWS SDK packages are externalized in build

### Package Structure

```json
{
  "exports": {
    "import": "./dist/index.js",
    "require": "./dist/index.cjs"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

## Function Reference

### `getSignedUploadUrl(fileName, contentType, filePath, maxSize?)`

**Purpose**: Generate presigned POST URL for secure client-side uploads
**Returns**: `Result<{ signedUrl: string; presignedFields: Record<string, string> }, StorageError>`
**Use Case**: File uploads from browser without exposing S3 credentials

### `getSignedDownloadUrl(fileKey)`

**Purpose**: Generate temporary download URL for private files
**Returns**: `Result<string, StorageError>` (temporary URL valid for 30 minutes)
**Use Case**: Serving private files without making S3 bucket public

### `deleteFile(fileKey)`

**Purpose**: Delete a single file from S3
**Returns**: `Result<void, StorageError>`
**Use Case**: Remove uploaded files when user deletes content

### `deleteFilesByPrefix(prefix)`

**Purpose**: Bulk delete all files matching a prefix pattern
**Returns**: `Result<{ deletedCount: number; partialFailures?: string[] }, StorageError>`
**Use Case**: Cleanup entire folders when surveys/users are deleted

Remember: This package is designed to be **infrastructure-agnostic** and **error-resilient**. It should work seamlessly whether you're using AWS S3, MinIO for local development, or any other S3-compatible storage provider.
