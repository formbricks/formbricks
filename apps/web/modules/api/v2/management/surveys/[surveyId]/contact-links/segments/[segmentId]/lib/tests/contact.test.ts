import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { SurveyStatus, SurveyType } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { TBaseFilters } from "@formbricks/types/segment";
import { getContactsInSegment } from "../contact";
import { getSegment } from "../segment";
import { getSurvey } from "../surveys";

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../segment", () => ({
  getSegment: vi.fn(),
}));

vi.mock("../surveys", () => ({
  getSurvey: vi.fn(),
}));

describe("getContactsInSegment", () => {
  const mockSurveyId = "survey-123";
  const mockSegmentId = "segment-456";
  const mockLimit = 10;
  const mockSkip = 0;
  const mockEnvironmentId = "env-789";

  const mockSurvey = {
    id: mockSurveyId,
    environmentId: mockEnvironmentId,
    type: "link" as SurveyType,
    status: "inProgress" as SurveyStatus,
  };

  // Define filters as a TBaseFilters array with correct structure
  const mockFilters: TBaseFilters = [
    {
      id: "filter-1",
      connector: null,
      resource: {
        id: "resource-1",
        root: {
          type: "attribute",
          contactAttributeKey: "email",
        },
        value: "test@example.com",
        qualifier: {
          operator: "equals",
        },
      },
    },
  ];

  const mockSegment = {
    id: mockSegmentId,
    environmentId: mockEnvironmentId,
    filters: mockFilters,
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
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getSurvey).mockResolvedValue({
      ok: true,
      data: mockSurvey,
    });

    vi.mocked(getSegment).mockResolvedValue({
      ok: true,
      data: mockSegment,
    });

    vi.mocked(prisma.contact.count).mockResolvedValue(2);
    vi.mocked(prisma.contact.findMany).mockResolvedValue(mockContacts);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("should return contacts when all operations succeed", async () => {
    vi.mocked(prisma.$transaction).mockResolvedValue([mockContacts.length, mockContacts]);
    const attributeKeys = "email,name";
    const result = await getContactsInSegment(
      mockSurveyId,
      mockSegmentId,
      mockLimit,
      mockSkip,
      attributeKeys
    );

    const whereClause = {
      AND: [
        {
          environmentId: "env-789",
        },
        {
          AND: [
            {
              attributes: {
                some: {
                  attributeKey: {
                    key: "email",
                  },
                  value: { equals: "test@example.com", mode: "insensitive" },
                },
              },
            },
          ],
        },
      ],
    };

    expect(getSurvey).toHaveBeenCalledWith(mockSurveyId);
    expect(getSegment).toHaveBeenCalledWith(mockSegmentId);

    expect(prisma.contact.count).toHaveBeenCalledWith({
      where: whereClause,
    });
    expect(prisma.contact.findMany).toHaveBeenCalledWith({
      where: whereClause,
      select: {
        id: true,
        attributes: {
          select: {
            attributeKey: {
              select: {
                key: true,
              },
            },
            value: true,
          },
          where: {
            attributeKey: {
              key: {
                in: ["email", "name"],
              },
            },
          },
        },
      },
      take: mockLimit,
      skip: mockSkip,
      orderBy: {
        createdAt: "desc",
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        data: [
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
        ],
        meta: {
          total: 2,
          limit: 10,
          offset: 0,
        },
      });
    }
  });

  test("should filter contact attributes when fields parameter is provided", async () => {
    const filteredMockContacts = [
      {
        id: "contact-1",
        attributes: [{ attributeKey: { key: "email" }, value: "test@example.com" }],
      },
      {
        id: "contact-2",
        attributes: [{ attributeKey: { key: "email" }, value: "another@example.com" }],
      },
    ];

    vi.mocked(prisma.$transaction).mockResolvedValue([filteredMockContacts.length, filteredMockContacts]);

    const result = await getContactsInSegment(mockSurveyId, mockSegmentId, mockLimit, mockSkip, "email");

    const whereClause = {
      AND: [
        {
          environmentId: "env-789",
        },
        {
          AND: [
            {
              attributes: {
                some: {
                  attributeKey: {
                    key: "email",
                  },
                  value: { equals: "test@example.com", mode: "insensitive" },
                },
              },
            },
          ],
        },
      ],
    };

    expect(getSurvey).toHaveBeenCalledWith(mockSurveyId);
    expect(getSegment).toHaveBeenCalledWith(mockSegmentId);

    expect(prisma.contact.count).toHaveBeenCalledWith({
      where: whereClause,
    });
    expect(prisma.contact.findMany).toHaveBeenCalledWith({
      where: whereClause,
      select: {
        id: true,
        attributes: {
          where: {
            attributeKey: {
              key: {
                in: ["email"],
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
      take: mockLimit,
      skip: mockSkip,
      orderBy: {
        createdAt: "desc",
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        data: [
          {
            contactId: "contact-1",
            attributes: {
              email: "test@example.com",
            },
          },
          {
            contactId: "contact-2",
            attributes: {
              email: "another@example.com",
            },
          },
        ],
        meta: {
          total: 2,
          limit: 10,
          offset: 0,
        },
      });
    }
  });

  test("should handle multiple fields when fields parameter has comma-separated values", async () => {
    vi.mocked(prisma.$transaction).mockResolvedValue([mockContacts.length, mockContacts]);

    const result = await getContactsInSegment(mockSurveyId, mockSegmentId, mockLimit, mockSkip, "email,name");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        data: [
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
        ],
        meta: {
          total: 2,
          limit: 10,
          offset: 0,
        },
      });
    }
  });

  test("should return no attributes but still return contacts when fields parameter is empty", async () => {
    const mockContactsWithoutAttributes = mockContacts.map((contact) => ({
      ...contact,
      attributes: [],
    }));

    vi.mocked(prisma.$transaction).mockResolvedValue([
      mockContactsWithoutAttributes.length,
      mockContactsWithoutAttributes,
    ]);

    const result = await getContactsInSegment(mockSurveyId, mockSegmentId, mockLimit, mockSkip, "");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        data: mockContacts.map((contact) => ({
          contactId: contact.id,
        })),
        meta: {
          total: 2,
          limit: 10,
          offset: 0,
        },
      });
    }
  });

  test("should return error when survey is not a link survey", async () => {
    const surveyError: ApiErrorResponseV2 = {
      type: "forbidden",
      details: [{ field: "surveyId", issue: "Invalid survey" }],
    };

    vi.mocked(getSurvey).mockResolvedValue({
      ok: true,
      data: {
        ...mockSurvey,
        type: "web" as SurveyType,
      },
    });

    const result = await getContactsInSegment(mockSurveyId, mockSegmentId, mockLimit, mockSkip);

    expect(getSurvey).toHaveBeenCalledWith(mockSurveyId);
    expect(getSegment).not.toHaveBeenCalled();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual(surveyError);
    }
  });

  test("should return error when survey is not active", async () => {
    const surveyError: ApiErrorResponseV2 = {
      type: "forbidden",
      details: [{ field: "surveyId", issue: "Invalid survey" }],
    };

    vi.mocked(getSurvey).mockResolvedValue({
      ok: true,
      data: {
        ...mockSurvey,
        status: "completed" as SurveyStatus,
      },
    });

    const result = await getContactsInSegment(mockSurveyId, mockSegmentId, mockLimit, mockSkip);

    expect(getSurvey).toHaveBeenCalledWith(mockSurveyId);
    expect(getSegment).not.toHaveBeenCalled();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual(surveyError);
    }
  });

  test("should return error when survey is not found", async () => {
    const surveyError: ApiErrorResponseV2 = {
      type: "not_found",
      details: [{ field: "survey", issue: "not found" }],
    };

    vi.mocked(getSurvey).mockResolvedValue({
      ok: false,
      error: surveyError,
    });

    const result = await getContactsInSegment(mockSurveyId, mockSegmentId, mockLimit, mockSkip);

    expect(getSurvey).toHaveBeenCalledWith(mockSurveyId);
    expect(getSegment).not.toHaveBeenCalled();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual(surveyError);
    }
  });

  test("should return error when segment is not found", async () => {
    const segmentError: ApiErrorResponseV2 = {
      type: "not_found",
      details: [{ field: "segment", issue: "not found" }],
    };

    vi.mocked(getSegment).mockResolvedValue({
      ok: false,
      error: segmentError,
    });

    const result = await getContactsInSegment(mockSurveyId, mockSegmentId, mockLimit, mockSkip);

    expect(getSurvey).toHaveBeenCalledWith(mockSurveyId);
    expect(getSegment).toHaveBeenCalledWith(mockSegmentId);
    expect(prisma.contact.count).not.toHaveBeenCalled();
    expect(prisma.contact.findMany).not.toHaveBeenCalled();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual(segmentError);
    }
  });

  test("should return error when survey and segment are in different environments", async () => {
    const mockSegmentWithDifferentEnv = {
      ...mockSegment,
      environmentId: "different-env",
    };

    vi.mocked(getSegment).mockResolvedValue({
      ok: true,
      data: mockSegmentWithDifferentEnv,
    });

    const result = await getContactsInSegment(mockSurveyId, mockSegmentId, mockLimit, mockSkip);

    expect(getSurvey).toHaveBeenCalledWith(mockSurveyId);
    expect(getSegment).toHaveBeenCalledWith(mockSegmentId);
    expect(prisma.contact.count).not.toHaveBeenCalled();
    expect(prisma.contact.findMany).not.toHaveBeenCalled();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        type: "bad_request",
        details: [{ field: "segmentId", issue: "Environment mismatch" }],
      });
    }
  });

  test("should return error when database operation fails", async () => {
    const dbError = new Error("Database connection failed");
    vi.mocked(prisma.contact.count).mockRejectedValue(dbError);
    const result = await getContactsInSegment(mockSurveyId, mockSegmentId, mockLimit, mockSkip);

    expect(getSurvey).toHaveBeenCalledWith(mockSurveyId);
    expect(getSegment).toHaveBeenCalledWith(mockSegmentId);
    expect(prisma.contact.count).toHaveBeenCalled();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        type: "internal_server_error",
      });
    }
  });
});
