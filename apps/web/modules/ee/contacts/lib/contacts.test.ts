import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import { getSurvey } from "@/lib/survey/service";
import type { TSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { getContactSurveyLink } from "@/modules/ee/contacts/lib/contact-survey-link";
import {
  SEGMENT_SURVEY_FILTERS_NOT_VISIBLE_ERROR_CODE,
  SEGMENT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE,
} from "@/modules/ee/contacts/lib/personal-link-errors";
import { segmentFilterToPrismaQuery } from "@/modules/ee/contacts/segments/lib/filter/prisma-query";
import { getSegment } from "@/modules/ee/contacts/segments/lib/segments";
import {
  ContactInSharedDirectoryError,
  buildContactWhereClause,
  createContactsFromCSV,
  deleteContactInWorkspace,
  generatePersonalLinks,
  getContactInWorkspace,
  getContactsInSegment,
} from "./contacts";

vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
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
    survey: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: vi.fn(),
}));

// A workspace's contact directory here is `dir-<workspaceId>`; a segment belongs to its directory.
vi.mock("@/modules/ee/contacts/segments/lib/segments", async () => {
  const { ResourceNotFoundError } = await import("@formbricks/types/errors");
  const getSegment = vi.fn();
  const isSegmentOfWorkspace = async (segment: { directoryId: string | null }, workspaceId: string) =>
    segment.directoryId === `dir-${workspaceId}`;
  return {
    getSegment,
    isSegmentOfWorkspace,
    getSegmentInWorkspace: async (segmentId: string, workspaceId: string) => {
      const segment = await getSegment(segmentId);
      if (!(await isSegmentOfWorkspace(segment, workspaceId))) {
        throw new ResourceNotFoundError("segment", segmentId);
      }
      return segment;
    },
  };
});

vi.mock("@/modules/ee/contacts/segments/lib/filter/prisma-query", () => ({
  segmentFilterToPrismaQuery: vi.fn(),
}));

vi.mock("@/modules/ee/contacts/lib/contact-survey-link", () => ({
  getContactSurveyLink: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

const mockWorkspaceId = "workspace-123";
const mockDirectory = { id: "directory-123", matchingKey: "email" as const };
const mockContactId = "contact-123";
const mockSegmentId = "segment-123";
const mockSurveyId = "survey-123";
const mockMemberUserId = "member-user-1";
/** An organization `member`: sees workspace-visible surveys and the ones they own, never another's restricted one. */
const memberActor: TSurveyActorContext = {
  enforced: true,
  isOrganizationAdmin: false,
  kind: "user",
  userId: mockMemberUserId,
};
const adminActor: TSurveyActorContext = {
  enforced: true,
  isOrganizationAdmin: true,
  kind: "user",
  userId: "owner-user-1",
};
/** The contacts a workspace sees: every contact of its directory, never `contact.workspaceId`. */
const directoryScope = { directory: { workspaces: { some: { id: mockWorkspaceId } } } };
const mockPrismaContact = {
  id: mockContactId,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-02"),
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

describe("Contacts Lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildContactWhereClause", () => {
    test("scopes to the workspace's contact directory when no search is provided", () => {
      const result = buildContactWhereClause(mockWorkspaceId);
      expect(result).toEqual(directoryScope);
    });

    test("returns where clause with search filters when search is provided", () => {
      const searchTerm = "john";
      const result = buildContactWhereClause(mockWorkspaceId, searchTerm);

      expect(result).toEqual({
        ...directoryScope,
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
      const result = buildContactWhereClause(mockWorkspaceId, "");
      expect(result).toEqual(directoryScope);
    });
  });

  describe("getContactsInSegment", () => {
    test("returns contacts in segment with attributes", async () => {
      const mockSegmentData = {
        id: mockSegmentId,
        filters: [],
        workspaceId: mockWorkspaceId,
        directoryId: `dir-${mockWorkspaceId}`,
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

      vi.mocked(getSegment, { partial: true, deep: true }).mockResolvedValue(mockSegmentData);
      vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
        ok: true,
        data: { whereClause: { workspaceId: mockWorkspaceId } },
      } as unknown as Awaited<ReturnType<typeof segmentFilterToPrismaQuery>>);
      vi.mocked(prisma.contact.findMany, { partial: true, deep: true }).mockResolvedValue(
        mockContactsInSegment
      );

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
      vi.mocked(getSegment).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof getSegment>>);

      const result = await getContactsInSegment(mockSegmentId);

      expect(result).toBeNull();
    });

    test("returns null when segmentFilterToPrismaQuery fails", async () => {
      const mockSegmentData = {
        id: mockSegmentId,
        filters: [],
        workspaceId: mockWorkspaceId,
        directoryId: `dir-${mockWorkspaceId}`,
      };

      vi.mocked(getSegment, { partial: true, deep: true }).mockResolvedValue(mockSegmentData);
      vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
        ok: false,
        error: "Filter error",
      });

      const result = await getContactsInSegment(mockSegmentId);

      expect(result).toBeNull();
    });

    test("returns null on database error", async () => {
      const mockSegmentData = {
        id: mockSegmentId,
        filters: [],
        workspaceId: mockWorkspaceId,
        directoryId: `dir-${mockWorkspaceId}`,
      };

      vi.mocked(getSegment, { partial: true, deep: true }).mockResolvedValue(mockSegmentData);
      vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
        ok: true,
        data: { whereClause: { workspaceId: mockWorkspaceId } },
      } as unknown as Awaited<ReturnType<typeof segmentFilterToPrismaQuery>>);
      vi.mocked(prisma.contact.findMany).mockRejectedValue(new Error("DB Error"));

      const result = await getContactsInSegment(mockSegmentId);

      expect(result).toBeNull();
    });

    test("handles contacts with multiple attributes", async () => {
      const mockSegmentData = {
        id: mockSegmentId,
        filters: [],
        workspaceId: mockWorkspaceId,
        directoryId: `dir-${mockWorkspaceId}`,
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

      vi.mocked(getSegment, { partial: true, deep: true }).mockResolvedValue(mockSegmentData);
      vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
        ok: true,
        data: { whereClause: { workspaceId: mockWorkspaceId } },
      } as unknown as Awaited<ReturnType<typeof segmentFilterToPrismaQuery>>);
      vi.mocked(prisma.contact.findMany, { partial: true, deep: true }).mockResolvedValue(
        mockContactsInSegment
      );

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

  // ENG-2290: the contact detail page authorizes the workspace in the URL and must not be able to
  // load a contact of another directory with it.
  describe("getContactInWorkspace", () => {
    test("returns the contact when it is in the workspace's directory", async () => {
      vi.mocked(prisma.contact.findFirst, { partial: true, deep: true }).mockResolvedValue({
        ...mockPrismaContact,
        workspaceId: "workspace-origin",
      });

      const result = await getContactInWorkspace(mockContactId, mockWorkspaceId);

      // The origin workspace is reported as it is.
      expect(result).toEqual({ ...mockPrismaContact, workspaceId: "workspace-origin" });
      expect(prisma.contact.findFirst).toHaveBeenCalledWith({
        where: { id: mockContactId, ...directoryScope },
        select: expect.any(Object),
      });
    });

    test("reports the caller's workspace when the contact's origin workspace is gone", async () => {
      vi.mocked(prisma.contact.findFirst, { partial: true, deep: true }).mockResolvedValue({
        ...mockPrismaContact,
        workspaceId: null,
      });

      const result = await getContactInWorkspace(mockContactId, mockWorkspaceId);

      expect(result?.workspaceId).toBe(mockWorkspaceId);
    });

    test("returns null for a contact of another directory", async () => {
      // The scoped where clause is what makes this null: Prisma finds no row for the pair.
      vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);

      const result = await getContactInWorkspace(mockContactId, "workspace-attacker");

      expect(result).toBeNull();
      expect(prisma.contact.findFirst).toHaveBeenCalledWith({
        where: { id: mockContactId, directory: { workspaces: { some: { id: "workspace-attacker" } } } },
        select: expect.any(Object),
      });
      expect(prisma.contact.findUnique).not.toHaveBeenCalled();
    });

    test("throws DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("DB Error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.contact.findFirst).mockRejectedValue(prismaError);

      await expect(getContactInWorkspace(mockContactId, mockWorkspaceId)).rejects.toThrow(DatabaseError);
    });

    test("re-throws non-Prisma errors", async () => {
      const error = new Error("Unknown error");
      vi.mocked(prisma.contact.findFirst).mockRejectedValue(error);

      await expect(getContactInWorkspace(mockContactId, mockWorkspaceId)).rejects.toThrow(error);
    });
  });

  // Decision 9: deleting a contact also deletes its responses and displays, so it is refused while
  // another workspace uses the contact's directory.
  describe("deleteContactInWorkspace", () => {
    test("deletes a contact of an unshared directory and returns it", async () => {
      vi.mocked(prisma.contact.findFirst, { partial: true, deep: true }).mockResolvedValue({
        ...mockPrismaContact,
        workspaceId: mockWorkspaceId,
      });
      vi.mocked(prisma.contact.deleteMany).mockResolvedValue({ count: 1 });

      const result = await deleteContactInWorkspace(mockContactId, mockWorkspaceId);

      expect(result).toEqual({ ...mockPrismaContact, workspaceId: mockWorkspaceId });
      // The share check is part of the delete: a directory every workspace of which is the caller's.
      expect(prisma.contact.deleteMany).toHaveBeenCalledWith({
        where: {
          id: mockContactId,
          directory: {
            workspaces: { some: { id: mockWorkspaceId }, every: { id: mockWorkspaceId } },
          },
        },
      });
    });

    test("refuses a contact of a shared directory", async () => {
      vi.mocked(prisma.contact.findFirst, { partial: true, deep: true }).mockResolvedValue({
        ...mockPrismaContact,
        workspaceId: mockWorkspaceId,
      });
      vi.mocked(prisma.contact.deleteMany).mockResolvedValue({ count: 0 });

      await expect(deleteContactInWorkspace(mockContactId, mockWorkspaceId)).rejects.toThrow(
        ContactInSharedDirectoryError
      );
    });

    test("does not delete a contact of another directory", async () => {
      vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);

      await expect(deleteContactInWorkspace(mockContactId, "workspace-attacker")).rejects.toThrow(
        ResourceNotFoundError
      );
      expect(prisma.contact.findFirst).toHaveBeenCalledWith({
        where: { id: mockContactId, directory: { workspaces: { some: { id: "workspace-attacker" } } } },
        select: expect.any(Object),
      });
      expect(prisma.contact.deleteMany).not.toHaveBeenCalled();
    });

    test("throws DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("DB Error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.contact.findFirst).mockRejectedValue(prismaError);

      await expect(deleteContactInWorkspace(mockContactId, mockWorkspaceId)).rejects.toThrow(DatabaseError);
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
      vi.mocked(prisma.contactAttributeKey.createMany).mockResolvedValue({ count: 1 });

      // email and userId already exist as default keys; only "name" is new
      vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true })
        .mockResolvedValueOnce([
          { key: "email", id: "key-1", dataType: "string" },
          { key: "userId", id: "key-2", dataType: "string" },
        ])
        .mockResolvedValueOnce([{ key: "name", id: "key-3", dataType: "string" }]);

      const mockCreatedContact = {
        id: "new-contact-1",
        workspaceId: mockWorkspaceId,
        attributes: [{ attributeKey: { key: "email" }, value: "john@example.com" }],
      };
      vi.mocked(prisma.contact.create, { partial: true, deep: true }).mockResolvedValue(mockCreatedContact);

      const result = await createContactsFromCSV(
        csvData,
        mockWorkspaceId,
        mockDirectory,
        "skip",
        attributeMap
      );

      expect(result).toBeDefined();
      expect("contacts" in result).toBe(true);
    });

    test("skips duplicate contacts when duplicateContactsAction is skip", async () => {
      const attributeMap = { email: "email", userId: "userId" };
      const existingContact = {
        id: "existing-1",
        attributes: [{ attributeKey: { key: "email", id: "key-1" }, value: "john@example.com" }],
      };

      vi.mocked(prisma.contact.findMany, { partial: true, deep: true }).mockResolvedValueOnce([
        existingContact,
      ]);
      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
      // email and userId already exist as default keys; only "name" is new
      vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true })
        .mockResolvedValueOnce([
          { key: "email", id: "key-1", dataType: "string" },
          { key: "userId", id: "key-2", dataType: "string" },
        ])
        .mockResolvedValueOnce([{ key: "name", id: "key-3", dataType: "string" }]);
      vi.mocked(prisma.contactAttributeKey.createMany).mockResolvedValue({ count: 1 });

      const result = await createContactsFromCSV(
        csvData,
        mockWorkspaceId,
        mockDirectory,
        "skip",
        attributeMap
      );

      expect("contacts" in result).toBe(true);
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

      vi.mocked(prisma.contact.findMany, { partial: true, deep: true }).mockResolvedValueOnce([
        existingContact,
      ]);
      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
      vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true })
        .mockResolvedValueOnce([
          { key: "email", id: "key-1" },
          { key: "userId", id: "key-2" },
        ])
        .mockResolvedValueOnce([{ key: "name", id: "key-3" }]);
      vi.mocked(prisma.contactAttributeKey.createMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.contact.update, { partial: true, deep: true }).mockResolvedValue(existingContact);

      const result = await createContactsFromCSV(
        csvData,
        mockWorkspaceId,
        mockDirectory,
        "update",
        attributeMap
      );

      expect("contacts" in result).toBe(true);
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

      vi.mocked(prisma.contact.findMany, { partial: true, deep: true }).mockResolvedValueOnce([
        existingContact,
      ]);
      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
      vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true })
        .mockResolvedValueOnce([
          { key: "email", id: "key-1" },
          { key: "userId", id: "key-2" },
        ])
        .mockResolvedValueOnce([{ key: "name", id: "key-3" }]);
      vi.mocked(prisma.contactAttributeKey.createMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 2 });
      vi.mocked(prisma.contact.update, { partial: true, deep: true }).mockResolvedValue(existingContact);

      const result = await createContactsFromCSV(
        csvData,
        mockWorkspaceId,
        mockDirectory,
        "overwrite",
        attributeMap
      );

      expect("contacts" in result).toBe(true);
    });

    test("throws ValidationError when email is missing", async () => {
      const invalidCsvData = [{ userId: "user-1", name: "John" }];
      const attributeMap = { userId: "userId", name: "name" };

      vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true })
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ key: "userid", id: "key-1" }]);

      await expect(
        createContactsFromCSV(
          invalidCsvData as Parameters<typeof createContactsFromCSV>[0],
          mockWorkspaceId,
          mockDirectory,
          "skip",
          attributeMap
        )
      ).rejects.toThrow(ValidationError);
    });

    test("throws ValidationError when CSV creates reserved future default keys", async () => {
      const reservedCsvData = [{ email: "john@example.com", user_id: "user-1" }];
      const attributeMap = { email: "email", user_id: "user_id" };

      vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
      vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true }).mockResolvedValueOnce([
        { key: "email", id: "key-1", dataType: "string" },
      ]);

      await expect(
        createContactsFromCSV(
          reservedCsvData as Parameters<typeof createContactsFromCSV>[0],
          mockWorkspaceId,
          mockDirectory,
          "skip",
          attributeMap
        )
      ).rejects.toThrow(ValidationError);
      expect(prisma.contactAttributeKey.createMany).not.toHaveBeenCalled();
    });

    test("throws DatabaseError on Prisma error", async () => {
      const attributeMap = { email: "email" };
      const prismaError = new Prisma.PrismaClientKnownRequestError("DB Error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });

      vi.mocked(prisma.contact.findMany).mockRejectedValue(prismaError);

      await expect(
        createContactsFromCSV(csvData, mockWorkspaceId, mockDirectory, "skip", attributeMap)
      ).rejects.toThrow(DatabaseError);
    });

    test("creates missing attribute keys", async () => {
      const attributeMap = { email: "email", userId: "userId" };
      vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
      // email and userId already exist as default keys; only "name" is new
      vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true })
        .mockResolvedValueOnce([
          { key: "email", id: "key-1", dataType: "string" },
          { key: "userId", id: "key-2", dataType: "string" },
        ])
        .mockResolvedValueOnce([{ key: "name", id: "key-3", dataType: "string" }]);
      vi.mocked(prisma.contactAttributeKey.createMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.contact.create).mockResolvedValue({
        id: "new-1",
        workspaceId: mockWorkspaceId,
        attributes: [],
      } as unknown as Awaited<ReturnType<typeof prisma.contact.create>>);

      const result = await createContactsFromCSV(
        csvData,
        mockWorkspaceId,
        mockDirectory,
        "skip",
        attributeMap
      );

      expect(prisma.contactAttributeKey.createMany).toHaveBeenCalled();
      expect("contacts" in result).toBe(true);
    });

    test("handles case-insensitive attribute keys", async () => {
      const csvDataWithMixedCase = [{ email: "john@example.com", UserId: "user-1" }];
      const attributeMap = { email: "email", userid: "userId" };

      vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([]);

      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
      // Email and UserId already exist (case-insensitive matching via lowercaseToActualKeyMap)
      vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true }).mockResolvedValueOnce([
        { key: "email", id: "key-1", dataType: "string" },
        { key: "UserId", id: "key-2", dataType: "string" },
      ]);
      vi.mocked(prisma.contact.create).mockResolvedValue({
        id: "new-1",
        workspaceId: mockWorkspaceId,
        attributes: [],
      } as unknown as Awaited<ReturnType<typeof prisma.contact.create>>);

      const result = await createContactsFromCSV(
        csvDataWithMixedCase,
        mockWorkspaceId,
        mockDirectory,
        "skip",
        attributeMap
      );

      expect("contacts" in result).toBe(true);
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

      vi.mocked(prisma.contact.findMany, { partial: true, deep: true }).mockResolvedValueOnce([
        existingContact,
      ]);
      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValueOnce([conflictingUserId] as Awaited<
        ReturnType<typeof prisma.contactAttribute.findMany>
      >);
      vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true })
        .mockResolvedValueOnce([
          { key: "email", id: "key-1" },
          { key: "userId", id: "key-2" },
        ])
        .mockResolvedValueOnce([]);

      vi.mocked(prisma.contact.update, { partial: true, deep: true }).mockResolvedValue(existingContact);

      const result = await createContactsFromCSV(
        csvDataWithUserId,
        mockWorkspaceId,
        mockDirectory,
        "update",
        attributeMap
      );

      expect("contacts" in result).toBe(true);
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

      vi.mocked(prisma.contact.findMany, { partial: true, deep: true }).mockResolvedValueOnce([
        existingContact,
      ]);
      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValueOnce([conflictingUserId] as Awaited<
        ReturnType<typeof prisma.contactAttribute.findMany>
      >);
      vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true })
        .mockResolvedValueOnce([
          { key: "email", id: "key-1" },
          { key: "userId", id: "key-2" },
        ])
        .mockResolvedValueOnce([]);

      vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 2 });
      vi.mocked(prisma.contact.update, { partial: true, deep: true }).mockResolvedValue(existingContact);

      const result = await createContactsFromCSV(
        csvDataWithUserId,
        mockWorkspaceId,
        mockDirectory,
        "overwrite",
        attributeMap
      );

      expect("contacts" in result).toBe(true);
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

      vi.mocked(prisma.contact.findMany, { partial: true, deep: true }).mockResolvedValueOnce([
        existingContact,
      ]);
      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true })
        .mockResolvedValueOnce([
          { key: "email", id: "key-1" },
          { key: "userId", id: "key-2" },
        ])
        .mockResolvedValueOnce([]);

      vi.mocked(prisma.contact.update, { partial: true, deep: true }).mockResolvedValue(existingContact);

      const result = await createContactsFromCSV(
        csvDataWithUserId,
        mockWorkspaceId,
        mockDirectory,
        "update",
        attributeMap
      );

      expect("contacts" in result).toBe(true);
    });
  });

  describe("createContactsFromCSV in a contact directory", () => {
    const keys = [
      { key: "email", id: "key-email", dataType: "string" as const },
      { key: "userId", id: "key-user", dataType: "string" as const },
      { key: "externalId", id: "key-ext", dataType: "string" as const },
    ];
    type TCreatedContact = Awaited<ReturnType<typeof prisma.contact.create>>;
    const existing = (id: string, attributes: Record<string, string>) => ({
      id,
      attributes: Object.entries(attributes).map(([key, value]) => ({
        attributeKey: { key, id: `key-${key}` },
        value,
      })),
    });

    beforeEach(() => {
      vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
      vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true }).mockResolvedValue(keys);
    });

    test("reads contacts, userIds and keys of the directory, oldest contact first", async () => {
      vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.contact.create).mockResolvedValue({
        id: "new-1",
        attributes: [],
      } as unknown as TCreatedContact);

      await createContactsFromCSV([{ email: "a@example.com" }], mockWorkspaceId, mockDirectory, "skip", {});

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            directoryId: "directory-123",
            attributes: {
              some: {
                attributeKey: { key: "email", directoryId: "directory-123" },
                value: { in: ["a@example.com"] },
              },
            },
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })
      );
      expect(prisma.contactAttributeKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { directoryId: "directory-123" } })
      );
      expect(prisma.contact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ directoryId: "directory-123", workspaceId: mockWorkspaceId }),
        })
      );
    });

    test("creates new keys in the directory, with the workspace as their origin", async () => {
      vi.mocked(prisma.contact.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.contactAttributeKey.findMany, { partial: true, deep: true })
        .mockResolvedValueOnce(keys)
        .mockResolvedValueOnce([{ key: "plan", id: "key-plan", dataType: "string" as const }]);
      vi.mocked(prisma.contactAttributeKey.createMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.contact.create).mockResolvedValue({
        id: "new-1",
        attributes: [],
      } as unknown as TCreatedContact);

      await createContactsFromCSV(
        [{ email: "a@example.com", plan: "pro" }],
        mockWorkspaceId,
        mockDirectory,
        "skip",
        {}
      );

      expect(prisma.contactAttributeKey.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            key: "plan",
            directoryId: "directory-123",
            workspaceId: mockWorkspaceId,
          }),
        ],
        skipDuplicates: true,
      });
      expect(prisma.contactAttributeKey.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { directoryId: "directory-123", key: { in: ["plan"] } } })
      );
    });

    test("a row matching several contacts updates the one with the row's userId and counts it", async () => {
      vi.mocked(prisma.contact.findMany, { partial: true, deep: true }).mockResolvedValueOnce([
        existing("oldest", { email: "a@example.com", userId: "u-old" }),
        existing("same-user", { email: "a@example.com", userId: "u-1" }),
      ]);
      vi.mocked(prisma.contact.update).mockResolvedValue({
        id: "same-user",
        attributes: [],
      } as unknown as Awaited<ReturnType<typeof prisma.contact.update>>);

      const result = await createContactsFromCSV(
        [{ email: "a@example.com", userId: "u-1" }],
        mockWorkspaceId,
        mockDirectory,
        "update",
        {}
      );

      expect(prisma.contact.update).toHaveBeenCalledTimes(1);
      expect(prisma.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "same-user" } })
      );
      expect(result).toEqual(expect.objectContaining({ multiMatchCount: 1 }));
    });

    test("a row matching several contacts with no userId match updates the oldest", async () => {
      vi.mocked(prisma.contact.findMany, { partial: true, deep: true }).mockResolvedValueOnce([
        existing("oldest", { email: "a@example.com" }),
        existing("newer", { email: "a@example.com" }),
        existing("single", { email: "b@example.com" }),
      ]);
      vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.contact.update).mockResolvedValue({
        id: "oldest",
        attributes: [],
      } as unknown as Awaited<ReturnType<typeof prisma.contact.update>>);

      const result = await createContactsFromCSV(
        [{ email: "a@example.com" }, { email: "b@example.com" }],
        mockWorkspaceId,
        mockDirectory,
        "overwrite",
        {}
      );

      const updatedIds = vi.mocked(prisma.contact.update).mock.calls.map(([args]) => args.where.id);
      expect(updatedIds.sort((a, b) => (a ?? "").localeCompare(b ?? ""))).toEqual(["oldest", "single"]);
      expect(prisma.contactAttribute.deleteMany).not.toHaveBeenCalledWith({ where: { contactId: "newer" } });
      expect(result).toEqual(expect.objectContaining({ multiMatchCount: 1 }));
    });

    test("skipped rows are not counted as multi-matches", async () => {
      vi.mocked(prisma.contact.findMany, { partial: true, deep: true }).mockResolvedValueOnce([
        existing("oldest", { email: "a@example.com" }),
        existing("newer", { email: "a@example.com" }),
      ]);

      const result = await createContactsFromCSV(
        [{ email: "a@example.com" }],
        mockWorkspaceId,
        mockDirectory,
        "skip",
        {}
      );

      expect(prisma.contact.update).not.toHaveBeenCalled();
      expect(result).toEqual({ contacts: [], multiMatchCount: 0 });
    });

    test("an external-ID directory matches rows on externalId", async () => {
      const externalIdDirectory = { id: "directory-ext", matchingKey: "externalId" as const };
      vi.mocked(prisma.contact.findMany, { partial: true, deep: true }).mockResolvedValueOnce([
        existing("crm-contact", { externalId: "crm-1" }),
      ]);
      vi.mocked(prisma.contact.update).mockResolvedValue({
        id: "crm-contact",
        attributes: [],
      } as unknown as Awaited<ReturnType<typeof prisma.contact.update>>);

      await createContactsFromCSV(
        [{ externalId: "crm-1", email: "new@example.com" }],
        mockWorkspaceId,
        externalIdDirectory,
        "update",
        {}
      );

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            attributes: {
              some: {
                attributeKey: { key: "externalId", directoryId: "directory-ext" },
                value: { in: ["crm-1"] },
              },
            },
          }),
        })
      );
      expect(prisma.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "crm-contact" } })
      );
    });

    test("an external-ID directory refuses rows without externalId before any read or write", async () => {
      const externalIdDirectory = { id: "directory-ext", matchingKey: "externalId" as const };

      await expect(
        createContactsFromCSV([{ email: "a@example.com" }], mockWorkspaceId, externalIdDirectory, "skip", {})
      ).rejects.toThrow("Missing externalId field for one or more records");
      expect(prisma.contact.findMany).not.toHaveBeenCalled();
      expect(prisma.contact.create).not.toHaveBeenCalled();
    });
  });

  describe("generatePersonalLinks", () => {
    beforeEach(() => {
      // Default: survey lives in the same workspace as the segment so the
      // cross-tenant guard passes. Individual tests override as needed.
      vi.mocked(getSurvey).mockResolvedValue({ workspaceId: mockWorkspaceId } as Awaited<
        ReturnType<typeof getSurvey>
      >);
    });

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
        workspaceId: mockWorkspaceId,
        directoryId: `dir-${mockWorkspaceId}`,
      };

      vi.mocked(getSegment, { partial: true, deep: true }).mockResolvedValue(mockSegmentData);
      vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
        ok: true,
        data: { whereClause: { workspaceId: mockWorkspaceId } },
      } as unknown as Awaited<ReturnType<typeof segmentFilterToPrismaQuery>>);
      vi.mocked(prisma.contact.findMany, { partial: true, deep: true }).mockResolvedValue(
        mockPrismaContactData
      );

      vi.mocked(getContactSurveyLink)
        .mockResolvedValueOnce({ ok: true, data: "https://survey.com/c/token1" })
        .mockResolvedValueOnce({ ok: true, data: "https://survey.com/c/token2" });

      const result = await generatePersonalLinks(mockSurveyId, mockSegmentId, memberActor);

      expect(result).toHaveLength(2);
      expect(result![0]!.contactId).toBe("contact-1");
      expect(result![0]!.surveyUrl).toBe("https://survey.com/c/token1");
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
        workspaceId: mockWorkspaceId,
        directoryId: `dir-${mockWorkspaceId}`,
      };

      vi.mocked(getSegment, { partial: true, deep: true }).mockResolvedValue(mockSegmentData);
      vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
        ok: true,
        data: { whereClause: { workspaceId: mockWorkspaceId } },
      } as unknown as Awaited<ReturnType<typeof segmentFilterToPrismaQuery>>);
      vi.mocked(prisma.contact.findMany, { partial: true, deep: true }).mockResolvedValue(
        mockPrismaContactData
      );
      vi.mocked(getContactSurveyLink).mockResolvedValue({
        ok: true,
        data: "https://survey.com/c/token1",
      });

      const result = await generatePersonalLinks(mockSurveyId, mockSegmentId, memberActor, 7);

      const links = result!;
      expect(links).toHaveLength(1);
      expect(links[0]!.expirationDays).toBe(7);
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
        workspaceId: mockWorkspaceId,
        directoryId: `dir-${mockWorkspaceId}`,
      };

      vi.mocked(getSegment, { partial: true, deep: true }).mockResolvedValue(mockSegmentData);
      vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
        ok: true,
        data: { whereClause: { workspaceId: mockWorkspaceId } },
      } as unknown as Awaited<ReturnType<typeof segmentFilterToPrismaQuery>>);
      vi.mocked(prisma.contact.findMany, { partial: true, deep: true }).mockResolvedValue(
        mockPrismaContactData
      );
      vi.mocked(getContactSurveyLink)
        .mockResolvedValueOnce({ ok: true, data: "https://survey.com/c/token1" })
        .mockResolvedValueOnce({ ok: false, error: "Failed to generate link" } as unknown as Awaited<
          ReturnType<typeof getContactSurveyLink>
        >);

      const result = await generatePersonalLinks(mockSurveyId, mockSegmentId, memberActor);

      const links = result!;
      expect(links).toHaveLength(1);
      expect(links[0]!.contactId).toBe("contact-1");
    });

    test("returns null when getContactsInSegment fails", async () => {
      vi.mocked(getSegment).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof getSegment>>);

      const result = await generatePersonalLinks(mockSurveyId, mockSegmentId, memberActor);

      expect(result).toBeNull();
    });

    test("handles empty segment", async () => {
      const mockSegmentData = {
        id: mockSegmentId,
        filters: [],
        workspaceId: mockWorkspaceId,
        directoryId: `dir-${mockWorkspaceId}`,
      };

      vi.mocked(getSegment, { partial: true, deep: true }).mockResolvedValue(mockSegmentData);
      vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
        ok: true,
        data: { whereClause: { workspaceId: mockWorkspaceId } },
      } as unknown as Awaited<ReturnType<typeof segmentFilterToPrismaQuery>>);
      vi.mocked(prisma.contact.findMany, { partial: true }).mockResolvedValue([]);

      const result = await generatePersonalLinks(mockSurveyId, mockSegmentId, memberActor);

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
        workspaceId: mockWorkspaceId,
        directoryId: `dir-${mockWorkspaceId}`,
      };

      vi.mocked(getSegment, { partial: true, deep: true }).mockResolvedValue(mockSegmentData);
      vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
        ok: true,
        data: { whereClause: { workspaceId: mockWorkspaceId } },
      } as unknown as Awaited<ReturnType<typeof segmentFilterToPrismaQuery>>);
      vi.mocked(prisma.contact.findMany, { partial: true, deep: true }).mockResolvedValue(
        mockPrismaContactData
      );
      vi.mocked(getContactSurveyLink).mockResolvedValue({
        ok: false,
        error: "Generation failed",
      } as unknown as Awaited<ReturnType<typeof getContactSurveyLink>>);

      const result = await generatePersonalLinks(mockSurveyId, mockSegmentId, memberActor);

      expect(result).toHaveLength(0);
    });

    // Decision 24: a shared segment made in another workspace of the survey's directory is the survey's
    // to use, even once that workspace is deleted; its contacts are read in the directory.
    test("generates links for a shared segment another workspace of the directory made", async () => {
      vi.mocked(getSegment, { partial: true, deep: true }).mockResolvedValue({
        id: mockSegmentId,
        filters: [],
        workspaceId: null,
        directoryId: `dir-${mockWorkspaceId}`,
      });
      vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
        ok: true,
        data: { whereClause: {} },
      } as unknown as Awaited<ReturnType<typeof segmentFilterToPrismaQuery>>);
      vi.mocked(prisma.contact.findMany, { partial: true }).mockResolvedValue([]);

      await expect(generatePersonalLinks(mockSurveyId, mockSegmentId, memberActor)).resolves.toEqual([]);
      expect(segmentFilterToPrismaQuery).toHaveBeenCalledWith(mockSegmentId, [], `dir-${mockWorkspaceId}`);
    });

    test("throws when the segment belongs to a different workspace than the survey (cross-tenant guard)", async () => {
      // Survey is in workspace A, segment is in workspace B. The caller was only
      // authorized against the survey's workspace, so reading the segment's
      // contacts would leak another workspace's PII. Must reject before any
      // contact is read.
      vi.mocked(getSurvey).mockResolvedValue({ workspaceId: "workspace-A" } as Awaited<
        ReturnType<typeof getSurvey>
      >);
      vi.mocked(getSegment, { partial: true, deep: true }).mockResolvedValue({
        id: mockSegmentId,
        filters: [],
        workspaceId: "workspace-B",
        directoryId: "dir-workspace-B",
      });

      await expect(generatePersonalLinks(mockSurveyId, mockSegmentId, memberActor)).rejects.toThrow(
        ValidationError
      );
      // Message is a stable error code the client maps to a localized string.
      await expect(generatePersonalLinks(mockSurveyId, mockSegmentId, memberActor)).rejects.toThrow(
        SEGMENT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE
      );

      // No contacts should have been queried for the foreign segment.
      expect(prisma.contact.findMany).not.toHaveBeenCalled();
      expect(getContactSurveyLink).not.toHaveBeenCalled();
    });

    describe("survey visibility of the segment's filters (ENG-6870)", () => {
      const restrictedSurveyId = "clrestricted00000000000001";
      const visibleSurveyId = "clvisible000000000000000001";
      const destinationSurveyId = "cldestination000000000001";
      const within = { amount: 30, unit: "days" } as const;

      const completed = (id: string, surveyScope: "any" | "specific", surveyIds: string[] = []) => ({
        id,
        root: { type: "surveyInteraction" },
        qualifier: { operator: "haveCompleted" },
        value: { surveyScope, surveyIds, within },
      });

      /** Completed any survey, but not two the member can see. */
      const anyScopeFilters = [
        { id: "f1", connector: null, resource: completed("i1", "any") },
        {
          id: "f2",
          connector: "and",
          resource: {
            ...completed("i2", "specific", [visibleSurveyId, destinationSurveyId]),
            qualifier: { operator: "haveNotCompleted" },
          },
        },
      ];
      const specificFilters = [
        { id: "f1", connector: null, resource: completed("i1", "specific", [restrictedSurveyId]) },
      ];

      const segmentWith = (filters: unknown, id = mockSegmentId) =>
        ({ id, filters, workspaceId: mockWorkspaceId, directoryId: `dir-${mockWorkspaceId}` }) as Awaited<
          ReturnType<typeof getSegment>
        >;

      /** Whatever reached the contact query would end up in the CSV. */
      const mockSegmentContacts = () => {
        vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
          ok: true,
          data: { whereClause: { workspaceId: mockWorkspaceId } },
        } as unknown as Awaited<ReturnType<typeof segmentFilterToPrismaQuery>>);
        vi.mocked(prisma.contact.findMany).mockResolvedValue([
          { id: "contact-restricted-respondent", attributes: [] },
        ] as unknown as Awaited<ReturnType<typeof prisma.contact.findMany>>);
        vi.mocked(getContactSurveyLink, { partial: true }).mockResolvedValue({
          ok: true,
          data: "https://survey.com/c/t",
        });
      };

      /** The clause a member's hidden surveys are found by: restricted and owned by someone else. */
      const memberHiddenSurveyWhere = {
        AND: [
          expect.objectContaining({ OR: expect.arrayContaining([{ visibility: "restricted" }]) }),
          { OR: [{ ownerId: null }, { ownerId: { not: mockMemberUserId } }] },
        ],
      };

      beforeEach(() => {
        mockSegmentContacts();
      });

      test("refuses a member a segment that names a restricted survey they can't see", async () => {
        vi.mocked(getSegment).mockResolvedValue(segmentWith(specificFilters));
        vi.mocked(prisma.survey.findFirst).mockResolvedValue({ id: restrictedSurveyId } as Awaited<
          ReturnType<typeof prisma.survey.findFirst>
        >);

        await expect(generatePersonalLinks(mockSurveyId, mockSegmentId, memberActor)).rejects.toThrow(
          new ValidationError(SEGMENT_SURVEY_FILTERS_NOT_VISIBLE_ERROR_CODE)
        );

        expect(prisma.survey.findFirst).toHaveBeenCalledWith({
          where: {
            id: { in: [restrictedSurveyId] },
            workspaceId: mockWorkspaceId,
            AND: [memberHiddenSurveyWhere],
          },
          select: { id: true },
        });
        expect(prisma.contact.findMany).not.toHaveBeenCalled();
        expect(getContactSurveyLink).not.toHaveBeenCalled();
      });

      // `any` scope only reads workspace-visible surveys (see `isWorkspaceVisibleForAnyScope`), so the
      // fatigue-style rule stays usable by a member and names no survey to check.
      test("lets a member use an `any`-scope segment without a visibility lookup", async () => {
        vi.mocked(getSegment).mockResolvedValue(segmentWith(anyScopeFilters));

        const result = await generatePersonalLinks(mockSurveyId, mockSegmentId, memberActor);

        expect(result).toHaveLength(1);
        // The specific ids next to `any` are the only ones checked.
        expect(prisma.survey.findFirst).toHaveBeenCalledOnce();
        expect(prisma.survey.findFirst).toHaveBeenCalledWith({
          where: {
            id: { in: [visibleSurveyId, destinationSurveyId] },
            workspaceId: mockWorkspaceId,
            AND: [memberHiddenSurveyWhere],
          },
          select: { id: true },
        });
      });

      test("follows nested segment filters to the restricted survey they read", async () => {
        const nestedSegmentId = "clnestedsegment00000000001";
        vi.mocked(getSegment).mockImplementation(async (id: string) =>
          id === nestedSegmentId
            ? segmentWith(specificFilters, nestedSegmentId)
            : segmentWith([
                {
                  id: "f1",
                  connector: null,
                  resource: {
                    id: "s1",
                    root: { type: "segment", segmentId: nestedSegmentId },
                    qualifier: { operator: "userIsIn" },
                    value: nestedSegmentId,
                  },
                },
              ])
        );
        vi.mocked(prisma.survey.findFirst).mockResolvedValue({ id: restrictedSurveyId } as Awaited<
          ReturnType<typeof prisma.survey.findFirst>
        >);

        await expect(generatePersonalLinks(mockSurveyId, mockSegmentId, memberActor)).rejects.toThrow(
          SEGMENT_SURVEY_FILTERS_NOT_VISIBLE_ERROR_CODE
        );
        expect(prisma.survey.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ id: { in: [restrictedSurveyId] } }),
          })
        );
        expect(prisma.contact.findMany).not.toHaveBeenCalled();
      });

      test("generates links for an organization owner without a visibility query", async () => {
        vi.mocked(getSegment).mockResolvedValue(segmentWith(specificFilters));

        const result = await generatePersonalLinks(mockSurveyId, mockSegmentId, adminActor);

        expect(result).toHaveLength(1);
        expect(prisma.survey.findFirst).not.toHaveBeenCalled();
      });
    });

    test("returns null when the survey does not exist", async () => {
      vi.mocked(getSurvey).mockResolvedValue(null as Awaited<ReturnType<typeof getSurvey>>);

      const result = await generatePersonalLinks(mockSurveyId, mockSegmentId, memberActor);

      expect(result).toBeNull();
      expect(getSegment).not.toHaveBeenCalled();
    });
  });
});
