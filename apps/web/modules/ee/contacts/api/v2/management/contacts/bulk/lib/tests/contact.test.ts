import { contactCache } from "@/lib/cache/contact";
import { contactAttributeCache } from "@/lib/cache/contact-attribute";
import { contactAttributeKeyCache } from "@/lib/cache/contact-attribute-key";
import { upsertBulkContacts } from "@/modules/ee/contacts/api/v2/management/contacts/bulk/lib/contact";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";

// Ensure that createId always returns "mock-id" for predictability
vi.mock("@paralleldrive/cuid2", () => ({
  createId: vi.fn(() => "mock-id"),
}));

// Mock prisma methods
vi.mock("@formbricks/database", () => ({
  prisma: {
    contactAttribute: {
      findMany: vi.fn(),
    },
    contactAttributeKey: {
      findMany: vi.fn(),
      createManyAndReturn: vi.fn(),
    },
    contact: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
    $executeRaw: vi.fn(),
  },
}));

// Mock cache functions
vi.mock("@/lib/cache/contact", () => ({
  contactCache: {
    revalidate: vi.fn(),
    tag: {
      byId: (id: string) => `contacts-${id}`,
      byEnvironmentId: (environmentId: string) => `environments-${environmentId}-contacts`,
    },
  },
}));

vi.mock("@/lib/cache/contact-attribute", () => ({
  contactAttributeCache: {
    revalidate: vi.fn(),
    tag: {
      byEnvironmentId: (environmentId: string) => `contactAttributes-${environmentId}`,
    },
  },
}));

vi.mock("@/lib/cache/contact-attribute-key", () => ({
  contactAttributeKeyCache: {
    revalidate: vi.fn(),
    tag: {
      byEnvironmentId: (environmentId: string) => `environments-${environmentId}-contactAttributeKeys`,
    },
  },
}));

describe("upsertBulkContacts", () => {
  const mockEnvironmentId = "env_123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should create new contacts when all provided contacts have unique user IDs and emails", async () => {
    // Mock data: two contacts with unique userId and email
    const mockContacts = [
      {
        attributes: [
          { attributeKey: { key: "email", name: "Email" }, value: "john@example.com" },
          { attributeKey: { key: "userId", name: "User ID" }, value: "user-123" },
          { attributeKey: { key: "name", name: "Name" }, value: "John Doe" },
        ],
      },
      {
        attributes: [
          { attributeKey: { key: "email", name: "Email" }, value: "jane@example.com" },
          { attributeKey: { key: "userId", name: "User ID" }, value: "user-456" },
          { attributeKey: { key: "name", name: "Name" }, value: "Jane Smith" },
        ],
      },
    ];

    const mockParsedEmails = ["john@example.com", "jane@example.com"];

    // Mock: no existing userIds in DB
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValueOnce([]);
    // Mock: all attribute keys already exist
    const mockAttributeKeys = [
      { id: "attr-key-email", key: "email", environmentId: mockEnvironmentId, name: "Email" },
      { id: "attr-key-userId", key: "userId", environmentId: mockEnvironmentId, name: "User ID" },
      { id: "attr-key-name", key: "name", environmentId: mockEnvironmentId, name: "Name" },
    ];
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValueOnce(mockAttributeKeys);
    // Mock: no existing contacts by email
    vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([]);

    // Execute the function
    const result = await upsertBulkContacts(mockContacts, mockEnvironmentId, mockParsedEmails);

    // Assert that the result is ok and data is as expected
    if (!result.ok) throw new Error("Expected result.ok to be true");
    expect(result.data).toEqual({ contactIdxWithConflictingUserIds: [] });

    // Verify that existing user IDs were checked
    expect(prisma.contactAttribute.findMany).toHaveBeenCalledWith({
      where: {
        attributeKey: {
          environmentId: mockEnvironmentId,
          key: "userId",
        },
        value: {
          in: ["user-123", "user-456"],
        },
      },
      select: { value: true },
    });

    // Verify that attribute keys were fetched
    expect(prisma.contactAttributeKey.findMany).toHaveBeenCalledWith({
      where: {
        key: { in: ["email", "userId", "name"] },
        environmentId: mockEnvironmentId,
      },
    });

    // Verify that existing contacts were looked up by email
    expect(prisma.contact.findMany).toHaveBeenCalledWith({
      where: {
        environmentId: mockEnvironmentId,
        attributes: {
          some: {
            attributeKey: { key: "email" },
            value: { in: mockParsedEmails },
          },
        },
      },
      select: {
        attributes: {
          select: {
            attributeKey: { select: { key: true } },
            createdAt: true,
            id: true,
            value: true,
          },
        },
        id: true,
      },
    });

    // Verify that new contacts were created in the transaction
    expect(prisma.contact.createMany).toHaveBeenCalledWith({
      data: [
        { id: "mock-id", environmentId: mockEnvironmentId },
        { id: "mock-id", environmentId: mockEnvironmentId },
      ],
    });

    // Verify that the raw SQL query was executed to upsert attributes
    expect(prisma.$executeRaw).toHaveBeenCalled();

    // Verify that caches were revalidated
    expect(contactCache.revalidate).toHaveBeenCalledWith({ environmentId: mockEnvironmentId });
    // Since two new contacts are created with same id "mock-id", expect at least one revalidation with id "mock-id"
    expect(contactCache.revalidate).toHaveBeenCalledWith({ id: "mock-id" });
    expect(contactAttributeKeyCache.revalidate).toHaveBeenCalledWith({ environmentId: mockEnvironmentId });
    expect(contactAttributeCache.revalidate).toHaveBeenCalledWith({ environmentId: mockEnvironmentId });
  });

  test("should update existing contacts when provided contacts match an existing email", async () => {
    // Mock data: a contact that exists in the DB
    const mockContacts = [
      {
        attributes: [
          { attributeKey: { key: "email", name: "Email" }, value: "john@example.com" },
          // No userId is provided so it should be treated as update
        ],
      },
    ];

    const mockParsedEmails = ["john@example.com"];

    // Mock: no existing userIds conflict
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValueOnce([]);
    // Mock: attribute keys for email exist
    const mockAttributeKeys = [
      { id: "attr-key-email", key: "email", environmentId: mockEnvironmentId, name: "Email" },
    ];
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValueOnce(mockAttributeKeys);
    // Mock: an existing contact with the same email
    vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([
      {
        id: "existing-contact-id",
        attributes: [
          {
            id: "existing-email-attr",
            attributeKey: { key: "email", name: "Email" },
            value: "john@example.com",
            createdAt: new Date("2023-01-01"),
          },
        ],
      },
    ]);

    // Execute the function
    const result = await upsertBulkContacts(mockContacts, mockEnvironmentId, mockParsedEmails);

    if (!result.ok) throw new Error("Expected result.ok to be true");
    expect(result.data).toEqual({ contactIdxWithConflictingUserIds: [] });
  });

  test("should return the indices of contacts with conflicting user IDs", async () => {
    // Mock data - mix of valid and conflicting contacts
    const mockContacts = [
      {
        // Contact 0: Valid contact with unique userId
        attributes: [
          { attributeKey: { key: "email", name: "Email" }, value: "john@example.com" },
          { attributeKey: { key: "userId", name: "User ID" }, value: "user-123" },
          { attributeKey: { key: "name", name: "Name" }, value: "John Doe" },
        ],
      },
      {
        // Contact 1: Conflicting contact (userId already exists)
        attributes: [
          { attributeKey: { key: "email", name: "Email" }, value: "jane@example.com" },
          { attributeKey: { key: "userId", name: "User ID" }, value: "existing-user-1" },
          { attributeKey: { key: "name", name: "Name" }, value: "Jane Smith" },
        ],
      },
      {
        // Contact 2: Valid contact with no userId
        attributes: [
          { attributeKey: { key: "email", name: "Email" }, value: "bob@example.com" },
          { attributeKey: { key: "name", name: "Name" }, value: "Bob Johnson" },
        ],
      },
      {
        // Contact 3: Conflicting contact (userId already exists)
        attributes: [
          { attributeKey: { key: "email", name: "Email" }, value: "alice@example.com" },
          { attributeKey: { key: "userId", name: "User ID" }, value: "existing-user-2" },
          { attributeKey: { key: "name", name: "Name" }, value: "Alice Brown" },
        ],
      },
    ];

    const mockParsedEmails = ["john@example.com", "jane@example.com", "bob@example.com", "alice@example.com"];

    // Mock existing user IDs - these will conflict with some of our contacts
    const mockExistingUserIds = [{ value: "existing-user-1" }, { value: "existing-user-2" }];
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValueOnce(mockExistingUserIds);

    // Mock attribute keys
    const mockAttributeKeys = [
      { id: "attr-key-email", key: "email", environmentId: mockEnvironmentId },
      { id: "attr-key-userId", key: "userId", environmentId: mockEnvironmentId },
      { id: "attr-key-name", key: "name", environmentId: mockEnvironmentId },
    ];
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValueOnce(mockAttributeKeys);

    // Mock existing contacts (none for this test case)
    vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([]);

    // Execute the function
    const result = await upsertBulkContacts(mockContacts, mockEnvironmentId, mockParsedEmails);

    if (result.ok) {
      // Assertions - verify that the function correctly identified contacts with conflicting user IDs
      expect(result.data.contactIdxWithConflictingUserIds).toEqual([1, 3]);

      // Verify that the function checked for existing user IDs
      expect(prisma.contactAttribute.findMany).toHaveBeenCalledWith({
        where: {
          attributeKey: {
            environmentId: mockEnvironmentId,
            key: "userId",
          },
          value: {
            in: ["user-123", "existing-user-1", "existing-user-2"],
          },
        },
        select: {
          value: true,
        },
      });

      // Verify that the function fetched attribute keys for the filtered contacts (without conflicting userIds)
      expect(prisma.contactAttributeKey.findMany).toHaveBeenCalled();

      // Verify that the function checked for existing contacts by email
      expect(prisma.contact.findMany).toHaveBeenCalledWith({
        where: {
          environmentId: mockEnvironmentId,
          attributes: {
            some: {
              attributeKey: { key: "email" },
              value: { in: mockParsedEmails },
            },
          },
        },
        select: {
          attributes: {
            select: {
              attributeKey: { select: { key: true } },
              createdAt: true,
              id: true,
              value: true,
            },
          },
          id: true,
        },
      });

      // Verify that only non-conflicting contacts were processed
      expect(prisma.contact.createMany).toHaveBeenCalledWith({
        data: [
          { id: "mock-id", environmentId: mockEnvironmentId },
          { id: "mock-id", environmentId: mockEnvironmentId },
        ],
      });

      // Verify that the transaction was executed
      expect(prisma.$transaction).toHaveBeenCalled();

      // Verify that caches were revalidated
      expect(contactCache.revalidate).toHaveBeenCalledWith({
        environmentId: mockEnvironmentId,
      });
      expect(contactAttributeKeyCache.revalidate).toHaveBeenCalledWith({
        environmentId: mockEnvironmentId,
      });
      expect(contactAttributeCache.revalidate).toHaveBeenCalledWith({
        environmentId: mockEnvironmentId,
      });
    }
  });

  test("should create missing attribute keys when they are not found in the database", async () => {
    // Mock data: contacts with attributes that include missing attribute keys
    const mockContacts = [
      {
        attributes: [
          { attributeKey: { key: "email", name: "Email" }, value: "john@example.com" },
          { attributeKey: { key: "newKey1", name: "New Key 1" }, value: "value1" },
        ],
      },
      {
        attributes: [
          { attributeKey: { key: "email", name: "Email" }, value: "jane@example.com" },
          { attributeKey: { key: "newKey2", name: "New Key 2" }, value: "value2" },
        ],
      },
    ];
    const mockParsedEmails = ["john@example.com", "jane@example.com"];

    // Mock: no existing user IDs
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValueOnce([]);
    // Mock: only "email" exists; new keys are missing
    const mockAttributeKeys = [
      { id: "attr-key-email", key: "email", environmentId: mockEnvironmentId, name: "Email" },
    ];

    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValueOnce(mockAttributeKeys);

    // Mock: creation of new attribute keys returns new keys
    const mockNewAttributeKeys = [
      { id: "attr-key-newKey1", key: "newKey1" },
      { id: "attr-key-newKey2", key: "newKey2" },
    ];
    vi.mocked(prisma.contactAttributeKey.createManyAndReturn).mockResolvedValueOnce(
      mockNewAttributeKeys as any
    );

    // Mock: no existing contacts for update
    vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([]);

    // Execute the function
    const result = await upsertBulkContacts(mockContacts, mockEnvironmentId, mockParsedEmails);

    if (!result.ok) throw new Error("Expected result.ok to be true");
    expect(result.data).toEqual({ contactIdxWithConflictingUserIds: [] });

    // Verify that attribute keys were fetched for all keys
    expect(prisma.contactAttributeKey.findMany).toHaveBeenCalledWith({
      where: {
        key: { in: ["email", "newKey1", "newKey2"] },
        environmentId: mockEnvironmentId,
      },
    });

    // Verify that missing attribute keys were created
    expect(prisma.contactAttributeKey.createManyAndReturn).toHaveBeenCalledWith({
      data: [
        { key: "newKey1", name: "New Key 1", environmentId: mockEnvironmentId },
        { key: "newKey2", name: "New Key 2", environmentId: mockEnvironmentId },
      ],
      select: { key: true, id: true },
      skipDuplicates: true,
    });

    // Verify that new contacts were created
    expect(prisma.contact.createMany).toHaveBeenCalledWith({
      data: [
        { id: "mock-id", environmentId: mockEnvironmentId },
        { id: "mock-id", environmentId: mockEnvironmentId },
      ],
    });

    // Verify that the raw SQL query was executed for inserting attributes
    expect(prisma.$executeRaw).toHaveBeenCalled();

    // Verify that caches were revalidated
    expect(contactAttributeKeyCache.revalidate).toHaveBeenCalledWith({
      environmentId: mockEnvironmentId,
    });
  });

  test("should update attribute key names when they change", async () => {
    // Mock data: a contact with an attribute that has a new name for an existing key
    const mockContacts = [
      {
        attributes: [
          { attributeKey: { key: "email", name: "Email" }, value: "john@example.com" },
          { attributeKey: { key: "name", name: "Full Name" }, value: "John Doe" }, // Changed name from "Name" to "Full Name"
        ],
      },
    ];

    const mockParsedEmails = ["john@example.com"];

    // Mock: no existing userIds conflict
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValueOnce([]);

    // Mock: attribute keys exist but with different names
    const mockAttributeKeys = [
      { id: "attr-key-email", key: "email", environmentId: mockEnvironmentId, name: "Email" },
      { id: "attr-key-name", key: "name", environmentId: mockEnvironmentId, name: "Name" }, // Original name
    ];
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValueOnce(mockAttributeKeys);

    // Mock: an existing contact
    vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([
      {
        id: "existing-contact-id",
        attributes: [
          {
            id: "existing-email-attr",
            attributeKey: { key: "email", name: "Email" },
            value: "john@example.com",
            createdAt: new Date("2023-01-01"),
          },
          {
            id: "existing-name-attr",
            attributeKey: { key: "name", name: "Name" },
            value: "John Doe",
            createdAt: new Date("2023-01-01"),
          },
        ],
      },
    ]);

    // Mock the transaction
    const mockTransaction = {
      contactAttributeKey: {
        createManyAndReturn: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({ id: "attr-key-name", key: "name", name: "Full Name" }),
      },
      contact: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      $executeRaw: vi.fn().mockResolvedValue({ count: 0 }),
    };

    vi.mocked(prisma.$transaction).mockImplementationOnce((callback) => {
      return callback(mockTransaction as any);
    });

    // Execute the function
    const result = await upsertBulkContacts(mockContacts, mockEnvironmentId, mockParsedEmails);

    if (!result.ok) throw new Error("Expected result.ok to be true");
    expect(result.data).toEqual({ contactIdxWithConflictingUserIds: [] });

    // Verify that the attribute key name was updated
    expect(mockTransaction.contactAttributeKey.update).toHaveBeenCalledWith({
      where: {
        key_environmentId: {
          key: "name",
          environmentId: mockEnvironmentId,
        },
      },
      data: { name: "Full Name" },
    });

    // Verify that caches were revalidated
    expect(contactAttributeKeyCache.revalidate).toHaveBeenCalledWith({
      environmentId: mockEnvironmentId,
    });
  });
});
