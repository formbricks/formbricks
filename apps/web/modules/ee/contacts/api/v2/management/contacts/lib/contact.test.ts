import { TContactCreateRequest } from "@/modules/ee/contacts/types/contact";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { createContact } from "./contact";

// Mock prisma
vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    contactAttributeKey: {
      findMany: vi.fn(),
      createManyAndReturn: vi.fn(),
    },
    contactAttribute: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe("contact.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createContact", () => {
    test("returns bad_request error when email attribute is missing", async () => {
      const contactData: TContactCreateRequest = {
        environmentId: "env123",
        attributes: [
          {
            attributeKey: { key: "firstName", name: "First Name" },
            value: "John",
          },
        ],
      };

      const result = await createContact(contactData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("bad_request");
        expect(result.error.details).toEqual([{ field: "attributes", issue: "email attribute is required" }]);
      }
    });

    test("returns bad_request error when email attribute value is empty", async () => {
      const contactData: TContactCreateRequest = {
        environmentId: "env123",
        attributes: [
          {
            attributeKey: { key: "email", name: "Email" },
            value: "",
          },
        ],
      };

      const result = await createContact(contactData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("bad_request");
        expect(result.error.details).toEqual([{ field: "attributes", issue: "email attribute is required" }]);
      }
    });

    test("returns conflict error when contact with same email already exists", async () => {
      const contactData: TContactCreateRequest = {
        environmentId: "env123",
        attributes: [
          {
            attributeKey: { key: "email", name: "Email" },
            value: "john@example.com",
          },
        ],
      };

      vi.mocked(prisma.contact.findFirst).mockResolvedValueOnce({
        id: "existing-contact-id",
        environmentId: "env123",
        userId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await createContact(contactData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("conflict");
        expect(result.error.details).toEqual([
          { field: "email", issue: "contact with this email already exists" },
        ]);
      }
    });

    test("returns conflict error when contact with same userId already exists", async () => {
      const contactData: TContactCreateRequest = {
        environmentId: "env123",
        attributes: [
          {
            attributeKey: { key: "email", name: "Email" },
            value: "john@example.com",
          },
          {
            attributeKey: { key: "userId", name: "User ID" },
            value: "user123",
          },
        ],
      };

      vi.mocked(prisma.contact.findFirst)
        .mockResolvedValueOnce(null) // No existing contact by email
        .mockResolvedValueOnce({
          id: "existing-contact-id",
          environmentId: "env123",
          userId: "user123",
          createdAt: new Date(),
          updatedAt: new Date(),
        }); // Existing contact by userId

      const result = await createContact(contactData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("conflict");
        expect(result.error.details).toEqual([
          { field: "userId", issue: "contact with this userId already exists" },
        ]);
      }
    });

    test("successfully creates contact with existing attribute keys", async () => {
      const contactData: TContactCreateRequest = {
        environmentId: "env123",
        attributes: [
          {
            attributeKey: { key: "email", name: "Email" },
            value: "john@example.com",
          },
          {
            attributeKey: { key: "firstName", name: "First Name" },
            value: "John",
          },
        ],
      };

      const existingAttributeKeys = [
        { id: "attr1", key: "email", name: "Email", type: "default", environmentId: "env123" },
        { id: "attr2", key: "firstName", name: "First Name", type: "custom", environmentId: "env123" },
      ] as any;

      const createdContact = {
        id: "contact123",
        environmentId: "env123",
        userId: null,
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
        updatedAt: new Date("2023-01-01T00:00:00.000Z"),
      };

      const contactWithAttributes = {
        ...createdContact,
        attributes: [
          {
            attributeKey: existingAttributeKeys[0],
            value: "john@example.com",
          },
          {
            attributeKey: existingAttributeKeys[1],
            value: "John",
          },
        ],
      };

      vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue(existingAttributeKeys);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          contactAttributeKey: {
            createManyAndReturn: vi.fn(),
          } as any,
          contact: {
            create: vi.fn().mockResolvedValue(createdContact),
            findUnique: vi.fn().mockResolvedValue(contactWithAttributes),
          } as any,
          contactAttribute: {
            createMany: vi.fn(),
          } as any,
        } as any);
      });

      const result = await createContact(contactData);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          id: "contact123",
          createdAt: new Date("2023-01-01T00:00:00.000Z"),
          environmentId: "env123",
          attributes: {
            email: "john@example.com",
            firstName: "John",
          },
        });
      }
    });

    test("successfully creates contact with new attribute keys", async () => {
      const contactData: TContactCreateRequest = {
        environmentId: "env123",
        attributes: [
          {
            attributeKey: { key: "email", name: "Email" },
            value: "john@example.com",
          },
          {
            attributeKey: { key: "customField", name: "Custom Field" },
            value: "Custom Value",
          },
        ],
      };

      const existingAttributeKeys = [
        { id: "attr1", key: "email", name: "Email", type: "default", environmentId: "env123" },
      ] as any;

      const newAttributeKeys = [
        { id: "attr2", key: "customField", name: "Custom Field", type: "custom", environmentId: "env123" },
      ] as any;

      const createdContact = {
        id: "contact123",
        environmentId: "env123",
        userId: null,
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
        updatedAt: new Date("2023-01-01T00:00:00.000Z"),
      };

      const contactWithAttributes = {
        ...createdContact,
        attributes: [
          {
            attributeKey: existingAttributeKeys[0],
            value: "john@example.com",
          },
          {
            attributeKey: newAttributeKeys[0],
            value: "Custom Value",
          },
        ],
      };

      vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue(existingAttributeKeys);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          contactAttributeKey: {
            createManyAndReturn: vi.fn().mockResolvedValue(newAttributeKeys),
          } as any,
          contact: {
            create: vi.fn().mockResolvedValue(createdContact),
            findUnique: vi.fn().mockResolvedValue(contactWithAttributes),
          } as any,
          contactAttribute: {
            createMany: vi.fn(),
          } as any,
        } as any);
      });

      const result = await createContact(contactData);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          id: "contact123",
          createdAt: new Date("2023-01-01T00:00:00.000Z"),
          environmentId: "env123",
          attributes: {
            email: "john@example.com",
            customField: "Custom Value",
          },
        });
      }
    });

    test("returns internal_server_error when transaction returns null", async () => {
      const contactData: TContactCreateRequest = {
        environmentId: "env123",
        attributes: [
          {
            attributeKey: { key: "email", name: "Email" },
            value: "john@example.com",
          },
        ],
      };

      vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([]);
      vi.mocked(prisma.$transaction).mockResolvedValue(null);

      const result = await createContact(contactData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
        expect(result.error.details).toEqual([{ field: "contact", issue: "failed to create contact" }]);
      }
    });

    test("returns internal_server_error when attribute key is not found during transaction", async () => {
      const contactData: TContactCreateRequest = {
        environmentId: "env123",
        attributes: [
          {
            attributeKey: { key: "email", name: "Email" },
            value: "john@example.com",
          },
        ],
      };

      vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([]);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          contactAttributeKey: {
            createManyAndReturn: vi.fn().mockResolvedValue([]),
          } as any,
          contact: {
            create: vi.fn().mockResolvedValue({
              id: "contact123",
              environmentId: "env123",
              userId: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          } as any,
          contactAttribute: {
            createMany: vi.fn(),
          } as any,
        } as any);
      });

      const result = await createContact(contactData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
        expect(result.error.details).toEqual([{ field: "contact", issue: "Attribute key email not found" }]);
      }
    });

    test("returns internal_server_error when database error occurs", async () => {
      const contactData: TContactCreateRequest = {
        environmentId: "env123",
        attributes: [
          {
            attributeKey: { key: "email", name: "Email" },
            value: "john@example.com",
          },
        ],
      };

      vi.mocked(prisma.contact.findFirst).mockRejectedValue(new Error("Database connection failed"));

      const result = await createContact(contactData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
        expect(result.error.details).toEqual([{ field: "contact", issue: "Database connection failed" }]);
      }
    });

    test("does not check for userId conflict when userId is not provided", async () => {
      const contactData: TContactCreateRequest = {
        environmentId: "env123",
        attributes: [
          {
            attributeKey: { key: "email", name: "Email" },
            value: "john@example.com",
          },
        ],
      };

      const existingAttributeKeys = [
        { id: "attr1", key: "email", name: "Email", type: "default", environmentId: "env123" },
      ] as TContactAttributeKey[];

      const createdContact = {
        id: "contact123",
        environmentId: "env123",
        userId: null,
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
        updatedAt: new Date("2023-01-01T00:00:00.000Z"),
      };

      const contactWithAttributes = {
        ...createdContact,
        attributes: [
          {
            attributeKey: existingAttributeKeys[0],
            value: "john@example.com",
          },
        ],
      };

      vi.mocked(prisma.contact.findFirst).mockResolvedValueOnce(null); // No existing contact by email
      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue(existingAttributeKeys);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          contactAttributeKey: {
            createManyAndReturn: vi.fn(),
          } as any,
          contact: {
            create: vi.fn().mockResolvedValue(createdContact),
            findUnique: vi.fn().mockResolvedValue(contactWithAttributes),
          } as any,
          contactAttribute: {
            createMany: vi.fn(),
          } as any,
        } as any);
      });

      const result = await createContact(contactData);

      expect(result.ok).toBe(true);
      expect(prisma.contact.findFirst).toHaveBeenCalledTimes(1); // Only called once for email check
    });
  });
});
