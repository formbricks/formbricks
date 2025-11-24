# Testing Utilities

Centralized testing utilities to reduce boilerplate and ensure consistency across test files.

## Quick Start

```typescript
import { describe, expect, test } from "vitest";
import { FIXTURES, TEST_IDS } from "@/lib/testing/constants";
import { setupTestEnvironment } from "@/lib/testing/setup";

// Setup standard test environment with cleanup
setupTestEnvironment();

describe("MyModule", () => {
  test("should use standard test IDs", () => {
    // Use TEST_IDS instead of magic strings
    const result = processContact(TEST_IDS.contact);
    expect(result).toBeDefined();
  });

  test("should use fixtures for test data", () => {
    // Use FIXTURES instead of defining data inline
    const result = validateEmail(FIXTURES.contact.email);
    expect(result).toBe(true);
  });
});
```

## Available Utilities

### TEST_IDS

Standard identifiers to eliminate magic strings in tests.

**Available IDs:**

- `contact`, `contactAlt`
- `user`
- `environment`
- `survey`
- `organization`
- `quota`
- `attribute`
- `response`
- `team`
- `project`
- `segment`
- `webhook`
- `apiKey`
- `membership`

**Before:**

```typescript
const contactId = "contact-1";
const envId = "env-123";
```

**After:**

```typescript
import { TEST_IDS } from "@/lib/testing/constants";

// Use TEST_IDS.contact and TEST_IDS.environment
```

### FIXTURES

Common test data structures to reduce duplication.

**Available fixtures:**

- `contact` - Basic contact object
- `survey` - Survey object
- `attributeKey` - Single attribute key
- `attributeKeys` - Array of attribute keys
- `responseData` - Sample response data
- `environment` - Environment object
- `organization` - Organization object
- `project` - Project object

**Before:**

```typescript
const mockContact = {
  id: "contact-1",
  email: "test@example.com",
  userId: "user-1",
};
```

**After:**

```typescript
import { FIXTURES } from "@/lib/testing/constants";

// Use FIXTURES.contact directly
```

### setupTestEnvironment()

Standardized test cleanup to replace manual beforeEach/afterEach blocks.

**Before:**

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});
```

**After:**

```typescript
import { setupTestEnvironment } from "@/lib/testing/setup";

setupTestEnvironment();
```

## Benefits

- **Consistency:** All tests use the same IDs and cleanup patterns
- **Maintainability:** Update IDs in one place instead of 200+ locations
- **Readability:** Less boilerplate, more test logic
- **Speed:** Write new tests faster with ready-to-use fixtures

## Migration Guide

### For New Tests

Use these utilities immediately in all new test files.

### For Existing Tests

Migrate opportunistically when editing existing tests. No forced migration required.

### Example Migration

**Before (60 lines with boilerplate):**

```typescript
import { beforeEach, describe, expect, test, vi } from "vitest";

const contactId = "contact-1";
const environmentId = "env-1";

describe("getContact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("fetches contact", async () => {
    const result = await getContact(contactId);
    expect(result).toBeDefined();
  });
});
```

**After (45 lines, cleaner):**

```typescript
import { describe, expect, test } from "vitest";
import { TEST_IDS } from "@/lib/testing/constants";
import { setupTestEnvironment } from "@/lib/testing/setup";

setupTestEnvironment();

describe("getContact", () => {
  test("fetches contact", async () => {
    const result = await getContact(TEST_IDS.contact);
    expect(result).toBeDefined();
  });
});
```
