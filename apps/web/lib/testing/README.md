# Testing Utilities — Tutorial

Practical utilities to write cleaner, faster, more consistent unit tests.

## Quick Start

```typescript
import { describe, expect, test } from "vitest";
import { vi } from "vitest";
import { FIXTURES, TEST_IDS } from "@/lib/testing/constants";
import { COMMON_ERRORS, createContactsMocks } from "@/lib/testing/mocks";
import { setupTestEnvironment } from "@/lib/testing/setup";

// Setup standard test environment
setupTestEnvironment();
vi.mock("@formbricks/database", () => createContactsMocks());

describe("ContactService", () => {
  test("should find a contact", async () => {
    vi.mocked(prisma.contact.findUnique).mockResolvedValue(FIXTURES.contact);

    const result = await getContact(TEST_IDS.contact);

    expect(result).toEqual(FIXTURES.contact);
  });
});
```

---

## Concept 1: TEST_IDs — Use Constants, Not Magic Strings

### The Problem

Scattered magic strings make tests hard to maintain:

```typescript
// ❌ Don't do this
describe("getContact", () => {
  test("should find contact", async () => {
    const contactId = "contact-123";
    const userId = "user-456";
    const environmentId = "env-789";

    const result = await getContact(contactId);
    expect(result.userId).toBe(userId);
  });

  test("should handle missing contact", async () => {
    const contactId = "contact-123"; // Same ID, defined again
    await expect(getContact(contactId)).rejects.toThrow();
  });
});
```

### The Solution

Use TEST_IDs for consistent, reusable identifiers:

```typescript
// ✅ Do this
import { TEST_IDS } from "@/lib/testing/constants";

describe("getContact", () => {
  test("should find contact", async () => {
    const result = await getContact(TEST_IDS.contact);
    expect(result.userId).toBe(TEST_IDS.user);
  });

  test("should handle missing contact", async () => {
    await expect(getContact(TEST_IDS.contact)).rejects.toThrow();
  });
});
```

**Available IDs:**

```
TEST_IDS.contact, contactAlt, user, environment, survey, organization, quota,
attribute, response, team, project, segment, webhook, apiKey, membership
```

---

## Concept 2: FIXTURES — Use Pre-built Test Data

### The Problem

Duplicated mock data across tests:

```typescript
// ❌ Don't do this
describe("ContactService", () => {
  test("should validate contact email", async () => {
    const contact = {
      id: "contact-1",
      email: "test@example.com",
      userId: "user-1",
      environmentId: "env-1",
      createdAt: new Date("2024-01-01"),
    };
    expect(isValidEmail(contact.email)).toBe(true);
  });

  test("should create contact from data", async () => {
    const contact = {
      id: "contact-1",
      email: "test@example.com",
      userId: "user-1",
      environmentId: "env-1",
      createdAt: new Date("2024-01-01"),
    };
    const result = await createContact(contact);
    expect(result).toEqual(contact);
  });
});
```

### The Solution

Use FIXTURES for consistent test data:

```typescript
// ✅ Do this
import { FIXTURES } from "@/lib/testing/constants";

describe("ContactService", () => {
  test("should validate contact email", async () => {
    expect(isValidEmail(FIXTURES.contact.email)).toBe(true);
  });

  test("should create contact from data", async () => {
    const result = await createContact(FIXTURES.contact);
    expect(result).toEqual(FIXTURES.contact);
  });
});
```

**Available fixtures:** contact, survey, attributeKey, environment, organization, project, team, user, response

---

## Concept 3: setupTestEnvironment — Standard Cleanup

### The Problem

Inconsistent beforeEach/afterEach patterns across tests:

```typescript
// ❌ Don't do this
describe("module A", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
  // tests...
});

describe("module B", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });
  // tests...
});
```

### The Solution

Use setupTestEnvironment() for consistent cleanup:

```typescript
// ✅ Do this
import { setupTestEnvironment } from "@/lib/testing/setup";

setupTestEnvironment();

describe("module", () => {
  test("should work", () => {
    // Cleanup is automatic
  });
});
```

**What it does:**

- Clears all mocks before and after each test
- Provides consistent test isolation
- One line replaces repetitive setup code

---

## Concept 4: Mock Factories — Reduce Mock Setup from 40+ Lines to 1

### The Problem

Massive repetitive mock setup:

```typescript
// ❌ Don't do this (40+ lines)
vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    contactAttribute: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    contactAttributeKey: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));
```

### The Solution

Use mock factories:

```typescript
// ✅ Do this (1 line)
import { createContactsMocks } from "@/lib/testing/mocks";

vi.mock("@formbricks/database", () => createContactsMocks());
```

**Available factories:**

- `createContactsMocks()` — Contact operations (contact, contactAttribute, contactAttributeKey)
- `createQuotasMocks()` — Quota operations
- `createSurveysMocks()` — Survey and response operations

### Error Testing with Mock Factories

**Use COMMON_ERRORS for standardized error tests:**

```typescript
// ❌ Don't do this (10+ lines per error)
const error = new Prisma.PrismaClientKnownRequestError("Not found", {
  code: "P2025",
  clientVersion: "5.0.0",
});
vi.mocked(prisma.contact.findUnique).mockRejectedValue(error);

await expect(getContact("invalid")).rejects.toThrow();
```

```typescript
// ✅ Do this (1 line)
import { COMMON_ERRORS } from "@/lib/testing/mocks";

vi.mocked(prisma.contact.findUnique).mockRejectedValue(COMMON_ERRORS.RECORD_NOT_FOUND);

await expect(getContact("invalid")).rejects.toThrow();
```

**Available errors:**

```
COMMON_ERRORS.UNIQUE_CONSTRAINT       // P2002
COMMON_ERRORS.RECORD_NOT_FOUND        // P2025
COMMON_ERRORS.FOREIGN_KEY             // P2003
COMMON_ERRORS.REQUIRED_RELATION       // P2014
COMMON_ERRORS.DATABASE_ERROR          // P5000
```

### Transaction Testing with Mock Factories

**Use createMockTransaction() for complex database transactions:**

```typescript
// ❌ Don't do this (25+ lines)
vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(async (cb) => {
      return cb({
        responseQuotaLink: {
          deleteMany: vi.fn(),
          createMany: vi.fn(),
          updateMany: vi.fn(),
        },
      });
    }),
  },
}));
```

```typescript
// ✅ Do this (3 lines)
import { createMockTransaction, mockPrismaTransaction } from "@/lib/testing/mocks";

const mockTx = createMockTransaction({
  responseQuotaLink: ["deleteMany", "createMany", "updateMany"],
});
vi.mocked(prisma.$transaction) = mockPrismaTransaction(mockTx);
```

---

## Real-World Example: Efficient Test Suite

Here's how the utilities work together to write clean, efficient tests:

```typescript
import { describe, expect, test } from "vitest";
import { vi } from "vitest";
import { FIXTURES, TEST_IDS } from "@/lib/testing/constants";
import { COMMON_ERRORS, createContactsMocks } from "@/lib/testing/mocks";
import { setupTestEnvironment } from "@/lib/testing/setup";

setupTestEnvironment();
vi.mock("@formbricks/database", () => createContactsMocks());

describe("ContactService", () => {
  describe("getContact", () => {
    test("should fetch contact successfully", async () => {
      vi.mocked(prisma.contact.findUnique).mockResolvedValue(FIXTURES.contact);

      const result = await getContact(TEST_IDS.contact);

      expect(result).toEqual(FIXTURES.contact);
      expect(prisma.contact.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_IDS.contact },
      });
    });

    test("should handle contact not found", async () => {
      vi.mocked(prisma.contact.findUnique).mockRejectedValue(COMMON_ERRORS.RECORD_NOT_FOUND);

      await expect(getContact(TEST_IDS.contact)).rejects.toThrow();
    });
  });

  describe("createContact", () => {
    test("should create contact with valid data", async () => {
      vi.mocked(prisma.contact.create).mockResolvedValue(FIXTURES.contact);

      const result = await createContact({
        email: FIXTURES.contact.email,
        environmentId: TEST_IDS.environment,
      });

      expect(result).toEqual(FIXTURES.contact);
    });

    test("should reject duplicate email", async () => {
      vi.mocked(prisma.contact.create).mockRejectedValue(COMMON_ERRORS.UNIQUE_CONSTRAINT);

      await expect(
        createContact({ email: "duplicate@test.com", environmentId: TEST_IDS.environment })
      ).rejects.toThrow();
    });
  });

  describe("deleteContact", () => {
    test("should delete contact and return void", async () => {
      vi.mocked(prisma.contact.delete).mockResolvedValue(undefined);

      await deleteContact(TEST_IDS.contact);

      expect(prisma.contact.delete).toHaveBeenCalledWith({
        where: { id: TEST_IDS.contact },
      });
    });
  });
});
```

---

## How to Use — Import Options

### Option 1: From vitestSetup (Recommended)

```typescript
import { COMMON_ERRORS, FIXTURES, TEST_IDS, createContactsMocks, setupTestEnvironment } from "@/vitestSetup";
```

### Option 2: Direct Imports

```typescript
import { FIXTURES, TEST_IDS } from "@/lib/testing/constants";
import { COMMON_ERRORS, createContactsMocks } from "@/lib/testing/mocks";
import { setupTestEnvironment } from "@/lib/testing/setup";
```

---

## File Structure

```
apps/web/lib/testing/
├── constants.ts         — TEST_IDS & FIXTURES
├── setup.ts            — setupTestEnvironment()
└── mocks/              — Mock factories & error utilities
    ├── database.ts     — createContactsMocks(), etc.
    ├── errors.ts       — COMMON_ERRORS, error factories
    ├── transactions.ts — Transaction helpers
    └── index.ts        — Exports everything
```

---

## Summary: What Each Concept Solves

| Concept                    | Problem                                  | Solution                    |
| -------------------------- | ---------------------------------------- | --------------------------- |
| **TEST_IDs**               | Magic strings scattered everywhere       | One constant per concept    |
| **FIXTURES**               | Duplicate test data in every test        | Pre-built, reusable objects |
| **setupTestEnvironment()** | Inconsistent cleanup patterns            | One standard setup          |
| **Mock Factories**         | 20-40 lines of boilerplate per test file | 1 line mock setup           |

---

## Do's and Don'ts

### ✅ Do's

- Use `TEST_IDS.*` instead of hardcoded strings
- Use `FIXTURES.*` for standard test objects
- Call `setupTestEnvironment()` at the top of your test file
- Use `createContactsMocks()` instead of manually mocking prisma
- Use `COMMON_ERRORS.*` for standard error scenarios
- Import utilities from `@/vitestSetup` for convenience

### ❌ Don'ts

- Don't create magic string IDs in tests
- Don't duplicate fixture objects across tests
- Don't manually write beforeEach/afterEach cleanup
- Don't manually construct Prisma error objects
- Don't duplicate long mock setup code
- Don't create custom mock structures when factories exist

---

## Need More Help?

- **Mock Factories** → See `mocks/database.ts`, `mocks/errors.ts`, `mocks/transactions.ts`
- **All Available Fixtures** → See `constants.ts`
- **Error Codes** → See `mocks/errors.ts` for all COMMON_ERRORS
