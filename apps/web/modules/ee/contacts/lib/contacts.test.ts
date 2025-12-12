import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import { segmentFilterToPrismaQuery } from "@/modules/ee/contacts/segments/lib/filter/prisma-query";
import { getSegment } from "@/modules/ee/contacts/segments/lib/segments";
import {
  buildContactWhereClause,
  createContactsFromCSV,
  deleteContact,
  generatePersonalLinks,
  getContact,
  getContacts,
  getContactsInSegment,
} from "./contacts";
import { transformPrismaContact } from "./utils";

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
    },
    contactAttributeKey: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@/modules/ee/contacts/segments/lib/segments", () => ({
  getSegment: vi.fn(),
}));

vi.mock("@/modules/ee/contacts/segments/lib/filter/prisma-query", () => ({
  segmentFilterToPrismaQuery: vi.fn(),
}));

vi.mock("@/modules/ee/contacts/lib/contact-survey-link", () => ({
  getContactSurveyLink: vi.fn(),
}));

vi.mock("./utils", () => ({
  transformPrismaContact: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

const mockEnvironmentId = "env-123";
const mockContactId = "contact-123";
const mockSegmentId = "segment-123";
const mockSurveyId = "survey-123";
const mockPrismaContact = {
  id: mockContactId,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-02"),
  environmentId: mockEnvironmentId,
  attributes: [
    {
      value: "john@example.com",
      attributeKey: { key: "email", name: "Email" },
    },
    {
      value: "John Doe",
      attributeKey: { key: "name", name: "Name" },
    },
  ],
};

const mockTransformedContact = {
  id: mockContactId,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-02"),
  environmentId: mockEnvironmentId,
  attributes: {
    email: "john@example.com",
    name: "John Doe",
  },
};

describe("Contacts Lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildContactWhereClause", () => {
    test("returns where clause with only environmentId when no search provided", () => {
      const result = buildContactWhereClause(mockEnvironmentId);
      expect(result).toEqual({ environmentId: mockEnvironmentId });
    });

    test("returns where clause with search filters when search is provided", () => {
      const searchTerm = "john";
      const result = buildContactWhereClause(mockEnvironmentId, searchTerm);

      expect(result).toEqual({
        environmentId: mockEnvironmentId,
        OR: [
          {
            attributes: {
              some: {
                value: {
                  contains: searchTerm,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            id: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        ],
      });
    });

    test("handles empty search string same as no search", () => {
      const result = buildContactWhereClause(mockEnvironmentId, "");
      expect(result).toEqual({ environmentId: mockEnvironmentId });
    });
  });

  describe("getContactsInSegment", () => {
    test("returns contacts in segment with attributes", async () => {
      const mockSegmentData = {
        id: mockSegmentId,
        filters: [],
        environmentId: mockEnvironmentId,
      };

      const mockContactsInSegment = [
        {
          id: mockContactId,
          attributes: [
            {
              attributeKey: { key: "email" },
              value: "john@example.com",
            },
          ],
        },
      ];

      vi.mocked(getSegment).mockResolvedValue(mockSegmentData as any);
      vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
        ok: true,
        data: { whereClause: { environmentId: mockEnvironmentId } },
      } as any);
      vi.mocked(prisma.contact.findMany).mockResolvedValue(mockContactsInSegment as any);

      const result = await getContactsInSegment(mockSegmentId);

      expect(result).toEqual([
        {
          contactId: mockContactId,
          attributes: {
            email: "john@example.com",
          },
        },
      ]);
    });

    test("returns null when segment is not found", async () => {
      vi.mocked(getSegment).mockResolvedValue(null);

      const result = await getContactsInSegment(mockSegmentId);

      expect(result).toBeNull();
    });

    test("returns null when segmentFilterToPrismaQuery fails", async () => {
      const mockSegmentData = {
        id: mockSegmentId,
        filters: [],
        environmentId: mockEnvironmentId,
      };

      vi.mocked(getSegment).mockResolvedValue(mockSegmentData as any);
      vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
        ok: false,
        error: "Filter error",
      } as any);

      const result = await getContactsInSegment(mockSegmentId);

      expect(result).toBeNull();
    });

    test("returns null on database error", async () => {
      const mockSegmentData = {
        id: mockSegmentId,
        filters: [],
        environmentId: mockEnvironmentId,
      };

      vi.mocked(getSegment).mockResolvedValue(mockSegmentData as any);
      vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
        ok: true,
        data: { whereClause: { environmentId: mockEnvironmentId } },
      } as any);
      vi.mocked(prisma.contact.findMany).mockRejectedValue(new Error("DB Error"));

      const result = await getContactsInSegment(mockSegmentId);

      expect(result).toBeNull();
    });

    test("handles contacts with multiple attributes", async () => {
      const mockSegmentData = {
        id: mockSegmentId,
        filters: [],
        environmentId: mockEnvironmentId,
      };

      const mockContactsInSegment = [
        {
          id: "contact-1",
          attributes: [
            { attributeKey: { key: "userId" }, value: "user-1" },
            { attributeKey: { key: "email" }, value: "user1@example.com" },
            { attributeKey: { key: "firstName" }, value: "John" },
            { attributeKey: { key: "lastName" }, value: "Doe" },
          ],
        },
      ];

      vi.mocked(getSegment).mockResolvedValue(mockSegmentData as any);
      vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
        ok: true,
        data: { whereClause: { environmentId: mockEnvironmentId } },
      } as any);
      vi.mocked(prisma.contact.findMany).mockResolvedValue(mockContactsInSegment as any);

      const result = await getContactsInSegment(mockSegmentId);

      expect(result).toEqual([
        {
          contactId: "contact-1",
          attributes: {
            userId: "user-1",
            email: "user1@example.com",
            firstName: "John",
            lastName: "Doe",
          },
        },
      ]);
    });
  });

  describe("getContacts", () => {
    test("returns contacts without search or offset", async () => {
      vi.mocked(prisma.contact.findMany).mockResolvedValue([mockPrismaContact] as any);
      vi.mocked(transformPrismaContact).mockReturnValue(mockTransformedContact as any);

      const result = await getContacts(mockEnvironmentId);

      expect(result).toEqual([mockTransformedContact]);
      expect(prisma.contact.findMany).toHaveBeenCalledWith({
        where: { environmentId: mockEnvironmentId },
        select: expect.any(Object),
        take: 30,
        skip: undefined,
        orderBy: { createdAt: "desc" },
      });
    });

    test("returns contacts with offset for pagination", async () => {
      vi.mocked(prisma.contact.findMany).mockResolvedValue([mockPrismaContact] as any);
      vi.mocked(transformPrismaContact).mockReturnValue(mockTransformedContact as any);

      const result = await getContacts(mockEnvironmentId, 30);

      expect(result).toEqual([mockTransformedContact]);
      expect(prisma.contact.findMany).toHaveBeenCalledWith({
        where: { environmentId: mockEnvironmentId },
        select: expect.any(Object),
        take: 30,
        skip: 30,
        orderBy: { createdAt: "desc" },
      });
    });

    test("returns contacts with search value", async () => {
      const searchValue = "john";
      vi.mocked(prisma.contact.findMany).mockResolvedValue([mockPrismaContact] as any);
      vi.mocked(transformPrismaContact).mockReturnValue(mockTransformedContact as any);

      const result = await getContacts(mockEnvironmentId, undefined, searchValue);

      expect(result).toEqual([mockTransformedContact]);
      expect(prisma.contact.findMany).toHaveBeenCalledWith({
        where: buildContactWhereClause(mockEnvironmentId, searchValue),
        select: expect.any(Object),
        take: 30,
        skip: undefined,
        orderBy: { createdAt: "desc" },
      });
    });

    test("throws DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("DB Error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.contact.findMany).mockRejectedValue(prismaError);

      await expect(getContacts(mockEnvironmentId)).rejects.toThrow(DatabaseError);
    });

    test("re-throws non-Prisma errors", async () => {
      const error = new Error("Unknown error");
      vi.mocked(prisma.contact.findMany).mockRejectedValue(error);

      await expect(getContacts(mockEnvironmentId)).rejects.toThrow(error);
    });

    test("returns multiple contacts", async () => {
      const contact2 = { ...mockPrismaContact, id: "contact-2" };
      vi.mocked(prisma.contact.findMany).mockResolvedValue([mockPrismaContact, contact2] as any);
      vi.mocked(transformPrismaContact)
        .mockReturnValueOnce(mockTransformedContact as any)
        .mockReturnValueOnce({ ...mockTransformedContact, id: "contact-2" } as any);

      const result = await getContacts(mockEnvironmentId);

      expect(result).toHaveLength(2);
    });
  });

  describe("getContact", () => {
    test("returns a single contact by ID", async () => {
      vi.mocked(prisma.contact.findUnique).mockResolvedValue(mockPrismaContact as any);

      const result = await getContact(mockContactId);

      expect(result).toEqual(mockPrismaContact);
      expect(prisma.contact.findUnique).toHaveBeenCalledWith({
        where: { id: mockContactId },
        select: expect.any(Object),
      });
    });

    test("returns null when contact not found", async () => {
      vi.mocked(prisma.contact.findUnique).mockResolvedValue(null);

      const result = await getContact(mockContactId);

      expect(result).toBeNull();
    });

    test("throws DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("DB Error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.contact.findUnique).mockRejectedValue(prismaError);

      await expect(getContact(mockContactId)).rejects.toThrow(DatabaseError);
    });

    test("re-throws non-Prisma errors", async () => {
      const error = new Error("Unknown error");
      vi.mocked(prisma.contact.findUnique).mockRejectedValue(error);

      await expect(getContact(mockContactId)).rejects.toThrow(error);
    });
  });

  describe("deleteContact", () => {
    test("deletes a contact and returns it", async () => {
      vi.mocked(prisma.contact.delete).mockResolvedValue(mockPrismaContact as any);

      const result = await deleteContact(mockContactId);

      expect(result).toEqual(mockPrismaContact);
      expect(prisma.contact.delete).toHaveBeenCalledWith({
        where: { id: mockContactId },
        select: expect.any(Object),
      });
    });

    test("throws DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("DB Error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.contact.delete).mockRejectedValue(prismaError);

      await expect(deleteContact(mockContactId)).rejects.toThrow(DatabaseError);
    });

    test("re-throws non-Prisma errors", async () => {
      const error = new Error("Unknown error");
      vi.mocked(prisma.contact.delete).mockRejectedValue(error);

      await expect(deleteContact(mockContactId)).rejects.toThrow(error);
    });
  });

  describe("createContactsFromCSV", () => {
    const csvData = [
      { email: "john@example.com", userId: "user-1", name: "John" },
      { email: "jane@example.com", userId: "user-2", name: "Jane" },
    ];

    test("creates new contacts from CSV data", async () => {
      const attributeMap = { email: "email", userId: "userId", name: "name" };
      vi.mocked(prisma.contact.findMany).mockResolvedValue([]);
      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([]);
      vi.mocked(prisma.contactAttributeKey.createMany).mockResolvedValue({ count: 3 });

      const newAttributeKeys = [
        { key: "email", id: "key-1" },
        { key: "userId", id: "key-2" },
        { key: "name", id: "key-3" },
      ];
      vi.mocked(prisma.contactAttributeKey.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(newAttributeKeys as any);

      const mockCreatedContact = {
        id: "new-contact-1",
        environmentId: mockEnvironmentId,
        attributes: [{ attributeKey: { key: "email" }, value: "john@example.com" }],
      };
      vi.mocked(prisma.contact.create).mockResolvedValue(mockCreatedContact as any);

      const result = await createContactsFromCSV(csvData, mockEnvironmentId, "skip", attributeMap);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test("skips duplicate contacts when duplicateContactsAction is skip", async () => {
      const attributeMap = { email: "email", userId: "userId" };
      const existingContact = {
        id: "existing-1",
        attributes: [{ attributeKey: { key: "email", id: "key-1" }, value: "john@example.com" }],
      };

      vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([existingContact as any]);
      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
      vi.mocked(prisma.contactAttributeKey.findMany)
        .mockResolvedValueOnce([{ key: "email", id: "key-1" }] as any)
        .mockResolvedValueOnce([
          { key: "userId", id: "key-2" },
          { key: "name", id: "key-3" },
        ] as any);
      vi.mocked(prisma.contactAttributeKey.createMany).mockResolvedValue({ count: 2 });

      const result = await createContactsFromCSV(csvData, mockEnvironmentId, "skip", attributeMap);

      expect(Array.isArray(result)).toBe(true);
    });

    test("updates duplicate contacts when duplicateContactsAction is update", async () => {
      const attributeMap = { email: "email", userId: "userId" };
      const existingContact = {
        id: "existing-1",
        attributes: [
          { attributeKey: { key: "email", id: "key-1" }, value: "john@example.com" },
          { attributeKey: { key: "userId", id: "key-2" }, value: "user-1" },
        ],
      };

      vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([existingContact as any]);
      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
      vi.mocked(prisma.contactAttributeKey.findMany)
        .mockResolvedValueOnce([
          { key: "email", id: "key-1" },
          { key: "userId", id: "key-2" },
        ] as any)
        .mockResolvedValueOnce([{ key: "name", id: "key-3" }] as any);
      vi.mocked(prisma.contactAttributeKey.createMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.contact.update).mockResolvedValue(existingContact as any);

      const result = await createContactsFromCSV(csvData, mockEnvironmentId, "update", attributeMap);

      expect(Array.isArray(result)).toBe(true);
    });

    test("overwrites duplicate contacts when duplicateContactsAction is overwrite", async () => {
      const attributeMap = { email: "email", userId: "userId" };
      const existingContact = {
        id: "existing-1",
        attributes: [
          { attributeKey: { key: "email", id: "key-1" }, value: "john@example.com" },
          { attributeKey: { key: "userId", id: "key-2" }, value: "user-1" },
        ],
      };

      vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([existingContact as any]);
      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
      vi.mocked(prisma.contactAttributeKey.findMany)
        .mockResolvedValueOnce([
          { key: "email", id: "key-1" },
          { key: "userId", id: "key-2" },
        ] as any)
        .mockResolvedValueOnce([{ key: "name", id: "key-3" }] as any);
      vi.mocked(prisma.contactAttributeKey.createMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 2 });
      vi.mocked(prisma.contact.update).mockResolvedValue(existingContact as any);

      const result = await createContactsFromCSV(csvData, mockEnvironmentId, "overwrite", attributeMap);

      expect(Array.isArray(result)).toBe(true);
    });

    test("throws ValidationError when email is missing", async () => {
      const invalidCsvData = [{ userId: "user-1", name: "John" }];
      const attributeMap = { userId: "userId", name: "name" };

      vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      vi.mocked(prisma.contactAttributeKey.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ key: "userid", id: "key-1" }] as any);

      await expect(
        createContactsFromCSV(invalidCsvData as any, mockEnvironmentId, "skip", attributeMap)
      ).rejects.toThrow(ValidationError);
    });

    test("throws DatabaseError on Prisma error", async () => {
      const attributeMap = { email: "email" };
      const prismaError = new Prisma.PrismaClientKnownRequestError("DB Error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });

      vi.mocked(prisma.contact.findMany).mockRejectedValue(prismaError);

      await expect(createContactsFromCSV(csvData, mockEnvironmentId, "skip", attributeMap)).rejects.toThrow(
        DatabaseError
      );
    });

    test("creates missing attribute keys", async () => {
      const attributeMap = { email: "email", userId: "userId" };
      vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
      vi.mocked(prisma.contactAttributeKey.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { key: "email", id: "key-1" },
          { key: "userId", id: "key-2" },
          { key: "name", id: "key-3" },
        ] as any);
      vi.mocked(prisma.contactAttributeKey.createMany).mockResolvedValue({ count: 3 });
      vi.mocked(prisma.contact.create).mockResolvedValue({
        id: "new-1",
        environmentId: mockEnvironmentId,
        attributes: [],
      } as any);

      const result = await createContactsFromCSV(csvData, mockEnvironmentId, "skip", attributeMap);

      expect(prisma.contactAttributeKey.createMany).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    test("handles case-insensitive attribute keys", async () => {
      const csvDataWithMixedCase = [{ Email: "john@example.com", UserId: "user-1" }];
      const attributeMap = { email: "email", userid: "userId" };

      vi.mocked(prisma.contact.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { key: "email", id: "key-1" },
          { key: "userid", id: "key-2" },
        ] as any);

      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
      vi.mocked(prisma.contactAttributeKey.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { key: "email", id: "key-1" },
          { key: "userid", id: "key-2" },
        ] as any);

      vi.mocked(prisma.contactAttributeKey.createMany).mockResolvedValue({ count: 2 });
      vi.mocked(prisma.contact.create).mockResolvedValue({
        id: "new-1",
        environmentId: mockEnvironmentId,
        attributes: [],
      } as any);

      const result = await createContactsFromCSV(
        csvDataWithMixedCase as any,
        mockEnvironmentId,
        "skip",
        attributeMap
      );

      expect(Array.isArray(result)).toBe(true);
    });

    test("handles userId conflict in update mode when userId already exists for another contact", async () => {
      const attributeMap = { email: "email", userId: "userId" };
      const csvDataWithUserId = [{ email: "john@example.com", userId: "user-1" }];

      const existingContact = {
        id: "existing-1",
        attributes: [
          { attributeKey: { key: "email", id: "key-1" }, value: "john@example.com" },
          { attributeKey: { key: "userId", id: "key-2" }, value: "old-user-id" },
        ],
      };

      const conflictingUserId = {
        value: "user-1",
        contactId: "other-contact-id",
      };

      vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([existingContact as any]);
      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValueOnce([conflictingUserId] as any);
      vi.mocked(prisma.contactAttributeKey.findMany)
        .mockResolvedValueOnce([
          { key: "email", id: "key-1" },
          { key: "userId", id: "key-2" },
        ] as any)
        .mockResolvedValueOnce([] as any);

      vi.mocked(prisma.contact.update).mockResolvedValue(existingContact as any);

      const result = await createContactsFromCSV(
        csvDataWithUserId,
        mockEnvironmentId,
        "update",
        attributeMap
      );

      expect(Array.isArray(result)).toBe(true);
      expect(prisma.contact.update).toHaveBeenCalled();
    });

    test("handles userId conflict in overwrite mode when userId already exists for another contact", async () => {
      const attributeMap = { email: "email", userId: "userId" };
      const csvDataWithUserId = [{ email: "john@example.com", userId: "user-1" }];

      const existingContact = {
        id: "existing-1",
        attributes: [
          { attributeKey: { key: "email", id: "key-1" }, value: "john@example.com" },
          { attributeKey: { key: "userId", id: "key-2" }, value: "old-user-id" },
        ],
      };

      const conflictingUserId = {
        value: "user-1",
        contactId: "other-contact-id",
      };

      vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([existingContact as any]);
      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValueOnce([conflictingUserId] as any);
      vi.mocked(prisma.contactAttributeKey.findMany)
        .mockResolvedValueOnce([
          { key: "email", id: "key-1" },
          { key: "userId", id: "key-2" },
        ] as any)
        .mockResolvedValueOnce([] as any);

      vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 2 });
      vi.mocked(prisma.contact.update).mockResolvedValue(existingContact as any);

      const result = await createContactsFromCSV(
        csvDataWithUserId,
        mockEnvironmentId,
        "overwrite",
        attributeMap
      );

      expect(Array.isArray(result)).toBe(true);
      expect(prisma.contactAttribute.deleteMany).toHaveBeenCalled();
      expect(prisma.contact.update).toHaveBeenCalled();
    });

    test("handles update without existing userId attribute", async () => {
      const attributeMap = { email: "email", userId: "userId" };
      const csvDataWithUserId = [{ email: "john@example.com", userId: "new-user-1" }];

      const existingContact = {
        id: "existing-1",
        attributes: [{ attributeKey: { key: "email", id: "key-1" }, value: "john@example.com" }],
      };

      vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([existingContact as any]);
      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.contactAttributeKey.findMany)
        .mockResolvedValueOnce([
          { key: "email", id: "key-1" },
          { key: "userId", id: "key-2" },
        ] as any)
        .mockResolvedValueOnce([] as any);

      vi.mocked(prisma.contact.update).mockResolvedValue(existingContact as any);

      const result = await createContactsFromCSV(
        csvDataWithUserId,
        mockEnvironmentId,
        "update",
        attributeMap
      );

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("generatePersonalLinks", () => {
    test("generates survey links for contacts in segment", async () => {
      const mockPrismaContactData = [
        {
          id: "contact-1",
          attributes: [
            { value: "john@example.com", attributeKey: { key: "email", name: "Email" } },
            { value: "John", attributeKey: { key: "name", name: "Name" } },
          ],
        },
        {
          id: "contact-2",
          attributes: [
            { value: "jane@example.com", attributeKey: { key: "email", name: "Email" } },
            { value: "Jane", attributeKey: { key: "name", name: "Name" } },
          ],
        },
      ];

      const mockSegmentData = {
        id: mockSegmentId,
        filters: [],
        environmentId: mockEnvironmentId,
      };

      vi.mocked(getSegment).mockResolvedValue(mockSegmentData as any);
      vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
        ok: true,
        data: { whereClause: { environmentId: mockEnvironmentId } },
      } as any);
      vi.mocked(prisma.contact.findMany).mockResolvedValue(mockPrismaContactData as any);

      vi.mocked(getContactSurveyLink)
        .mockResolvedValueOnce({ ok: true, data: "https://survey.com/c/token1" } as any)
        .mockResolvedValueOnce({ ok: true, data: "https://survey.com/c/token2" } as any);

      const result = await generatePersonalLinks(mockSurveyId, mockSegmentId);

      expect(result).toHaveLength(2);
      expect(result?.[0].contactId).toBe("contact-1");
      expect(result?.[0].surveyUrl).toBe("https://survey.com/c/token1");
    });

    test("generates survey links with expiration", async () => {
      const mockPrismaContactData = [
        {
          id: "contact-1",
          attributes: [{ value: "john@example.com", attributeKey: { key: "email", name: "Email" } }],
        },
      ];

      const mockSegmentData = {
        id: mockSegmentId,
        filters: [],
        environmentId: mockEnvironmentId,
      };

      vi.mocked(getSegment).mockResolvedValue(mockSegmentData as any);
      vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
        ok: true,
        data: { whereClause: { environmentId: mockEnvironmentId } },
      } as any);
      vi.mocked(prisma.contact.findMany).mockResolvedValue(mockPrismaContactData as any);
      vi.mocked(getContactSurveyLink).mockResolvedValue({
        ok: true,
        data: "https://survey.com/c/token1",
      } as any);

      const result = await generatePersonalLinks(mockSurveyId, mockSegmentId, 7);

      expect(result).toHaveLength(1);
      expect(result?.[0].expirationDays).toBe(7);
      expect(getContactSurveyLink).toHaveBeenCalledWith("contact-1", mockSurveyId, 7);
    });

    test("filters out failed survey link generations", async () => {
      const mockPrismaContactData = [
        {
          id: "contact-1",
          attributes: [{ value: "john@example.com", attributeKey: { key: "email", name: "Email" } }],
        },
        {
          id: "contact-2",
          attributes: [{ value: "jane@example.com", attributeKey: { key: "email", name: "Email" } }],
        },
      ];

      const mockSegmentData = {
        id: mockSegmentId,
        filters: [],
        environmentId: mockEnvironmentId,
      };

      vi.mocked(getSegment).mockResolvedValue(mockSegmentData as any);
      vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
        ok: true,
        data: { whereClause: { environmentId: mockEnvironmentId } },
      } as any);
      vi.mocked(prisma.contact.findMany).mockResolvedValue(mockPrismaContactData as any);
      vi.mocked(getContactSurveyLink)
        .mockResolvedValueOnce({ ok: true, data: "https://survey.com/c/token1" } as any)
        .mockResolvedValueOnce({ ok: false, error: "Failed to generate link" } as any);

      const result = await generatePersonalLinks(mockSurveyId, mockSegmentId);

      expect(result).toHaveLength(1);
      expect(result?.[0].contactId).toBe("contact-1");
    });

    test("returns null when getContactsInSegment fails", async () => {
      vi.mocked(getSegment).mockResolvedValue(null);

      const result = await generatePersonalLinks(mockSurveyId, mockSegmentId);

      expect(result).toBeNull();
    });

    test("handles empty segment", async () => {
      const mockSegmentData = {
        id: mockSegmentId,
        filters: [],
        environmentId: mockEnvironmentId,
      };

      vi.mocked(getSegment).mockResolvedValue(mockSegmentData as any);
      vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
        ok: true,
        data: { whereClause: { environmentId: mockEnvironmentId } },
      } as any);
      vi.mocked(prisma.contact.findMany).mockResolvedValue([]);

      const result = await generatePersonalLinks(mockSurveyId, mockSegmentId);

      expect(result).toEqual([]);
    });

    test("logs errors when link generation fails", async () => {
      const mockPrismaContactData = [
        {
          id: "contact-1",
          attributes: [{ value: "john@example.com", attributeKey: { key: "email", name: "Email" } }],
        },
      ];

      const mockSegmentData = {
        id: mockSegmentId,
        filters: [],
        environmentId: mockEnvironmentId,
      };

      vi.mocked(getSegment).mockResolvedValue(mockSegmentData as any);
      vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
        ok: true,
        data: { whereClause: { environmentId: mockEnvironmentId } },
      } as any);
      vi.mocked(prisma.contact.findMany).mockResolvedValue(mockPrismaContactData as any);
      vi.mocked(getContactSurveyLink).mockResolvedValue({
        ok: false,
        error: "Generation failed",
      } as any);

      const result = await generatePersonalLinks(mockSurveyId, mockSegmentId);

      expect(result).toHaveLength(0);
    });
  });
});
