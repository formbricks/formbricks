import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, InvalidInputError, ValidationError } from "@formbricks/types/errors";
import { TSurveyQuota, TSurveyQuotaCreateInput, TSurveyQuotaUpdateInput } from "@formbricks/types/quota";
import { createQuota, deleteQuota, getQuotas, updateQuota } from "./quotas";

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    surveyQuota: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

describe("Quota Service", () => {
  const mockSurveyId = "survey123";
  const mockQuotaId = "quota123";

  const mockQuota: TSurveyQuota = {
    id: mockQuotaId,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    surveyId: mockSurveyId,
    name: "Test Quota",
    limit: 100,
    conditions: {
      connector: "and",
      criteria: [],
    },
    action: "endSurvey",
    endingCardId: null,
    countPartialSubmissions: false,
  };

  beforeEach(() => {
    vi.mocked(validateInputs).mockImplementation(() => {
      return [];
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getQuotas", () => {
    test("should return quotas successfully", async () => {
      const mockQuotas = [mockQuota];
      vi.mocked(prisma.surveyQuota.findMany).mockResolvedValue(mockQuotas);

      const result = await getQuotas(mockSurveyId);

      expect(result).toEqual(mockQuotas);
      expect(validateInputs).toHaveBeenCalledWith([mockSurveyId, expect.any(Object)]);
      expect(prisma.surveyQuota.findMany).toHaveBeenCalledWith({
        where: { surveyId: mockSurveyId },
        orderBy: { createdAt: "desc" },
      });
    });

    test("should throw DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.surveyQuota.findMany).mockRejectedValue(prismaError);

      await expect(getQuotas(mockSurveyId)).rejects.toThrow(DatabaseError);
    });

    test("should throw ValidationError when validateInputs fails", async () => {
      vi.mocked(validateInputs).mockImplementation(() => {
        throw new ValidationError("Invalid input");
      });

      await expect(getQuotas(mockSurveyId)).rejects.toThrow(ValidationError);
    });

    test("should re-throw non-Prisma errors", async () => {
      const genericError = new Error("Generic error");
      vi.mocked(prisma.surveyQuota.findMany).mockRejectedValue(genericError);

      await expect(getQuotas(mockSurveyId)).rejects.toThrow("Generic error");
    });
  });

  describe("createQuota", () => {
    const createInput: TSurveyQuotaCreateInput = {
      surveyId: mockSurveyId,
      name: "New Quota",
      limit: 50,
      conditions: {
        connector: "and",
        criteria: [],
      },
      action: "endSurvey",
      endingCardId: null,
      countPartialSubmissions: false,
    };

    test("should create quota successfully", async () => {
      vi.mocked(prisma.surveyQuota.create).mockResolvedValue(mockQuota);

      const result = await createQuota(createInput);

      expect(result).toEqual(mockQuota);
      expect(prisma.surveyQuota.create).toHaveBeenCalledWith({
        data: createInput,
      });
    });

    test("should throw DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.surveyQuota.create).mockRejectedValue(prismaError);

      await expect(createQuota(createInput)).rejects.toThrow(InvalidInputError);
    });

    test("should re-throw non-Prisma errors", async () => {
      const genericError = new Error("Generic error");
      vi.mocked(prisma.surveyQuota.create).mockRejectedValue(genericError);

      await expect(createQuota(createInput)).rejects.toThrow("Generic error");
    });
  });

  describe("updateQuota", () => {
    const updateInput: TSurveyQuotaUpdateInput = {
      name: "Updated Quota",
      limit: 75,
      conditions: {
        connector: "or",
        criteria: [],
      },
      action: "continueSurvey",
      endingCardId: "ending123",
      countPartialSubmissions: true,
    };

    test("should update quota successfully", async () => {
      const updatedQuota = { ...mockQuota, ...updateInput };
      vi.mocked(prisma.surveyQuota.update).mockResolvedValue(updatedQuota);

      const result = await updateQuota(updateInput, mockQuotaId);

      expect(result).toEqual(updatedQuota);
      expect(prisma.surveyQuota.update).toHaveBeenCalledWith({
        where: { id: mockQuotaId },
        data: updateInput,
      });
    });

    test("should throw DatabaseError when quota not found", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.surveyQuota.update).mockRejectedValue(prismaError);

      await expect(updateQuota(updateInput, mockQuotaId)).rejects.toThrow(
        Prisma.PrismaClientKnownRequestError
      );
    });

    test("should throw DatabaseError on other Prisma errors", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.surveyQuota.update).mockRejectedValue(prismaError);

      await expect(updateQuota(updateInput, mockQuotaId)).rejects.toThrow(InvalidInputError);
    });
  });

  describe("deleteQuota", () => {
    test("should delete quota successfully", async () => {
      vi.mocked(prisma.surveyQuota.delete).mockResolvedValue(mockQuota);

      const result = await deleteQuota(mockQuotaId);

      expect(result).toEqual(mockQuota);
      expect(prisma.surveyQuota.delete).toHaveBeenCalledWith({
        where: { id: mockQuotaId },
      });
    });

    test("should throw DatabaseError when quota not found", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.surveyQuota.delete).mockRejectedValue(prismaError);

      await expect(deleteQuota(mockQuotaId)).rejects.toThrow(DatabaseError);
    });

    test("should throw DatabaseError on other Prisma errors", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.surveyQuota.delete).mockRejectedValue(prismaError);

      await expect(deleteQuota(mockQuotaId)).rejects.toThrow(DatabaseError);
    });

    test("should re-throw non-Prisma errors", async () => {
      const genericError = new Error("Generic error");
      vi.mocked(prisma.surveyQuota.delete).mockRejectedValue(genericError);

      await expect(deleteQuota(mockQuotaId)).rejects.toThrow("Generic error");
    });
  });
});
