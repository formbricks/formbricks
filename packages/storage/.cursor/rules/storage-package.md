# Storage Package Rules for Formbricks

## Package Overview

The `@formbricks/storage` package provides S3-compatible cloud storage functionality for Formbricks. It's a standalone TypeScript library that handles file uploads, downloads, and deletions with comprehensive error handling and type safety.

## Key Files

### Core Storage Infrastructure

- [packages/storage/src/service.ts](mdc:packages/storage/src/service.ts) - Main storage service with S3 operations
- [packages/storage/src/client.ts](mdc:packages/storage/src/client.ts) - S3 client creation and configuration
- [packages/storage/src/constants.ts](mdc:packages/storage/src/constants.ts) - Environment variable exports
- [packages/storage/src/types/error.ts](mdc:packages/storage/src/types/error.ts) - Result type system and error definitions
- [packages/storage/src/index.ts](mdc:packages/storage/src/index.ts) - Package exports

### Configuration Files

- [packages/storage/package.json](mdc:packages/storage/package.json) - Package configuration with AWS SDK dependencies
- [packages/storage/vite.config.ts](mdc:packages/storage/vite.config.ts) - Build configuration for library bundling
- [packages/storage/tsconfig.json](mdc:packages/storage/tsconfig.json) - TypeScript configuration

## Architecture Patterns

### Package Structure

```
packages/storage/
├── src/
│   ├── client.ts          # S3 client creation and configuration
│   ├── service.ts         # Core storage operations (upload, download, delete)
│   ├── constants.ts       # Environment variable exports
│   ├── index.ts          # Package exports
│   ├── types/
│   │   └── error.ts      # Result type system and error definitions
│   ├── *.test.ts         # Unit tests for each module
└── dist/                 # Built library output
```

### Result Type System

All storage operations use a Result type pattern for comprehensive error handling:

```typescript
// ✅ Use Result<T, E> for all async operations
export const storageOperation = async (): Promise<
  Result<SuccessData, UnknownError | S3CredentialsError | S3ClientError>
> => {
  try {
    // Implementation
    return ok(data);
  } catch (error) {
    logger.error("Operation failed", { error });
    return err({
      code: "unknown",
      message: "Operation failed",
    });
  }
};

// ✅ Handle Results properly in calling code
const result = await storageOperation();
if (!result.ok) {
  // Handle error
  return result; // Propagate error
}
// Use result.data
```

### Error Type Definitions

Always use the predefined error types:

```typescript
// ✅ Standard error types
interface UnknownError {
  code: "unknown";
  message: string;
}

interface S3CredentialsError {
  code: "s3_credentials_error";
  message: string;
}

interface S3ClientError {
  code: "s3_client_error";
  message: string;
}

// ✅ Use ok() and err() utility functions
return ok(successData);
return err({ code: "s3_client_error", message: "Failed to connect" });
```

## S3 Client Patterns

### Environment Configuration

All S3 configuration comes from environment variables:

```typescript
// ✅ Export environment variables from constants.ts
export const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
export const S3_SECRET_KEY = process.env.S3_SECRET_KEY;
export const S3_REGION = process.env.S3_REGION;
export const S3_ENDPOINT_URL = process.env.S3_ENDPOINT_URL;
export const S3_FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE === "1";
export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;

// ✅ Validate required environment variables
if (!S3_ACCESS_KEY || !S3_SECRET_KEY || !S3_BUCKET_NAME || !S3_REGION) {
  return err({
    code: "s3_credentials_error",
    message: "S3 credentials are not set",
  });
}
```

### Client Creation Pattern

Use the factory pattern for S3 client creation:

```typescript
// ✅ Factory function with Result type
export const createS3ClientFromEnv = (): Result<S3Client, S3CredentialsError | UnknownError> => {
  try {
    // Validation and client creation
    const s3ClientInstance = new S3Client({
      credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
      region: S3_REGION,
      endpoint: S3_ENDPOINT_URL,
      forcePathStyle: S3_FORCE_PATH_STYLE,
    });

    return ok(s3ClientInstance);
  } catch (error) {
    logger.error("Error creating S3 client", { error });
    return err({ code: "unknown", message: "Error creating S3 client" });
  }
};

// ✅ Wrapper function for fallback handling
export const createS3Client = (): S3Client | undefined => {
  const result = createS3ClientFromEnv();
  return result.ok ? result.data : undefined;
};
```

## Service Function Patterns

### Function Signature Standards

All service functions follow consistent patterns:

```typescript
// ✅ Comprehensive TSDoc comments
/**
 * Get a signed URL for uploading a file to S3
 * @param fileName - The name of the file to upload
 * @param contentType - The content type of the file
 * @param filePath - The path to the file in S3
 * @param maxSize - Maximum file size allowed (optional)
 * @returns A Result containing the signed URL and presigned fields or an error
 */
export const getSignedUploadUrl = async (
  fileName: string,
  contentType: string,
  filePath: string,
  maxSize?: number
): Promise<
  Result<
    {
      signedUrl: string;
      presignedFields: PresignedPostOptions["Fields"];
    },
    UnknownError | S3CredentialsError | S3ClientError
  >
> => {
  // Implementation
};
```

### Error Handling Patterns

Always validate inputs and handle S3 client errors:

```typescript
// ✅ Standard validation and error handling
export const storageFunction = async (param: string): Promise<Result<Data, Errors>> => {
  try {
    // Client validation
    if (!s3Client) {
      logger.error("S3 client is not available");
      return err({
        code: "s3_credentials_error",
        message: "S3 credentials are not set",
      });
    }

    // AWS SDK operations with error handling
    const command = new SomeS3Command({
      /* params */
    });
    const response = await s3Client.send(command);

    return ok(response);
  } catch (error) {
    logger.error("S3 operation failed", { error, param });

    // Categorize errors appropriately
    if (error.name === "CredentialsError") {
      return err({
        code: "s3_credentials_error",
        message: "Invalid S3 credentials",
      });
    }

    return err({
      code: "s3_client_error",
      message: `S3 operation failed: ${error.message}`,
    });
  }
};
```

## Testing Standards

### Test File Organization

Each source file should have a corresponding test file:

```typescript
// ✅ Test file naming: [module].test.ts
// packages/storage/src/client.test.ts
// packages/storage/src/service.test.ts
// packages/storage/src/constants.test.ts

// ✅ Test structure
describe("Storage Client", () => {
  describe("createS3ClientFromEnv", () => {
    it("should create S3 client with valid credentials", () => {
      // Test implementation
    });

    it("should return error with missing credentials", () => {
      // Test implementation
    });
  });
});
```

### Mock Environment Variables

Always mock environment variables in tests:

```typescript
// ✅ Mock environment setup
beforeEach(() => {
  vi.stubEnv("S3_ACCESS_KEY", "test-access-key");
  vi.stubEnv("S3_SECRET_KEY", "test-secret-key");
  vi.stubEnv("S3_REGION", "us-east-1");
  vi.stubEnv("S3_BUCKET_NAME", "test-bucket");
});

afterEach(() => {
  vi.unstubAllEnvs();
});
```

## Build Configuration

### Vite Library Setup

Configure vite for library bundling with external dependencies:

```typescript
// ✅ vite.config.ts pattern
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "formbricksStorage",
      fileName: "index",
      formats: ["es", "cjs"], // Both ESM and CommonJS
    },
    rollupOptions: {
      // Externalize AWS SDK and Formbricks dependencies
      external: [
        "@aws-sdk/client-s3",
        "@aws-sdk/s3-presigned-post",
        "@aws-sdk/s3-request-presigner",
        "@formbricks/logger",
      ],
    },
  },
  test: {
    environment: "node",
    globals: true,
    coverage: {
      reporter: ["text", "json", "html", "lcov"],
      exclude: ["src/types/**"], // Exclude type definitions
      include: ["src/**/*.ts"],
    },
  },
  plugins: [dts({ rollupTypes: true })], // Generate type declarations
});
```

### Package.json Configuration

Essential package.json fields for the storage library:

```json
{
  "exports": {
    "import": "./dist/index.js",
    "require": "./dist/index.cjs",
    "types": "./dist/index.d.ts"
  },
  "files": ["dist"],
  "main": "./dist/index.js",
  "name": "@formbricks/storage",
  "private": true,
  "scripts": {
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  },
  "type": "module",
  "types": "./dist/index.d.ts"
}
```

## AWS SDK Integration

### Dependency Management

Use specific AWS SDK packages, not the umbrella package:

```json
// ✅ Specific AWS SDK dependencies
"dependencies": {
  "@aws-sdk/client-s3": "3.864.0",
  "@aws-sdk/s3-presigned-post": "3.864.0",
  "@aws-sdk/s3-request-presigner": "3.864.0"
}

// ❌ Don't use umbrella package
"dependencies": {
  "aws-sdk": "..." // Too large and unnecessary
}
```

### Command Patterns

Use the AWS SDK v3 command pattern:

```typescript
// ✅ AWS SDK v3 command pattern
import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Delete operation
const deleteCommand = new DeleteObjectCommand({
  Bucket: S3_BUCKET_NAME,
  Key: filePath,
});
await s3Client.send(deleteCommand);

// Presigned URL for download
const getCommand = new GetObjectCommand({
  Bucket: S3_BUCKET_NAME,
  Key: filePath,
});
const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

// Presigned POST for upload
const { url, fields } = await createPresignedPost(s3Client, {
  Bucket: S3_BUCKET_NAME,
  Key: filePath,
  Conditions: [
    ["content-length-range", 0, maxSize || DEFAULT_MAX_SIZE],
    ["eq", "$Content-Type", contentType],
  ],
  Expires: 3600,
});
```

## Export Patterns

### Selective Exports

Only export the main service functions:

```typescript
// ✅ packages/storage/src/index.ts
export { deleteFile, getSignedDownloadUrl, getSignedUploadUrl } from "./service";

// ❌ Don't export internal utilities
// export { createS3Client } from "./client"; // Internal only
// export { S3_BUCKET_NAME } from "./constants"; // Internal only
```

### Type Exports

Export types that consumers might need:

```typescript
// ✅ Export relevant types if needed by consumers
export type { Result, UnknownError, S3CredentialsError, S3ClientError } from "./types/error";
```

## Logging Standards

### Use Formbricks Logger

Always use the Formbricks logger for consistency:

```typescript
// ✅ Import and use Formbricks logger
import { logger } from "@formbricks/logger";

// Error logging with context
logger.error("S3 operation failed", {
  operation: "upload",
  fileName,
  error: error.message,
});

// Warning for recoverable issues
logger.warn("S3 client fallback used", { reason: "credentials_error" });
```

### Logging Levels

Use appropriate logging levels:

```typescript
// ✅ Error for failures that need attention
logger.error("Critical S3 operation failed", { error });

// ✅ Warn for recoverable issues
logger.warn("S3 credentials not set, client unavailable");

// ✅ Debug for development (avoid in production)
logger.debug("S3 operation successful", { operation, duration });

// ❌ Avoid info logging for routine operations
// logger.info("File uploaded successfully"); // Too verbose
```

## Common Pitfalls to Avoid

1. **Don't expose internal implementation details** - Keep client creation and constants internal
2. **Always validate S3 client availability** - Check for undefined client before operations
3. **Use specific error types** - Don't use generic Error objects
4. **Handle AWS SDK errors appropriately** - Categorize errors by type
5. **Don't hardcode S3 configuration** - Always use environment variables
6. **Include comprehensive TSDoc** - Document all parameters and return types
7. **Test error scenarios** - Test both success and failure cases
8. **Use Result types consistently** - Never throw exceptions in service functions
9. **Version pin AWS SDK dependencies** - Avoid breaking changes from updates
10. **Keep package.json focused** - Only include necessary dependencies and scripts

## Environment Variables

### Required Variables

The storage package requires these environment variables:

```bash
# ✅ Required S3 configuration
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name

# ✅ Optional S3 configuration
S3_ENDPOINT_URL=https://s3.amazonaws.com  # For custom endpoints
S3_FORCE_PATH_STYLE=1                     # For minio/localstack compatibility
```

### Validation Strategy

Always validate required environment variables at startup:

```typescript
// ✅ Fail fast on missing required variables
const requiredVars = [S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_NAME, S3_REGION];
const missingVars = requiredVars.filter(v => !v);

if (missingVars.length > 0) {
  return err({
    code: "s3_credentials_error",
    message: "Required S3 environment variables are not set",
  });
}
```

## Performance Considerations

### S3 Client Reuse

Create S3 client once and reuse:

```typescript
// ✅ Single client instance
const s3Client = createS3Client(); // Created once at module level

// ✅ Reuse in all operations
export const uploadFile = async () => {
  if (!s3Client) return err(/* credentials error */);
  // Use s3Client
};

// ❌ Don't create new clients for each operation
export const uploadFile = async () => {
  const client = createS3Client(); // Inefficient
};
```

### Presigned URL Expiration

Use appropriate expiration times:

```typescript
// ✅ Reasonable expiration times
const UPLOAD_URL_EXPIRY = 3600; // 1 hour for uploads
const DOWNLOAD_URL_EXPIRY = 3600; // 1 hour for downloads

// ❌ Don't use excessively long expiration
const LONG_EXPIRY = 86400 * 7; // 7 days - security risk
```

## Security Best Practices

### File Upload Validation

Always validate file uploads with appropriate conditions:

```typescript
// ✅ Comprehensive upload conditions
const conditions = [
  ["content-length-range", 0, maxSize || DEFAULT_MAX_SIZE],
  ["eq", "$Content-Type", contentType],
  ["starts-with", "$key", filePath], // Restrict upload path
];

// ✅ Validate content type
if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
  return err({
    code: "validation_error",
    message: "Invalid content type",
  });
}
```

### Error Message Safety

Don't expose sensitive information in error messages:

```typescript
// ✅ Safe error messages
return err({
  code: "s3_client_error",
  message: "File operation failed", // Generic message
});

// ❌ Don't expose internal details
return err({
  code: "s3_client_error",
  message: `AWS Error: ${awsError.message}`, // May contain sensitive info
});
```

## Integration Guidelines

### Usage in Other Packages

When using the storage package in other Formbricks packages:

```typescript
// ✅ Import specific functions
import { deleteFile, getSignedUploadUrl } from "@formbricks/storage";

// ✅ Handle Result types properly
const uploadResult = await getSignedUploadUrl(fileName, contentType, filePath);
if (!uploadResult.ok) {
  // Handle error appropriately
  throw new Error(uploadResult.error.message);
}

// Use uploadResult.data
const { signedUrl, presignedFields } = uploadResult.data;
```

### Dependency Declaration

Add storage package as workspace dependency:

```json
// ✅ In dependent package's package.json
"dependencies": {
  "@formbricks/storage": "workspace:*"
}
```

Remember: The storage package is designed to be a self-contained, reusable library that provides type-safe S3 operations with comprehensive error handling. Follow these patterns to maintain consistency and reliability across the Formbricks storage infrastructure.
