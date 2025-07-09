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
    },
    contactAttributeKey: {
      findMany: vi.fn(),
    },
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
        attributes: {
          firstName: "John",
        },
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
        attributes: {
          email: "",
        },
      };

      const result = await createContact(contactData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("bad_request");
        expect(result.error.details).toEqual([{ field: "attributes", issue: "email attribute is required" }]);
      }
    });

    test("returns bad_request error when attribute keys do not exist", async () => {
      const contactData: TContactCreateRequest = {
        environmentId: "env123",
        attributes: {
          email: "john@example.com",
          nonExistentKey: "value",
        },
      };

      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([
        { id: "attr1", key: "email", name: "Email", type: "default", environmentId: "env123" },
      ] as TContactAttributeKey[]);

      const result = await createContact(contactData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("bad_request");
        expect(result.error.details).toEqual([
          { field: "attributes", issue: "attribute keys not found: nonExistentKey. " },
        ]);
      }
    });

    test("returns conflict error when contact with same email already exists", async () => {
      const contactData: TContactCreateRequest = {
        environmentId: "env123",
        attributes: {
          email: "john@example.com",
        },
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
        attributes: {
          email: "john@example.com",
          userId: "user123",
        },
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
        attributes: {
          email: "john@example.com",
          firstName: "John",
        },
      };

      const existingAttributeKeys = [
        { id: "attr1", key: "email", name: "Email", type: "default", environmentId: "env123" },
        { id: "attr2", key: "firstName", name: "First Name", type: "custom", environmentId: "env123" },
      ] as TContactAttributeKey[];

      const contactWithAttributes = {
        id: "contact123",
        environmentId: "env123",
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
        updatedAt: new Date("2023-01-01T00:00:00.000Z"),
        userId: null,
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
      vi.mocked(prisma.contact.create).mockResolvedValue(contactWithAttributes);

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

    test("returns internal_server_error when contact creation returns null", async () => {
      const contactData: TContactCreateRequest = {
        environmentId: "env123",
        attributes: {
          email: "john@example.com",
        },
      };

      const existingAttributeKeys = [
        { id: "attr1", key: "email", name: "Email", type: "default", environmentId: "env123" },
      ] as TContactAttributeKey[];

      vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue(existingAttributeKeys);
      vi.mocked(prisma.contact.create).mockResolvedValue(null as any);

      const result = await createContact(contactData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
        expect(result.error.details).toEqual([
          { field: "contact", issue: "Cannot read properties of null (reading 'attributes')" },
        ]);
      }
    });

    test("returns internal_server_error when database error occurs", async () => {
      const contactData: TContactCreateRequest = {
        environmentId: "env123",
        attributes: {
          email: "john@example.com",
        },
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
        attributes: {
          email: "john@example.com",
        },
      };

      const existingAttributeKeys = [
        { id: "attr1", key: "email", name: "Email", type: "default", environmentId: "env123" },
      ] as TContactAttributeKey[];

      const contactWithAttributes = {
        id: "contact123",
        environmentId: "env123",
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
        updatedAt: new Date("2023-01-01T00:00:00.000Z"),
        userId: null,
        attributes: [
          {
            attributeKey: existingAttributeKeys[0],
            value: "john@example.com",
          },
        ],
      };

      vi.mocked(prisma.contact.findFirst).mockResolvedValueOnce(null); // No existing contact by email
      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue(existingAttributeKeys);
      vi.mocked(prisma.contact.create).mockResolvedValue(contactWithAttributes);

      const result = await createContact(contactData);

      expect(result.ok).toBe(true);
      expect(prisma.contact.findFirst).toHaveBeenCalledTimes(1); // Only called once for email check
    });

    test("returns bad_request error when multiple attribute keys are missing", async () => {
      const contactData: TContactCreateRequest = {
        environmentId: "env123",
        attributes: {
          email: "john@example.com",
          nonExistentKey1: "value1",
          nonExistentKey2: "value2",
        },
      };

      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([
        { id: "attr1", key: "email", name: "Email", type: "default", environmentId: "env123" },
      ] as TContactAttributeKey[]);

      const result = await createContact(contactData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("bad_request");
        expect(result.error.details).toEqual([
          { field: "attributes", issue: "attribute keys not found: nonExistentKey1, nonExistentKey2. " },
        ]);
      }
    });

    test("correctly handles userId extraction from attributes", async () => {
      const contactData: TContactCreateRequest = {
        environmentId: "env123",
        attributes: {
          email: "john@example.com",
          userId: "user123",
          firstName: "John",
        },
      };

      const existingAttributeKeys = [
        { id: "attr1", key: "email", name: "Email", type: "default", environmentId: "env123" },
        { id: "attr2", key: "userId", name: "User ID", type: "default", environmentId: "env123" },
        { id: "attr3", key: "firstName", name: "First Name", type: "custom", environmentId: "env123" },
      ] as TContactAttributeKey[];

      vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue(existingAttributeKeys);

      const contactWithAttributes = {
        id: "contact123",
        environmentId: "env123",
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
        updatedAt: new Date("2023-01-01T00:00:00.000Z"),
        userId: null,
        attributes: [
          { attributeKey: existingAttributeKeys[0], value: "john@example.com" },
          { attributeKey: existingAttributeKeys[1], value: "user123" },
          { attributeKey: existingAttributeKeys[2], value: "John" },
        ],
      };

      vi.mocked(prisma.contact.create).mockResolvedValue(contactWithAttributes);

      const result = await createContact(contactData);

      expect(result.ok).toBe(true);
      expect(prisma.contact.findFirst).toHaveBeenCalledTimes(2); // Called once for email check and once for userId check
    });
  });
});
