# Storage Package Rules for Formbricks

## Package Overview

The `@formbricks/storage` package provides S3-compatible cloud storage functionality for Formbricks. It handles file uploads, downloads, single/bulk deletions with comprehensive error handling and type safety.

## Core Functions

### Available Operations

- `getSignedUploadUrl` - Generate presigned URLs for file uploads
- `getSignedDownloadUrl` - Generate signed URLs for file downloads
- `deleteFile` - Delete a single file from S3
- `deleteFilesByPrefix` - Bulk delete files by prefix with pagination

## Architecture Patterns

### Result Type System

All storage operations use Result type pattern:

```typescript
// ✅ Use Result<T, StorageError> for all operations
export const storageOperation = async (): Promise<Result<Data, StorageError>> => {
  try {
    if (!s3Client) {
      return err({ code: ErrorCode.S3ClientError });
    }
    return ok(data);
  } catch (error) {
    logger.error({ error }, "Operation failed");
    return err({ code: ErrorCode.Unknown });
  }
};
```

### Error Types

Use predefined ErrorCode enum:

```typescript
// ✅ Standard error codes
enum ErrorCode {
  Unknown = "unknown",
  S3ClientError = "s3_client_error",
  S3CredentialsError = "s3_credentials_error",
  FileNotFoundError = "file_not_found_error",
}

interface StorageError {
  code: ErrorCode;
}
```

## S3 Client Configuration

### Environment Variables

All configuration from environment variables:

```typescript
// ✅ Required variables
export const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
export const S3_SECRET_KEY = process.env.S3_SECRET_KEY;
export const S3_REGION = process.env.S3_REGION;
export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
export const S3_ENDPOINT_URL = process.env.S3_ENDPOINT_URL;
export const S3_FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE === "1";
```

### Client Creation

Use factory pattern with Result type:

```typescript
// ✅ Factory function
export const createS3ClientFromEnv = (): Result<S3Client, StorageError> => {
  // Validate credentials
  if (!S3_ACCESS_KEY || !S3_SECRET_KEY || !S3_BUCKET_NAME || !S3_REGION) {
    return err({ code: ErrorCode.S3CredentialsError });
  }

  const s3ClientInstance = new S3Client({
    credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
    region: S3_REGION,
    endpoint: S3_ENDPOINT_URL,
    forcePathStyle: S3_FORCE_PATH_STYLE,
  });

  return ok(s3ClientInstance);
};

// ✅ Module-level client instance
const s3Client = createS3Client();
// ✅ Module-level client instance (optional)
let s3Client: S3Client | null = null;
const clientResult = createS3ClientFromEnv();
if (clientResult.ok) {
  s3Client = clientResult.value;
} else {
  // handle or log configuration error here
  s3Client = null;
}
```

## Service Function Patterns

### Standard Function Structure

```typescript
/**
 * Function description
 * @param param - Parameter description
 * @returns Result containing data or StorageError
 */
export const functionName = async (param: string): Promise<Result<Data, StorageError>> => {
  try {
    // Client validation
    if (!s3Client) {
      return err({ code: ErrorCode.S3ClientError });
    }

    if (!S3_BUCKET_NAME) {
      return err({ code: ErrorCode.S3CredentialsError });
    }

    // AWS SDK operation
    const command = new SomeCommand({ Bucket: S3_BUCKET_NAME /* params */ });
    const response = await s3Client.send(command);

    return ok(response);
  } catch (error) {
    logger.error({ error }, "Operation failed");
    return err({ code: ErrorCode.Unknown });
  }
};
```

### Bulk Operations Pattern

For operations requiring pagination and batch processing:

```typescript
// ✅ Use pagination and batching for bulk operations
export const deleteFilesByPrefix = async (prefix: string): Promise<Result<void, StorageError>> => {
  try {
    // Standard validation
    if (!s3Client || !S3_BUCKET_NAME) {
      return err({ code: ErrorCode.S3ClientError });
    }

    // Collect keys with pagination
    const keys: { Key: string }[] = [];
    const paginator = paginateListObjectsV2({ client: s3Client }, { Bucket: S3_BUCKET_NAME, Prefix: prefix });

    for await (const page of paginator) {
      const pageKeys = page.Contents?.flatMap((obj) => (obj.Key ? [{ Key: obj.Key }] : [])) ?? [];
      keys.push(...pageKeys);
    }

    if (keys.length === 0) {
      return ok(undefined);
    }

    // Batch deletions (max 1000 per batch)
    const deletionPromises: Promise<DeleteObjectsCommandOutput>[] = [];

    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: S3_BUCKET_NAME,
        Delete: { Objects: batch },
      });
      deletionPromises.push(s3Client.send(deleteCommand));
    }

    // Process all batches concurrently
    const results = await Promise.all(deletionPromises);

    // Log partial failures
    let totalErrors = 0;
    for (const result of results) {
      if (result.Errors?.length) {
        totalErrors += result.Errors.length;
        logger.error({ errors: result.Errors }, "Some objects failed to delete");
      }
    }

    if (totalErrors > 0) {
      logger.warn({ totalErrors }, "Bulk delete completed with some failures");
    }

    return ok(undefined);
  } catch (error) {
    logger.error({ error }, "Failed to delete files by prefix");
    return err({ code: ErrorCode.Unknown });
  }
};
```

## AWS SDK v3 Patterns

### Command Usage

```typescript
// ✅ Import specific commands
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  paginateListObjectsV2,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Single file operations
const deleteCommand = new DeleteObjectCommand({
  Bucket: S3_BUCKET_NAME,
  Key: fileKey,
});

// Bulk operations
const deleteObjectsCommand = new DeleteObjectsCommand({
  Bucket: S3_BUCKET_NAME,
  Delete: { Objects: batchKeys },
});

// Presigned URLs
const { url, fields } = await createPresignedPost(s3Client, {
  Bucket: S3_BUCKET_NAME,
  Key: filePath,
  Expires: 120, // 2 minutes
  Conditions: [["content-length-range", 0, maxSize]],
});
```

## Exports and Package Structure

### Selective Exports

```typescript
// ✅ packages/storage/src/index.ts - Only export public API
export { deleteFile, deleteFilesByPrefix, getSignedDownloadUrl, getSignedUploadUrl } from "./service";

export type { StorageError } from "./types/error";

// ❌ Don't export internals
// export { createS3Client } from "./client";
// export { S3_BUCKET_NAME } from "./constants";
```

### Dependencies

```json
// ✅ Specific AWS SDK packages
"dependencies": {
  "@aws-sdk/client-s3": "3.864.0",
  "@aws-sdk/s3-presigned-post": "3.864.0",
  "@aws-sdk/s3-request-presigner": "3.864.0",
  "@formbricks/logger": "workspace:*"
}
```

## Testing Patterns

### Environment Mocking

```typescript
// ✅ Test setup
beforeEach(() => {
  vi.stubEnv("S3_ACCESS_KEY", "test-key");
  vi.stubEnv("S3_SECRET_KEY", "test-secret");
  vi.stubEnv("S3_REGION", "us-east-1");
  vi.stubEnv("S3_BUCKET_NAME", "test-bucket");
});

afterEach(() => {
  vi.unstubAllEnvs();
});
```

### AWS SDK Mocking

```typescript
// ✅ Mock AWS SDK commands
const mockS3Client = {
  send: vi.fn(),
};

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => mockS3Client),
  DeleteObjectCommand: vi.fn(),
  DeleteObjectsCommand: vi.fn(),
}));
```

## Logging Standards

Use Formbricks logger with appropriate context:

```typescript
// ✅ Error logging
logger.error({ error, fileKey }, "Failed to delete file");

// ✅ Warning for partial failures
logger.warn({ totalErrors, totalDeleted }, "Bulk delete completed with failures");

// ✅ Debug for detailed info
logger.debug({ count: result.Deleted?.length }, "Successfully deleted batch");
```

## Common Patterns

### File Existence Check

```typescript
// ✅ Check file exists before operations
const headObjectCommand = new HeadObjectCommand({
  Bucket: S3_BUCKET_NAME,
  Key: fileKey,
});

try {
  await s3Client.send(headObjectCommand);
} catch (error) {
  if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
    return err({ code: ErrorCode.FileNotFoundError });
  }
}
```

### Batch Processing

```typescript
// ✅ Process large datasets in batches
const BATCH_SIZE = 1000; // S3 delete limit
for (let i = 0; i < items.length; i += BATCH_SIZE) {
  const batch = items.slice(i, i + BATCH_SIZE);
  // Process batch
}
```

### Concurrent Operations

```typescript
// ✅ Use Promise.all for concurrent operations
const promises = batches.map((batch) => processBatch(batch));
const results = await Promise.all(promises);
```

## Usage Guidelines

When consuming the storage package:

```typescript
// ✅ Import and handle results properly
import { deleteFilesByPrefix, deleteFile } from "@formbricks/storage";

const result = await deleteFilesByPrefix("surveys/123/");
if (!result.ok) {
  logger.error({ error: result.error }, "Failed to delete survey files");
  return; // Handle error appropriately
}

// Operation successful
```

Remember: Always validate S3 client availability, use Result types consistently, handle partial failures in bulk operations, and follow batch processing patterns for large datasets.
