import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  DatabaseError,
  InvalidInputError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import { TSurveyQuota, TSurveyQuotaInput } from "@formbricks/types/quota";
import { validateInputs } from "@/lib/utils/validate";
import { createQuota, deleteQuota, getQuota, getQuotas, reduceQuotaLimits, updateQuota } from "./quotas";

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    surveyQuota: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
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
    logic: {
      connector: "and",
      conditions: [],
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

  describe("getQuota", () => {
    test("should return quota successfully", async () => {
      vi.mocked(prisma.surveyQuota.findUnique).mockResolvedValue(mockQuota);
      const result = await getQuota(mockQuotaId);
      expect(result).toEqual(mockQuota);
    });

    test("should throw ResourceNotFoundError if quota not found", async () => {
      vi.mocked(prisma.surveyQuota.findUnique).mockResolvedValue(null);
      await expect(getQuota(mockQuotaId)).rejects.toThrow(ResourceNotFoundError);
    });

    test("should throw DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.surveyQuota.findUnique).mockRejectedValue(prismaError);
      await expect(getQuota(mockQuotaId)).rejects.toThrow(DatabaseError);
    });

    test("should throw ValidationError when validateInputs fails", async () => {
      vi.mocked(validateInputs).mockImplementation(() => {
        throw new ValidationError("Invalid input");
      });
      await expect(getQuota(mockQuotaId)).rejects.toThrow(ValidationError);
    });
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
    const createInput: TSurveyQuotaInput = {
      surveyId: mockSurveyId,
      name: "New Quota",
      limit: 50,
      logic: {
        connector: "and",
        conditions: [],
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
    const updateInput: TSurveyQuotaInput = {
      name: "Updated Quota",
      surveyId: mockSurveyId,
      limit: 75,
      logic: {
        connector: "or",
        conditions: [],
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
        code: "P2015",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.surveyQuota.update).mockRejectedValue(prismaError);

      await expect(updateQuota(updateInput, mockQuotaId)).rejects.toThrow(ResourceNotFoundError);
    });

    test("should throw DatabaseError on other Prisma errors", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.surveyQuota.update).mockRejectedValue(prismaError);

      await expect(updateQuota(updateInput, mockQuotaId)).rejects.toThrow(InvalidInputError);
    });

    test("should throw error on unknown error", async () => {
      vi.mocked(prisma.surveyQuota.update).mockRejectedValue(new Error("Unknown error"));
      await expect(updateQuota(updateInput, mockQuotaId)).rejects.toThrow(Error);
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
        code: "P2015",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.surveyQuota.delete).mockRejectedValue(prismaError);

      await expect(deleteQuota(mockQuotaId)).rejects.toThrow(ResourceNotFoundError);
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

  describe("reduceQuotaLimits", () => {
    test("should reduce quota limits successfully", async () => {
      vi.mocked(prisma.surveyQuota.updateMany).mockResolvedValue({ count: 1 });
      await reduceQuotaLimits([mockQuotaId]);
      expect(prisma.surveyQuota.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [mockQuotaId] }, limit: { gt: 1 } },
        data: { limit: { decrement: 1 } },
      });
    });

    test("should throw DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.surveyQuota.updateMany).mockRejectedValue(prismaError);
      await expect(reduceQuotaLimits([mockQuotaId])).rejects.toThrow(DatabaseError);
    });

    test("should throw error on unknown error", async () => {
      vi.mocked(prisma.surveyQuota.updateMany).mockRejectedValue(new Error("Unknown error"));
      await expect(reduceQuotaLimits([mockQuotaId])).rejects.toThrow(Error);
    });
  });
});
