import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { upsertBulkContacts } from "@/modules/ee/contacts/api/v2/management/contacts/bulk/lib/contact";

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
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
  },
}));

describe("upsertBulkContacts", () => {
  const mockWorkspaceId = "workspace_123";
  const mockDirectory = { id: "directory_123", matchingKey: "email" as const };

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
      { id: "attr-key-email", key: "email", workspaceId: mockWorkspaceId, name: "Email" },
      { id: "attr-key-userId", key: "userId", workspaceId: mockWorkspaceId, name: "User ID" },
      { id: "attr-key-name", key: "name", workspaceId: mockWorkspaceId, name: "Name" },
    ];
    vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true }).mockResolvedValueOnce(
      mockAttributeKeys
    );
    // Mock: no existing contacts by email
    vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([]);

    // Execute the function
    const result = await upsertBulkContacts(mockContacts, mockWorkspaceId, mockDirectory);

    // Assert that the result is ok and data is as expected
    if (!result.ok) throw new Error("Expected result.ok to be true");
    expect(result.data).toEqual({ contactIdxWithConflictingUserIds: [] });

    // Verify that existing user IDs were checked
    expect(prisma.contactAttribute.findMany).toHaveBeenCalledWith({
      where: {
        attributeKey: { key: "userId", directoryId: "directory_123" },
        value: {
          in: ["user-123", "user-456"],
        },
      },
      select: { value: true },
    });

    // Verify that attribute keys were fetched
    expect(prisma.contactAttributeKey.findMany).toHaveBeenCalledWith({
      where: {
        directoryId: "directory_123",
        key: { in: ["email", "userId", "name"] },
      },
    });

    // Verify that existing contacts of the directory were looked up by email, oldest first
    expect(prisma.contact.findMany).toHaveBeenCalledWith({
      where: {
        directoryId: "directory_123",
        attributes: {
          some: {
            attributeKey: { key: "email", directoryId: "directory_123" },
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
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    // Inherits the app client's transaction budget rather than overriding it with a shorter one (ENG-3285).
    expect(vi.mocked(prisma.$transaction).mock.calls[0]).toHaveLength(1);

    // Verify that new contacts were created in the transaction
    expect(prisma.contact.createMany).toHaveBeenCalledWith({
      data: [
        { id: "mock-id", directoryId: "directory_123", workspaceId: mockWorkspaceId },
        { id: "mock-id", directoryId: "directory_123", workspaceId: mockWorkspaceId },
      ],
    });

    // Verify that the raw SQL query was executed to upsert attributes
    expect(prisma.$executeRaw).toHaveBeenCalled();
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

    // Mock: no existing userIds conflict
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValueOnce([]);
    // Mock: attribute keys for email exist
    const mockAttributeKeys = [
      { id: "attr-key-email", key: "email", workspaceId: mockWorkspaceId, name: "Email" },
    ];
    vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true }).mockResolvedValueOnce(
      mockAttributeKeys
    );
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
    ] as unknown as Awaited<ReturnType<typeof prisma.contact.findMany>>);

    // Execute the function
    const result = await upsertBulkContacts(mockContacts, mockWorkspaceId, mockDirectory);

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
    vi.mocked(prisma.contactAttribute.findMany, { partial: true, deep: true }).mockResolvedValueOnce(
      mockExistingUserIds
    );

    // Mock attribute keys
    const mockAttributeKeys = [
      { id: "attr-key-email", key: "email", workspaceId: mockWorkspaceId },
      { id: "attr-key-userId", key: "userId", workspaceId: mockWorkspaceId },
      { id: "attr-key-name", key: "name", workspaceId: mockWorkspaceId },
    ];
    vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true }).mockResolvedValueOnce(
      mockAttributeKeys
    );

    // Mock existing contacts (none for this test case)
    vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([]);

    // Execute the function
    const result = await upsertBulkContacts(mockContacts, mockWorkspaceId, mockDirectory);

    if (result.ok) {
      // Assertions - verify that the function correctly identified contacts with conflicting user IDs
      expect(result.data.contactIdxWithConflictingUserIds).toEqual([1, 3]);

      // Verify that the function checked for existing user IDs
      expect(prisma.contactAttribute.findMany).toHaveBeenCalledWith({
        where: {
          attributeKey: { key: "userId", directoryId: "directory_123" },
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
          directoryId: "directory_123",
          attributes: {
            some: {
              attributeKey: { key: "email", directoryId: "directory_123" },
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
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

      // Verify that only non-conflicting contacts were processed
      expect(prisma.contact.createMany).toHaveBeenCalledWith({
        data: [
          { id: "mock-id", directoryId: "directory_123", workspaceId: mockWorkspaceId },
          { id: "mock-id", directoryId: "directory_123", workspaceId: mockWorkspaceId },
        ],
      });

      // Verify that the transaction was executed
      expect(prisma.$transaction).toHaveBeenCalled();
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

    // Mock: no existing user IDs
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValueOnce([]);
    // Mock: only "email" exists; new keys are missing
    const mockAttributeKeys = [
      { id: "attr-key-email", key: "email", workspaceId: mockWorkspaceId, name: "Email" },
      { id: "attr-key-newKey1", key: "newKey1", workspaceId: mockWorkspaceId, name: "New Key 1" },
      { id: "attr-key-newKey2", key: "newKey2", workspaceId: mockWorkspaceId, name: "New Key 2" },
    ];

    vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true }).mockResolvedValueOnce(
      mockAttributeKeys
    );

    // Mock: no existing contacts for update
    vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([]);

    // Execute the function
    const result = await upsertBulkContacts(mockContacts, mockWorkspaceId, mockDirectory);

    // creation of new attribute keys now happens with a raw query
    // so we need to mock that
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { id: "attr-key-newKey1", key: "newKey1" },
      { id: "attr-key-newKey2", key: "newKey2" },
    ]);

    if (!result.ok) throw new Error("Expected result.ok to be true");
    expect(result.data).toEqual({ contactIdxWithConflictingUserIds: [] });

    // Verify that new contacts were created
    expect(prisma.contact.createMany).toHaveBeenCalledWith({
      data: [
        { id: "mock-id", directoryId: "directory_123", workspaceId: mockWorkspaceId },
        { id: "mock-id", directoryId: "directory_123", workspaceId: mockWorkspaceId },
      ],
    });

    // Verify that the raw SQL query was executed for inserting attributes
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  test("should return bad request when payload creates reserved future default keys", async () => {
    const mockContacts = [
      {
        attributes: [
          { attributeKey: { key: "email", name: "Email" }, value: "john@example.com" },
          { attributeKey: { key: "user_id", name: "User Id" }, value: "user-123" },
        ],
      },
    ];

    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true }).mockResolvedValueOnce([
      { id: "attr-key-email", key: "email", workspaceId: mockWorkspaceId, name: "Email" },
    ]);

    const result = await upsertBulkContacts(mockContacts, mockWorkspaceId, mockDirectory);
    expect(result.ok).toBe(false);
    expect(prisma.contact.createMany).not.toHaveBeenCalled();

    if (!result.ok) {
      expect(result.error).toStrictEqual({
        type: "bad_request",
        details: [
          {
            field: "attributes",
            issue:
              "Reserved attribute key(s): user_id. These keys are reserved for the v5.1 safe-identifier default attribute migration and cannot be created as custom attributes.",
          },
        ],
      });
    }
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

    // Mock: no existing userIds conflict
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValueOnce([]);

    // Mock: attribute keys exist but with different names
    const mockAttributeKeys = [
      { id: "attr-key-email", key: "email", workspaceId: mockWorkspaceId, name: "Email" },
      { id: "attr-key-name", key: "name", workspaceId: mockWorkspaceId, name: "Name" }, // Original name
    ];
    vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true }).mockResolvedValueOnce(
      mockAttributeKeys
    );

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
    ] as unknown as Awaited<ReturnType<typeof prisma.contact.findMany>>);

    // Mock the transaction
    const mockTransaction = {
      contact: {
        createMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      $executeRaw: vi.fn().mockResolvedValue({ count: 0 }),
      $queryRaw: vi.fn().mockResolvedValue([{ id: "attr-key-name", key: "name", name: "Full Name" }]),
    };

    vi.mocked(prisma.$transaction).mockImplementationOnce((callback) => {
      return callback(mockTransaction as unknown as Parameters<typeof callback>[0]);
    });

    // Execute the function
    const result = await upsertBulkContacts(mockContacts, mockWorkspaceId, mockDirectory);

    if (!result.ok) throw new Error("Expected result.ok to be true");
    expect(result.data).toEqual({ contactIdxWithConflictingUserIds: [] });

    // Verify that the raw SQL query was executed for updating attribute keys
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: "attr-key-name", key: "name", name: "Full Name" }]);
  });
  describe("contacts matched by the directory's matching key", () => {
    const existingContact = (id: string, attributes: Record<string, string>) => ({
      id,
      attributes: Object.entries(attributes).map(([key, value]) => ({
        id: `${id}-${key}`,
        attributeKey: { key },
        value,
        createdAt: new Date("2024-01-01"),
      })),
    });

    /** The contact ids of the attribute rows written by the raw upsert: its fourth bound array. */
    const upsertedContactIds = (): unknown => vi.mocked(prisma.$executeRaw).mock.calls[0]?.[4];

    const attributeKeys = (keys: string[]) =>
      keys.map((key) => ({ id: `key-${key}`, key, name: key, dataType: "string" as const }));

    test("a contact matching several existing ones updates the one with its userId", async () => {
      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true }).mockResolvedValueOnce(
        attributeKeys(["email", "userId", "plan"])
      );
      vi.mocked(prisma.contact.findMany, { partial: true, deep: true }).mockResolvedValueOnce([
        existingContact("oldest", { email: "a@example.com", userId: "u-old" }),
        existingContact("same-user", { email: "a@example.com", userId: "u-1" }),
      ]);

      const result = await upsertBulkContacts(
        [
          {
            attributes: [
              { attributeKey: { key: "email", name: "email" }, value: "a@example.com" },
              { attributeKey: { key: "userId", name: "userId" }, value: "u-1" },
              { attributeKey: { key: "plan", name: "plan" }, value: "pro" },
            ],
          },
        ],
        mockWorkspaceId,
        mockDirectory
      );

      expect(result).toEqual({ ok: true, data: { contactIdxWithConflictingUserIds: [] } });
      expect(prisma.contact.createMany).not.toHaveBeenCalled();
      expect(upsertedContactIds()).toEqual(["same-user"]);
    });

    test("a contact matching several existing ones with no userId match updates the oldest", async () => {
      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true }).mockResolvedValueOnce(
        attributeKeys(["email", "plan"])
      );
      vi.mocked(prisma.contact.findMany, { partial: true, deep: true }).mockResolvedValueOnce([
        existingContact("oldest", { email: "a@example.com" }),
        existingContact("newer", { email: "a@example.com" }),
      ]);

      await upsertBulkContacts(
        [
          {
            attributes: [
              { attributeKey: { key: "email", name: "email" }, value: "a@example.com" },
              { attributeKey: { key: "plan", name: "plan" }, value: "pro" },
            ],
          },
        ],
        mockWorkspaceId,
        mockDirectory
      );

      expect(upsertedContactIds()).toEqual(["oldest"]);
    });

    test("an external-ID directory matches on externalId", async () => {
      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true }).mockResolvedValueOnce(
        attributeKeys(["externalId", "plan"])
      );
      vi.mocked(prisma.contact.findMany, { partial: true, deep: true }).mockResolvedValueOnce([
        existingContact("crm-contact", { externalId: "crm-1" }),
      ]);

      await upsertBulkContacts(
        [
          {
            attributes: [
              { attributeKey: { key: "externalId", name: "externalId" }, value: "crm-1" },
              { attributeKey: { key: "plan", name: "plan" }, value: "pro" },
            ],
          },
        ],
        mockWorkspaceId,
        { id: "directory_ext", matchingKey: "externalId" }
      );

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            directoryId: "directory_ext",
            attributes: {
              some: {
                attributeKey: { key: "externalId", directoryId: "directory_ext" },
                value: { in: ["crm-1"] },
              },
            },
          },
        })
      );
      expect(upsertedContactIds()).toEqual(["crm-contact"]);
    });
  });
});
