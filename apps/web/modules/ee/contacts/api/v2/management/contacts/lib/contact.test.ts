import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TContactCreateRequest } from "@/modules/ee/contacts/types/contact";
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
    // The insert runs in a transaction that locks the workspace and reads its directory again.
    $transaction: vi.fn(async (run: (tx: unknown) => unknown) =>
      run((await import("@formbricks/database")).prisma)
    ),
    $executeRaw: vi.fn(),
    workspace: { findUnique: vi.fn() },
  },
}));

const emailDirectory = { id: "directory123", matchingKey: "email" as const };
const userIdDirectory = { id: "directory-user", matchingKey: "userId" as const };

/** The workspace's directory when the insert reads it under the lock. */
const workspaceOnDirectory = (directory: { id: string; matchingKey: "email" | "userId" } | null) =>
  vi.mocked(prisma.workspace.findUnique).mockResolvedValue({ contactDirectory: directory } as never);

describe("contact.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workspaceOnDirectory(emailDirectory);
  });

  describe("createContact", () => {
    test("checks for an existing contact across the whole directory", async () => {
      vi.mocked(prisma.contact.findFirst).mockResolvedValueOnce({ id: "from-other-workspace" } as Awaited<
        ReturnType<typeof prisma.contact.findFirst>
      >);

      const result = await createContact(
        { workspaceId: "workspace123", attributes: { email: "john@example.com" } },
        emailDirectory
      );

      expect(result.ok).toBe(false);
      expect(prisma.contact.findFirst).toHaveBeenCalledWith({
        where: {
          directoryId: "directory123",
          attributes: {
            some: {
              attributeKey: { key: "email", directoryId: "directory123" },
              value: "john@example.com",
            },
          },
        },
        select: { id: true },
      });
      expect(prisma.contact.create).not.toHaveBeenCalled();
    });

    test("a userId directory requires userId instead of email", async () => {
      const result = await createContact(
        { workspaceId: "workspace123", attributes: { email: "john@example.com" } },
        userIdDirectory
      );

      expect(result).toEqual({
        ok: false,
        error: {
          type: "bad_request",
          details: [{ field: "attributes", issue: "userId attribute is required" }],
        },
      });
      expect(prisma.contact.findFirst).not.toHaveBeenCalled();
    });

    test("a userId directory refuses a userId another contact has", async () => {
      vi.mocked(prisma.contact.findFirst).mockResolvedValueOnce({ id: "existing" } as Awaited<
        ReturnType<typeof prisma.contact.findFirst>
      >);

      const result = await createContact(
        { workspaceId: "workspace123", attributes: { userId: "user-1" } },
        userIdDirectory
      );

      expect(result).toEqual({
        ok: false,
        error: {
          type: "conflict",
          details: [{ field: "userId", issue: "contact with this userId already exists" }],
        },
      });
    });

    test("a userId directory refuses an email another contact has", async () => {
      // No contact has the userId; one already has the email.
      vi.mocked(prisma.contact.findFirst)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "existing" } as Awaited<ReturnType<typeof prisma.contact.findFirst>>);

      const result = await createContact(
        { workspaceId: "workspace123", attributes: { userId: "user-2", email: "taken@example.com" } },
        userIdDirectory
      );

      expect(result).toEqual({
        ok: false,
        error: {
          type: "conflict",
          details: [{ field: "email", issue: "contact with this email already exists" }],
        },
      });
      expect(prisma.contact.findFirst).toHaveBeenLastCalledWith({
        where: {
          directoryId: "directory-user",
          attributes: {
            some: {
              attributeKey: { key: "email", directoryId: "directory-user" },
              value: "taken@example.com",
            },
          },
        },
        select: { id: true },
      });
      expect(prisma.contact.create).not.toHaveBeenCalled();
    });

    test("creates nothing once the workspace has left the directory the checks used", async () => {
      // A removal committed after the duplicate checks: the workspace now has no directory.
      workspaceOnDirectory(null);
      vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([
        { id: "key-email", key: "email", dataType: "string" },
      ] as Awaited<ReturnType<typeof prisma.contactAttributeKey.findMany>>);

      const result = await createContact(
        { workspaceId: "workspace123", attributes: { email: "john@example.com" } },
        emailDirectory
      );

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe("forbidden");
      expect(prisma.contact.create).not.toHaveBeenCalled();
    });

    test("creates the contact in the directory with keys of the directory", async () => {
      workspaceOnDirectory(userIdDirectory);
      vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([
        { id: "key-user", key: "userId", dataType: "string" },
      ] as Awaited<ReturnType<typeof prisma.contactAttributeKey.findMany>>);
      vi.mocked(prisma.contact.create).mockResolvedValue({
        id: "new-contact",
        createdAt: new Date("2026-01-01"),
        attributes: [{ value: "user-1", attributeKey: { key: "userId", dataType: "string" } }],
      } as unknown as Awaited<ReturnType<typeof prisma.contact.create>>);

      const result = await createContact(
        { workspaceId: "workspace123", attributes: { userId: "user-1" } },
        userIdDirectory
      );

      // The userId is the matching key here, so it is looked up once, not again as a userId.
      expect(prisma.contact.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.contactAttributeKey.findMany).toHaveBeenCalledWith({
        where: { directoryId: "directory-user", key: { in: ["userId"] } },
      });
      expect(prisma.contact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ directoryId: "directory-user", workspaceId: "workspace123" }),
        })
      );
      expect(result).toEqual(
        expect.objectContaining({
          ok: true,
          data: expect.objectContaining({ workspaceId: "workspace123", attributes: { userId: "user-1" } }),
        })
      );
    });

    test("returns bad_request error when email attribute is missing", async () => {
      const contactData: TContactCreateRequest = {
        workspaceId: "workspace123",
        attributes: {
          firstName: "John",
        },
      };

      const result = await createContact(contactData, emailDirectory);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("bad_request");
        expect(result.error.details).toEqual([{ field: "attributes", issue: "email attribute is required" }]);
      }
    });

    test("returns bad_request error when email attribute value is empty", async () => {
      const contactData: TContactCreateRequest = {
        workspaceId: "workspace123",
        attributes: {
          email: "",
        },
      };

      const result = await createContact(contactData, emailDirectory);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("bad_request");
        expect(result.error.details).toEqual([{ field: "attributes", issue: "email attribute is required" }]);
      }
    });

    test("returns bad_request error when attribute keys do not exist", async () => {
      const contactData: TContactCreateRequest = {
        workspaceId: "workspace123",
        attributes: {
          email: "john@example.com",
          nonExistentKey: "value",
        },
      };

      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([
        { id: "attr1", key: "email", name: "Email", type: "default", workspaceId: "workspace123" },
      ] as (TContactAttributeKey & { directoryId: string | null })[]);

      const result = await createContact(contactData, emailDirectory);

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
        workspaceId: "workspace123",
        attributes: {
          email: "john@example.com",
        },
      };

      vi.mocked(prisma.contact.findFirst).mockResolvedValueOnce({
        id: "existing-contact-id",
        workspaceId: "workspace123",
        directoryId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await createContact(contactData, emailDirectory);

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
        workspaceId: "workspace123",
        attributes: {
          email: "john@example.com",
          userId: "user123",
        },
      };

      vi.mocked(prisma.contact.findFirst)
        .mockResolvedValueOnce(null) // No existing contact by email
        .mockResolvedValueOnce({
          id: "existing-contact-id",
          workspaceId: "workspace123",
          directoryId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }); // Existing contact by userId

      const result = await createContact(contactData, emailDirectory);

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
        workspaceId: "workspace123",
        attributes: {
          email: "john@example.com",
          firstName: "John",
        },
      };

      const existingAttributeKeys = [
        { id: "attr1", key: "email", name: "Email", type: "default", workspaceId: "workspace123" },
        { id: "attr2", key: "firstName", name: "First Name", type: "custom", workspaceId: "workspace123" },
      ] as (TContactAttributeKey & { directoryId: string | null })[];

      const contactWithAttributes = {
        id: "contact123",
        workspaceId: "workspace123",
        directoryId: null,
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
        updatedAt: new Date("2023-01-01T00:00:00.000Z"),
        userId: null,
        attributes: [
          {
            attributeKey: { ...existingAttributeKeys[0], dataType: "string" },
            value: "john@example.com",
            valueNumber: null,
            valueDate: null,
          },
          {
            attributeKey: { ...existingAttributeKeys[1], dataType: "string" },
            value: "John",
            valueNumber: null,
            valueDate: null,
          },
        ],
      };

      vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue(existingAttributeKeys);
      vi.mocked(prisma.contact.create).mockResolvedValue(contactWithAttributes);

      const result = await createContact(contactData, emailDirectory);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          id: "contact123",
          createdAt: new Date("2023-01-01T00:00:00.000Z"),
          workspaceId: "workspace123",
          attributes: {
            email: "john@example.com",
            firstName: "John",
          },
        });
      }
    });

    test("returns internal_server_error when contact creation returns null", async () => {
      const contactData: TContactCreateRequest = {
        workspaceId: "workspace123",
        attributes: {
          email: "john@example.com",
        },
      };

      const existingAttributeKeys = [
        { id: "attr1", key: "email", name: "Email", type: "default", workspaceId: "workspace123" },
      ] as (TContactAttributeKey & { directoryId: string | null })[];

      vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue(existingAttributeKeys);
      vi.mocked(prisma.contact.create).mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof prisma.contact.create>>
      );

      const result = await createContact(contactData, emailDirectory);

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
        workspaceId: "workspace123",
        attributes: {
          email: "john@example.com",
        },
      };

      vi.mocked(prisma.contact.findFirst).mockRejectedValue(new Error("Database connection failed"));

      const result = await createContact(contactData, emailDirectory);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("internal_server_error");
        expect(result.error.details).toEqual([{ field: "contact", issue: "Database connection failed" }]);
      }
    });

    test("does not check for userId conflict when userId is not provided", async () => {
      const contactData: TContactCreateRequest = {
        workspaceId: "workspace123",
        attributes: {
          email: "john@example.com",
        },
      };

      const existingAttributeKeys = [
        { id: "attr1", key: "email", name: "Email", type: "default", workspaceId: "workspace123" },
      ] as (TContactAttributeKey & { directoryId: string | null })[];

      const contactWithAttributes = {
        id: "contact123",
        workspaceId: "workspace123",
        directoryId: null,
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
        updatedAt: new Date("2023-01-01T00:00:00.000Z"),
        userId: null,
        attributes: [
          {
            attributeKey: { ...existingAttributeKeys[0], dataType: "string" },
            value: "john@example.com",
            valueNumber: null,
            valueDate: null,
          },
        ],
      };

      vi.mocked(prisma.contact.findFirst).mockResolvedValueOnce(null); // No existing contact by email
      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue(existingAttributeKeys);
      vi.mocked(prisma.contact.create).mockResolvedValue(contactWithAttributes);

      const result = await createContact(contactData, emailDirectory);

      expect(result.ok).toBe(true);
      expect(prisma.contact.findFirst).toHaveBeenCalledTimes(1); // Only called once for email check
    });

    test("returns bad_request error when multiple attribute keys are missing", async () => {
      const contactData: TContactCreateRequest = {
        workspaceId: "workspace123",
        attributes: {
          email: "john@example.com",
          nonExistentKey1: "value1",
          nonExistentKey2: "value2",
        },
      };

      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([
        { id: "attr1", key: "email", name: "Email", type: "default", workspaceId: "workspace123" },
      ] as (TContactAttributeKey & { directoryId: string | null })[]);

      const result = await createContact(contactData, emailDirectory);

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
        workspaceId: "workspace123",
        attributes: {
          email: "john@example.com",
          userId: "user123",
          firstName: "John",
        },
      };

      const existingAttributeKeys = [
        { id: "attr1", key: "email", name: "Email", type: "default", workspaceId: "workspace123" },
        { id: "attr2", key: "userId", name: "User ID", type: "default", workspaceId: "workspace123" },
        { id: "attr3", key: "firstName", name: "First Name", type: "custom", workspaceId: "workspace123" },
      ] as (TContactAttributeKey & { directoryId: string | null })[];

      vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue(existingAttributeKeys);

      const contactWithAttributes = {
        id: "contact123",
        workspaceId: "workspace123",
        directoryId: null,
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
        updatedAt: new Date("2023-01-01T00:00:00.000Z"),
        userId: null,
        attributes: [
          {
            attributeKey: { ...existingAttributeKeys[0], dataType: "string" },
            value: "john@example.com",
            valueNumber: null,
            valueDate: null,
          },
          {
            attributeKey: { ...existingAttributeKeys[1], dataType: "string" },
            value: "user123",
            valueNumber: null,
            valueDate: null,
          },
          {
            attributeKey: { ...existingAttributeKeys[2], dataType: "string" },
            value: "John",
            valueNumber: null,
            valueDate: null,
          },
        ],
      };

      vi.mocked(prisma.contact.create).mockResolvedValue(contactWithAttributes);

      const result = await createContact(contactData, emailDirectory);

      expect(result.ok).toBe(true);
      expect(prisma.contact.findFirst).toHaveBeenCalledTimes(2); // Called once for email check and once for userId check
    });
  });
});
