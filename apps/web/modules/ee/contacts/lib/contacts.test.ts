import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
// NOW import modules that depend on mocks
import { FIXTURES, TEST_IDS } from "@/lib/testing/constants";
// Import utilities that DON'T need to be mocked FIRST
import { COMMON_ERRORS, createContactsMocks } from "@/lib/testing/mocks";
import { setupTestEnvironment } from "@/lib/testing/setup";
import { validateInputs } from "@/lib/utils/validate";
import {
  buildContactWhereClause,
  createContactsFromCSV,
  deleteContact,
  generatePersonalLinks,
  getContact,
  getContacts,
  getContactsInSegment,
} from "./contacts";

// Setup ALL mocks BEFORE any other imports
vi.mock("@formbricks/database", () => createContactsMocks());

vi.mock("@/modules/ee/contacts/segments/lib/segments", () => ({
  getSegment: vi.fn(),
}));

vi.mock("@/modules/ee/contacts/segments/lib/filter/prisma-query", () => ({
  segmentFilterToPrismaQuery: vi.fn(),
}));

vi.mock("@/modules/ee/contacts/lib/contact-survey-link", () => ({
  getContactSurveyLink: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@/lib/constants", () => ({
  ITEMS_PER_PAGE: 2,
  ENCRYPTION_KEY: "test-encryption-key-32-chars-long!",
  IS_PRODUCTION: false,
  IS_POSTHOG_CONFIGURED: false,
  POSTHOG_API_HOST: "test-posthog-host",
  POSTHOG_API_KEY: "test-posthog-key",
}));

// Setup standard test environment
setupTestEnvironment();

// Mock validateInputs to return no errors by default
vi.mocked(validateInputs).mockImplementation(() => {
  return [];
});

describe("getContacts", () => {
  test("returns contacts with attributes", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue([FIXTURES.contact]);
    const result = await getContacts(TEST_IDS.environment, 0, "");
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].id).toBe(TEST_IDS.contact);
    expect(result[0].attributes.email).toBe("test@example.com");
  });

  test("returns empty array if no contacts", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue([]);
    const result = await getContacts(TEST_IDS.environment, 0, "");
    expect(result).toEqual([]);
  });

  test("throws DatabaseError on Prisma error", async () => {
    vi.mocked(prisma.contact.findMany).mockRejectedValue(COMMON_ERRORS.UNIQUE_CONSTRAINT);
    await expect(getContacts(TEST_IDS.environment, 0, "")).rejects.toThrow(DatabaseError);
  });

  test("throws original error on unknown error", async () => {
    const genericError = new Error("Unknown error");
    vi.mocked(prisma.contact.findMany).mockRejectedValue(genericError);
    await expect(getContacts(TEST_IDS.environment, 0, "")).rejects.toThrow(genericError);
  });
});

describe("getContact", () => {
  test("returns contact if found", async () => {
    vi.mocked(prisma.contact.findUnique).mockResolvedValue(FIXTURES.contact);
    const result = await getContact(TEST_IDS.contact);
    expect(result).toEqual(FIXTURES.contact);
  });

  test("returns null if not found", async () => {
    vi.mocked(prisma.contact.findUnique).mockResolvedValue(null);
    const result = await getContact(TEST_IDS.contact);
    expect(result).toBeNull();
  });

  test("throws DatabaseError on Prisma error", async () => {
    vi.mocked(prisma.contact.findUnique).mockRejectedValue(COMMON_ERRORS.UNIQUE_CONSTRAINT);
    await expect(getContact(TEST_IDS.contact)).rejects.toThrow(DatabaseError);
  });

  test("throws original error on unknown error", async () => {
    const genericError = new Error("Unknown error");
    vi.mocked(prisma.contact.findUnique).mockRejectedValue(genericError);
    await expect(getContact(TEST_IDS.contact)).rejects.toThrow(genericError);
  });
});

describe("deleteContact", () => {
  test("deletes contact and revalidates caches", async () => {
    vi.mocked(prisma.contact.delete).mockResolvedValue(FIXTURES.contact);
    const result = await deleteContact(TEST_IDS.contact);
    expect(result).toEqual(FIXTURES.contact);
  });

  test("throws DatabaseError on Prisma error", async () => {
    vi.mocked(prisma.contact.delete).mockRejectedValue(COMMON_ERRORS.UNIQUE_CONSTRAINT);
    await expect(deleteContact(TEST_IDS.contact)).rejects.toThrow(DatabaseError);
  });

  test("throws original error on unknown error", async () => {
    const genericError = new Error("Unknown error");
    vi.mocked(prisma.contact.delete).mockRejectedValue(genericError);
    await expect(deleteContact(TEST_IDS.contact)).rejects.toThrow(genericError);
  });
});

describe("createContactsFromCSV", () => {
  test("creates new contacts and missing attribute keys", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue([]);
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
    vi.mocked(prisma.contactAttributeKey.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { key: "email", id: "id-email" },
        { key: "name", id: "id-name" },
      ] as any);
    vi.mocked(prisma.contactAttributeKey.createMany).mockResolvedValue({ count: 2 });
    vi.mocked(prisma.contact.create).mockResolvedValue({
      id: "c1",
      environmentId: TEST_IDS.environment,
      createdAt: new Date(),
      updatedAt: new Date(),
      attributes: [
        { attributeKey: { key: "email" }, value: "john@example.com" },
        { attributeKey: { key: "name" }, value: "John" },
      ],
    } as any);
    const csvData = [{ email: "john@example.com", name: "John" }];
    const result = await createContactsFromCSV(csvData, TEST_IDS.environment, "skip", {
      email: "email",
      name: "name",
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].id).toBe("c1");
  });

  test("skips duplicate contact with 'skip' action", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue([
      { id: "c1", attributes: [{ attributeKey: { key: "email" }, value: "john@example.com" }] },
    ] as any);
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([
      { key: "email", id: "id-email" },
      { key: "name", id: "id-name" },
    ] as any);
    const csvData = [{ email: "john@example.com", name: "John" }];
    const result = await createContactsFromCSV(csvData, TEST_IDS.environment, "skip", {
      email: "email",
      name: "name",
    });
    expect(result).toEqual([]);
  });

  test("updates contact with 'update' action", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue([
      {
        id: "c1",
        attributes: [
          { attributeKey: { key: "email" }, value: "john@example.com" },
          { attributeKey: { key: "name" }, value: "Old" },
        ],
      },
    ] as any);
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([
      { key: "email", id: "id-email" },
      { key: "name", id: "id-name" },
    ] as any);
    vi.mocked(prisma.contact.update).mockResolvedValue({
      id: "c1",
      environmentId: TEST_IDS.environment,
      createdAt: new Date(),
      updatedAt: new Date(),
      attributes: [
        { attributeKey: { key: "email" }, value: "john@example.com" },
        { attributeKey: { key: "name" }, value: "John" },
      ],
    } as any);
    const csvData = [{ email: "john@example.com", name: "John" }];
    const result = await createContactsFromCSV(csvData, TEST_IDS.environment, "update", {
      email: "email",
      name: "name",
    });
    expect(result[0].id).toBe("c1");
  });

  test("overwrites contact with 'overwrite' action", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue([
      {
        id: "c1",
        attributes: [
          { attributeKey: { key: "email" }, value: "john@example.com" },
          { attributeKey: { key: "name" }, value: "Old" },
        ],
      },
    ] as any);
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([
      { key: "email", id: "id-email" },
      { key: "name", id: "id-name" },
    ] as any);
    vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 2 });
    vi.mocked(prisma.contact.update).mockResolvedValue({
      id: "c1",
      environmentId: TEST_IDS.environment,
      createdAt: new Date(),
      updatedAt: new Date(),
      attributes: [
        { attributeKey: { key: "email" }, value: "john@example.com" },
        { attributeKey: { key: "name" }, value: "John" },
      ],
    } as any);
    const csvData = [{ email: "john@example.com", name: "John" }];
    const result = await createContactsFromCSV(csvData, TEST_IDS.environment, "overwrite", {
      email: "email",
      name: "name",
    });
    expect(result[0].id).toBe("c1");
  });

  test("throws ValidationError if email is missing in CSV", async () => {
    // Override the validateInputs mock to return validation errors for this test
    vi.mocked(validateInputs).mockImplementationOnce(() => {
      throw new ValidationError("Validation failed");
    });
    const csvData = [{ name: "John" }];
    await expect(
      createContactsFromCSV(csvData as any, TEST_IDS.environment, "skip", { name: "name" })
    ).rejects.toThrow(ValidationError);
  });

  test("throws DatabaseError on Prisma error", async () => {
    vi.mocked(prisma.contact.findMany).mockRejectedValue(COMMON_ERRORS.UNIQUE_CONSTRAINT);
    const csvData = [{ email: "john@example.com", name: "John" }];
    await expect(
      createContactsFromCSV(csvData, TEST_IDS.environment, "skip", { email: "email", name: "name" })
    ).rejects.toThrow(DatabaseError);
  });

  test("throws original error on unknown error", async () => {
    const genericError = new Error("Unknown error");
    vi.mocked(prisma.contact.findMany).mockRejectedValue(genericError);
    const csvData = [{ email: "john@example.com", name: "John" }];
    await expect(
      createContactsFromCSV(csvData, TEST_IDS.environment, "skip", { email: "email", name: "name" })
    ).rejects.toThrow(genericError);
  });
});

describe("buildContactWhereClause", () => {
  test("returns where clause for email", () => {
    const search = "john";
    const result = buildContactWhereClause(TEST_IDS.environment, search);
    expect(result).toEqual({
      environmentId: TEST_IDS.environment,
      OR: [
        {
          attributes: {
            some: {
              value: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
        {
          id: {
            contains: search,
            mode: "insensitive",
          },
        },
      ],
    });
  });

  test("returns where clause without search", () => {
    const result = buildContactWhereClause(TEST_IDS.environment);
    expect(result).toEqual({ environmentId: TEST_IDS.environment });
  });
});

describe("getContactsInSegment", () => {
  test("returns contacts when segment and filters are valid", async () => {
    const mockSegment = {
      id: TEST_IDS.segment,
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: TEST_IDS.environment,
      description: "Test segment",
      title: "Test Segment",
      isPrivate: false,
      surveys: [],
      filters: [],
    };

    const mockContacts = [
      {
        id: "contact-1",
        attributes: [
          { attributeKey: { key: "email" }, value: "test@example.com" },
          { attributeKey: { key: "name" }, value: "Test User" },
        ],
      },
      {
        id: "contact-2",
        attributes: [
          { attributeKey: { key: "email" }, value: "another@example.com" },
          { attributeKey: { key: "name" }, value: "Another User" },
        ],
      },
    ] as any;

    const mockWhereClause = {
      environmentId: TEST_IDS.environment,
      attributes: {
        some: {
          attributeKey: { key: "email" },
          value: "test@example.com",
        },
      },
    };

    // Mock the dependencies
    const { getSegment } = await import("@/modules/ee/contacts/segments/lib/segments");
    const { segmentFilterToPrismaQuery } = await import(
      "@/modules/ee/contacts/segments/lib/filter/prisma-query"
    );

    vi.mocked(getSegment).mockResolvedValue(mockSegment);

    vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
      ok: true,
      data: { whereClause: mockWhereClause },
    } as any);

    vi.mocked(prisma.contact.findMany).mockResolvedValue(mockContacts);

    const result = await getContactsInSegment(TEST_IDS.segment);

    expect(result).toEqual([
      {
        contactId: "contact-1",
        attributes: {
          email: "test@example.com",
          name: "Test User",
        },
      },
      {
        contactId: "contact-2",
        attributes: {
          email: "another@example.com",
          name: "Another User",
        },
      },
    ]);

    expect(prisma.contact.findMany).toHaveBeenCalledWith({
      where: mockWhereClause,
      select: {
        id: true,
        attributes: {
          where: {
            attributeKey: {
              key: {
                in: ["userId", "firstName", "lastName", "email"],
              },
            },
          },
          select: {
            attributeKey: {
              select: {
                key: true,
              },
            },
            value: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  });

  test("returns null when segment is not found", async () => {
    const { getSegment } = await import("@/modules/ee/contacts/segments/lib/segments");

    vi.mocked(getSegment).mockRejectedValue(new Error("Segment not found"));

    const result = await getContactsInSegment(TEST_IDS.segment);

    expect(result).toBeNull();
  });

  test("returns null when segment filter to prisma query fails", async () => {
    const mockSegment = {
      id: TEST_IDS.segment,
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: TEST_IDS.environment,
      description: "Test segment",
      title: "Test Segment",
      isPrivate: false,
      surveys: [],
      filters: [],
    };

    const { getSegment } = await import("@/modules/ee/contacts/segments/lib/segments");
    const { segmentFilterToPrismaQuery } = await import(
      "@/modules/ee/contacts/segments/lib/filter/prisma-query"
    );

    vi.mocked(getSegment).mockResolvedValue(mockSegment);

    vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
      ok: false,
      error: { type: "bad_request" },
    } as any);

    const result = await getContactsInSegment(TEST_IDS.segment);

    expect(result).toBeNull();
  });

  test("returns null when prisma query fails", async () => {
    const mockSegment = {
      id: TEST_IDS.segment,
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: TEST_IDS.environment,
      description: "Test segment",
      title: "Test Segment",
      isPrivate: false,
      surveys: [],
      filters: [],
    };

    const { getSegment } = await import("@/modules/ee/contacts/segments/lib/segments");
    const { segmentFilterToPrismaQuery } = await import(
      "@/modules/ee/contacts/segments/lib/filter/prisma-query"
    );

    vi.mocked(getSegment).mockResolvedValue(mockSegment);

    vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
      ok: true,
      data: { whereClause: {} },
    } as any);

    vi.mocked(prisma.contact.findMany).mockRejectedValue(new Error("Database error"));

    const result = await getContactsInSegment(TEST_IDS.segment);

    expect(result).toBeNull();
  });

  test("handles errors gracefully", async () => {
    const { getSegment } = await import("@/modules/ee/contacts/segments/lib/segments");

    vi.mocked(getSegment).mockRejectedValue(new Error("Database error"));

    const result = await getContactsInSegment(TEST_IDS.segment);

    expect(result).toBeNull(); // The function catches errors and returns null
  });
});

describe("generatePersonalLinks", () => {
  test("returns null when getContactsInSegment fails", async () => {
    // Mock getSegment to fail which will cause getContactsInSegment to return null
    const { getSegment } = await import("@/modules/ee/contacts/segments/lib/segments");

    vi.mocked(getSegment).mockRejectedValue(new Error("Segment not found"));

    const result = await generatePersonalLinks(TEST_IDS.survey, TEST_IDS.segment);

    expect(result).toBeNull();
  });

  test("returns empty array when no contacts in segment", async () => {
    // Mock successful segment retrieval but no contacts
    const { getSegment } = await import("@/modules/ee/contacts/segments/lib/segments");
    const { segmentFilterToPrismaQuery } = await import(
      "@/modules/ee/contacts/segments/lib/filter/prisma-query"
    );

    vi.mocked(getSegment).mockResolvedValue({
      id: TEST_IDS.segment,
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: TEST_IDS.environment,
      description: "Test segment",
      title: "Test Segment",
      isPrivate: false,
      surveys: [],
      filters: [],
    });

    vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
      ok: true,
      data: { whereClause: {} },
    } as any);

    vi.mocked(prisma.contact.findMany).mockResolvedValue([]);

    const result = await generatePersonalLinks(TEST_IDS.survey, TEST_IDS.segment);

    expect(result).toEqual([]);
  });

  test("generates personal links for contacts successfully", async () => {
    const expirationDays = 7;
    // Mock all the dependencies that getContactsInSegment needs
    const { getSegment } = await import("@/modules/ee/contacts/segments/lib/segments");
    const { segmentFilterToPrismaQuery } = await import(
      "@/modules/ee/contacts/segments/lib/filter/prisma-query"
    );
    const { getContactSurveyLink } = await import("@/modules/ee/contacts/lib/contact-survey-link");

    vi.mocked(getSegment).mockResolvedValue({
      id: TEST_IDS.segment,
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: TEST_IDS.environment,
      description: "Test segment",
      title: "Test Segment",
      isPrivate: false,
      surveys: [],
      filters: [],
    });

    vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
      ok: true,
      data: { whereClause: {} },
    } as any);

    vi.mocked(prisma.contact.findMany).mockResolvedValue([
      {
        id: "contact-1",
        attributes: [
          { attributeKey: { key: "email" }, value: "test@example.com" },
          { attributeKey: { key: "name" }, value: "Test User" },
        ],
      },
      {
        id: "contact-2",
        attributes: [
          { attributeKey: { key: "email" }, value: "another@example.com" },
          { attributeKey: { key: "name" }, value: "Another User" },
        ],
      },
    ] as any);

    // Mock getContactSurveyLink to return successful results
    vi.mocked(getContactSurveyLink)
      .mockReturnValueOnce({
        ok: true,
        data: "https://example.com/survey/link1",
      })
      .mockReturnValueOnce({
        ok: true,
        data: "https://example.com/survey/link2",
      });

    const result = await generatePersonalLinks(TEST_IDS.survey, TEST_IDS.segment, expirationDays);

    expect(result).toEqual([
      {
        contactId: "contact-1",
        attributes: {
          email: "test@example.com",
          name: "Test User",
        },
        surveyUrl: "https://example.com/survey/link1",
        expirationDays,
      },
      {
        contactId: "contact-2",
        attributes: {
          email: "another@example.com",
          name: "Another User",
        },
        surveyUrl: "https://example.com/survey/link2",
        expirationDays,
      },
    ]);

    expect(getContactSurveyLink).toHaveBeenCalledWith("contact-1", TEST_IDS.survey, expirationDays);
    expect(getContactSurveyLink).toHaveBeenCalledWith("contact-2", TEST_IDS.survey, expirationDays);
  });
});
