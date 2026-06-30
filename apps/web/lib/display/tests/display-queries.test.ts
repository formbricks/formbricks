import { mockDisplayId, mockSurveyId } from "./__mocks__/data.mock";
import { prisma } from "@/lib/__mocks__/database";
import { describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError, InvalidInputError, ValidationError } from "@formbricks/types/errors";
import {
  assertDisplayOwnership,
  getDisplayCountBySurveyId,
  getDisplayForResponseValidation,
  getDisplaysByContactId,
  getDisplaysBySurveyIdWithContact,
} from "../service";

const mockContactId = "clqnj99r9000008lebgf8734j";
const mockWorkspaceId = "clqkr8dlv000308jybb08evgz";
const mockResponseId = "clqnfg59i000208i426pb4wcv";
const mockResponseIds = ["clqnfg59i000208i426pb4wcv", "clqnfg59i000208i426pb4wcw"];

const mockDisplaysForContact = [
  {
    id: mockDisplayId,
    createdAt: new Date("2024-01-15T10:00:00Z"),
    surveyId: mockSurveyId,
  },
  {
    id: "clqkr5smu000208jy50v6g5k5",
    createdAt: new Date("2024-01-14T10:00:00Z"),
    surveyId: "clqkr8dlv000308jybb08evgs",
  },
];

const mockDisplaysWithContact = [
  {
    id: mockDisplayId,
    createdAt: new Date("2024-01-15T10:00:00Z"),
    surveyId: mockSurveyId,
    contact: {
      id: mockContactId,
      attributes: [
        { attributeKey: { key: "email" }, value: "test@example.com" },
        { attributeKey: { key: "userId" }, value: "user-123" },
      ],
    },
  },
  {
    id: "clqkr5smu000208jy50v6g5k5",
    createdAt: new Date("2024-01-14T10:00:00Z"),
    surveyId: "clqkr8dlv000308jybb08evgs",
    contact: {
      id: "clqnj99r9000008lebgf8734k",
      attributes: [{ attributeKey: { key: "userId" }, value: "user-456" }],
    },
  },
];

describe("getDisplayCountBySurveyId", () => {
  describe("Happy Path", () => {
    test("counts displays by surveyId", async () => {
      vi.mocked(prisma.display.count).mockResolvedValue(5);

      const result = await getDisplayCountBySurveyId(mockSurveyId);

      expect(result).toBe(5);
      expect(prisma.display.count).toHaveBeenCalledWith({
        where: {
          surveyId: mockSurveyId,
        },
      });
    });

    test("combines createdAt and responseIds filters", async () => {
      const createdAt = {
        min: new Date("2024-01-01T00:00:00.000Z"),
        max: new Date("2024-01-31T23:59:59.999Z"),
      };
      vi.mocked(prisma.display.count).mockResolvedValue(2);

      const result = await getDisplayCountBySurveyId(mockSurveyId, {
        createdAt,
        responseIds: mockResponseIds,
      });

      expect(result).toBe(2);
      expect(prisma.display.count).toHaveBeenCalledWith({
        where: {
          surveyId: mockSurveyId,
          createdAt: {
            gte: createdAt.min,
            lte: createdAt.max,
          },
          response: {
            is: {
              id: {
                in: mockResponseIds,
              },
            },
          },
        },
      });
    });

    test("returns 0 without querying when responseIds filter is empty", async () => {
      const result = await getDisplayCountBySurveyId(mockSurveyId, { responseIds: [] });

      expect(result).toBe(0);
      expect(prisma.display.count).not.toHaveBeenCalled();
    });
  });

  describe("Sad Path", () => {
    test("throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error", {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });

      vi.mocked(prisma.display.count).mockRejectedValue(errToThrow);

      await expect(getDisplayCountBySurveyId(mockSurveyId)).rejects.toThrow(DatabaseError);
    });
  });
});

describe("getDisplaysByContactId", () => {
  describe("Happy Path", () => {
    test("returns displays for a contact ordered by createdAt desc", async () => {
      vi.mocked(prisma.display.findMany).mockResolvedValue(mockDisplaysForContact as any);

      const result = await getDisplaysByContactId(mockContactId);

      expect(result).toEqual(mockDisplaysForContact);
      expect(prisma.display.findMany).toHaveBeenCalledWith({
        where: { contactId: mockContactId },
        select: {
          id: true,
          createdAt: true,
          surveyId: true,
        },
        orderBy: { createdAt: "desc" },
      });
    });

    test("returns empty array when contact has no displays", async () => {
      vi.mocked(prisma.display.findMany).mockResolvedValue([]);

      const result = await getDisplaysByContactId(mockContactId);

      expect(result).toEqual([]);
    });
  });

  describe("Sad Path", () => {
    test("throws a ValidationError if the contactId is invalid", async () => {
      await expect(getDisplaysByContactId("not-a-cuid")).rejects.toThrow(ValidationError);
    });

    test("throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error", {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });

      vi.mocked(prisma.display.findMany).mockRejectedValue(errToThrow);

      await expect(getDisplaysByContactId(mockContactId)).rejects.toThrow(DatabaseError);
    });

    test("throws generic Error for other exceptions", async () => {
      vi.mocked(prisma.display.findMany).mockRejectedValue(new Error("Mock error"));

      await expect(getDisplaysByContactId(mockContactId)).rejects.toThrow(Error);
    });
  });
});

describe("getDisplaysBySurveyIdWithContact", () => {
  describe("Happy Path", () => {
    test("returns displays with contact attributes transformed", async () => {
      vi.mocked(prisma.display.findMany).mockResolvedValue(mockDisplaysWithContact as any);

      const result = await getDisplaysBySurveyIdWithContact(mockSurveyId, 15, 0);

      expect(result).toEqual([
        {
          id: mockDisplayId,
          createdAt: new Date("2024-01-15T10:00:00Z"),
          surveyId: mockSurveyId,
          contact: {
            id: mockContactId,
            attributes: { email: "test@example.com", userId: "user-123" },
          },
        },
        {
          id: "clqkr5smu000208jy50v6g5k5",
          createdAt: new Date("2024-01-14T10:00:00Z"),
          surveyId: "clqkr8dlv000308jybb08evgs",
          contact: {
            id: "clqnj99r9000008lebgf8734k",
            attributes: { userId: "user-456" },
          },
        },
      ]);
    });

    test("calls prisma with correct where clause and pagination", async () => {
      vi.mocked(prisma.display.findMany).mockResolvedValue([]);

      await getDisplaysBySurveyIdWithContact(mockSurveyId, 15, 0);

      expect(prisma.display.findMany).toHaveBeenCalledWith({
        where: {
          surveyId: mockSurveyId,
          contactId: { not: null },
        },
        select: {
          id: true,
          createdAt: true,
          surveyId: true,
          contact: {
            select: {
              id: true,
              attributes: {
                where: {
                  attributeKey: {
                    key: { in: ["email", "userId"] },
                  },
                },
                select: {
                  attributeKey: { select: { key: true } },
                  value: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 15,
        skip: 0,
      });
    });

    test("returns empty array when no displays found", async () => {
      vi.mocked(prisma.display.findMany).mockResolvedValue([]);

      const result = await getDisplaysBySurveyIdWithContact(mockSurveyId);

      expect(result).toEqual([]);
    });

    test("handles display with null contact", async () => {
      vi.mocked(prisma.display.findMany).mockResolvedValue([
        {
          id: mockDisplayId,
          createdAt: new Date("2024-01-15T10:00:00Z"),
          surveyId: mockSurveyId,
          contact: null,
        },
      ] as any);

      const result = await getDisplaysBySurveyIdWithContact(mockSurveyId);

      expect(result).toEqual([
        {
          id: mockDisplayId,
          createdAt: new Date("2024-01-15T10:00:00Z"),
          surveyId: mockSurveyId,
          contact: null,
        },
      ]);
    });
  });

  describe("Sad Path", () => {
    test("throws a ValidationError if the surveyId is invalid", async () => {
      await expect(getDisplaysBySurveyIdWithContact("not-a-cuid")).rejects.toThrow(ValidationError);
    });

    test("throws DatabaseError on PrismaClientKnownRequestError", async () => {
      const errToThrow = new Prisma.PrismaClientKnownRequestError("Mock error", {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });

      vi.mocked(prisma.display.findMany).mockRejectedValue(errToThrow);

      await expect(getDisplaysBySurveyIdWithContact(mockSurveyId)).rejects.toThrow(DatabaseError);
    });

    test("throws generic Error for other exceptions", async () => {
      vi.mocked(prisma.display.findMany).mockRejectedValue(new Error("Mock error"));

      await expect(getDisplaysBySurveyIdWithContact(mockSurveyId)).rejects.toThrow(Error);
    });
  });
});

const mockDisplayRecord = {
  surveyId: mockSurveyId,
  contactId: null as string | null,
  response: null as { id: string } | null,
  survey: { workspaceId: mockWorkspaceId },
};

describe("getDisplayForResponseValidation", () => {
  test("returns null when display is not found", async () => {
    vi.mocked(prisma.display.findUnique).mockResolvedValue(null);
    const result = await getDisplayForResponseValidation(mockDisplayId);
    expect(result).toBeNull();
  });

  test("returns mapped shape when display is found", async () => {
    vi.mocked(prisma.display.findUnique).mockResolvedValue({
      ...mockDisplayRecord,
      contactId: mockContactId,
      response: { id: mockResponseId },
    } as any);
    const result = await getDisplayForResponseValidation(mockDisplayId);
    expect(result).toEqual({
      surveyId: mockSurveyId,
      workspaceId: mockWorkspaceId,
      responseId: mockResponseId,
      contactId: mockContactId,
    });
  });

  test("throws DatabaseError on PrismaClientKnownRequestError", async () => {
    vi.mocked(prisma.display.findUnique).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Mock error", {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      })
    );
    await expect(getDisplayForResponseValidation(mockDisplayId)).rejects.toThrow(DatabaseError);
  });
});

describe("assertDisplayOwnership", () => {
  test("throws InvalidInputError when display is not found", async () => {
    vi.mocked(prisma.display.findUnique).mockResolvedValue(null);
    await expect(assertDisplayOwnership(mockDisplayId, mockWorkspaceId, mockSurveyId, null)).rejects.toThrow(
      InvalidInputError
    );
  });

  test("throws InvalidInputError when workspaceId does not match", async () => {
    vi.mocked(prisma.display.findUnique).mockResolvedValue(mockDisplayRecord as any);
    await expect(
      assertDisplayOwnership(mockDisplayId, "wrong-workspace", mockSurveyId, null)
    ).rejects.toThrow(InvalidInputError);
  });

  test("throws InvalidInputError when surveyId does not match", async () => {
    vi.mocked(prisma.display.findUnique).mockResolvedValue(mockDisplayRecord as any);
    await expect(
      assertDisplayOwnership(mockDisplayId, mockWorkspaceId, "wrong-survey", null)
    ).rejects.toThrow(InvalidInputError);
  });

  test("throws InvalidInputError when display is already linked to a response", async () => {
    vi.mocked(prisma.display.findUnique).mockResolvedValue({
      ...mockDisplayRecord,
      response: { id: mockResponseId },
    } as any);
    await expect(assertDisplayOwnership(mockDisplayId, mockWorkspaceId, mockSurveyId, null)).rejects.toThrow(
      InvalidInputError
    );
  });

  test("throws InvalidInputError when contactId does not match", async () => {
    vi.mocked(prisma.display.findUnique).mockResolvedValue({
      ...mockDisplayRecord,
      contactId: "contact-a",
    } as any);
    await expect(
      assertDisplayOwnership(mockDisplayId, mockWorkspaceId, mockSurveyId, "contact-b")
    ).rejects.toThrow(InvalidInputError);
  });

  test("resolves without error when all ownership checks pass", async () => {
    vi.mocked(prisma.display.findUnique).mockResolvedValue({
      ...mockDisplayRecord,
      contactId: mockContactId,
    } as any);
    await expect(
      assertDisplayOwnership(mockDisplayId, mockWorkspaceId, mockSurveyId, mockContactId)
    ).resolves.toBeUndefined();
  });
});
