import { mockDisplayId, mockSurveyId } from "./__mocks__/data.mock";
import { prisma } from "@/lib/__mocks__/database";
import { Prisma } from "@prisma/client";
import { describe, expect, test, vi } from "vitest";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
import {
  getDisplayCountBySurveyId,
  getDisplaysByContactId,
  getDisplaysBySurveyIdWithContact,
} from "../service";

const mockContactId = "clqnj99r9000008lebgf8734j";
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
