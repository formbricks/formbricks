import { Prisma } from "@prisma/client";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
// mocked via vi.mock()
import {
  DatabaseError,
  InvalidInputError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import { TSurveyQuota, TSurveyQuotaInput } from "@formbricks/types/quota";
import { TEST_IDS } from "@/lib/testing/constants";
import { COMMON_ERRORS } from "@/lib/testing/mocks";
import { setupTestEnvironment } from "@/lib/testing/setup";
import { validateInputs } from "@/lib/utils/validate";
import { createQuota, deleteQuota, getQuota, getQuotas, reduceQuotaLimits, updateQuota } from "./quotas";

setupTestEnvironment();

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
  const mockQuota: TSurveyQuota = {
    id: TEST_IDS.quota,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    surveyId: TEST_IDS.survey,
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

  // Setup validateInputs mock in beforeEach (via setupTestEnvironment)
  vi.mocked(validateInputs).mockImplementation(() => {
    return [];
  });

  describe("getQuota", () => {
    test("should return quota successfully", async () => {
      vi.mocked(prisma.surveyQuota.findUnique).mockResolvedValue(mockQuota);
      const result = await getQuota(TEST_IDS.quota);
      expect(result).toEqual(mockQuota);
    });

    test("should throw ResourceNotFoundError if quota not found", async () => {
      vi.mocked(prisma.surveyQuota.findUnique).mockResolvedValue(null);
      await expect(getQuota(TEST_IDS.quota)).rejects.toThrow(ResourceNotFoundError);
    });

    test("should throw DatabaseError on Prisma error", async () => {
      vi.mocked(prisma.surveyQuota.findUnique).mockRejectedValue(COMMON_ERRORS.UNIQUE_CONSTRAINT);
      await expect(getQuota(TEST_IDS.quota)).rejects.toThrow(DatabaseError);
    });

    test("should throw ValidationError when validateInputs fails", async () => {
      vi.mocked(validateInputs).mockImplementation(() => {
        throw new ValidationError("Invalid input");
      });
      await expect(getQuota(TEST_IDS.quota)).rejects.toThrow(ValidationError);
    });
  });

  describe("getQuotas", () => {
    test("should return quotas successfully", async () => {
      const mockQuotas = [mockQuota];
      vi.mocked(prisma.surveyQuota.findMany).mockResolvedValue(mockQuotas);

      const result = await getQuotas(TEST_IDS.survey);

      expect(result).toEqual(mockQuotas);
      expect(validateInputs).toHaveBeenCalledWith([TEST_IDS.survey, expect.any(Object)]);
      expect(prisma.surveyQuota.findMany).toHaveBeenCalledWith({
        where: { surveyId: TEST_IDS.survey },
        orderBy: { createdAt: "desc" },
      });
    });

    test("should throw DatabaseError on Prisma error", async () => {
      vi.mocked(prisma.surveyQuota.findMany).mockRejectedValue(COMMON_ERRORS.UNIQUE_CONSTRAINT);

      await expect(getQuotas(TEST_IDS.survey)).rejects.toThrow(DatabaseError);
    });

    test("should throw ValidationError when validateInputs fails", async () => {
      vi.mocked(validateInputs).mockImplementation(() => {
        throw new ValidationError("Invalid input");
      });

      await expect(getQuotas(TEST_IDS.survey)).rejects.toThrow(ValidationError);
    });

    test("should re-throw non-Prisma errors", async () => {
      const genericError = new Error("Generic error");
      vi.mocked(prisma.surveyQuota.findMany).mockRejectedValue(genericError);

      await expect(getQuotas(TEST_IDS.survey)).rejects.toThrow("Generic error");
    });
  });

  describe("createQuota", () => {
    const createInput: TSurveyQuotaInput = {
      surveyId: TEST_IDS.survey,
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
      vi.mocked(prisma.surveyQuota.create).mockRejectedValue(COMMON_ERRORS.UNIQUE_CONSTRAINT);

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
      surveyId: TEST_IDS.survey,
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

      const result = await updateQuota(updateInput, TEST_IDS.quota);

      expect(result).toEqual(updatedQuota);
      expect(prisma.surveyQuota.update).toHaveBeenCalledWith({
        where: { id: TEST_IDS.quota },
        data: updateInput,
      });
    });

    test("should throw DatabaseError when quota not found", async () => {
      // P2015 is the "required relation violation" code that maps to ResourceNotFoundError
      const notFoundError = new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2015",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.surveyQuota.update).mockRejectedValue(notFoundError);

      await expect(updateQuota(updateInput, TEST_IDS.quota)).rejects.toThrow(ResourceNotFoundError);
    });

    test("should throw DatabaseError on other Prisma errors", async () => {
      vi.mocked(prisma.surveyQuota.update).mockRejectedValue(COMMON_ERRORS.UNIQUE_CONSTRAINT);

      await expect(updateQuota(updateInput, TEST_IDS.quota)).rejects.toThrow(InvalidInputError);
    });

    test("should throw error on unknown error", async () => {
      vi.mocked(prisma.surveyQuota.update).mockRejectedValue(new Error("Unknown error"));
      await expect(updateQuota(updateInput, TEST_IDS.quota)).rejects.toThrow(Error);
    });
  });

  describe("deleteQuota", () => {
    test("should delete quota successfully", async () => {
      vi.mocked(prisma.surveyQuota.delete).mockResolvedValue(mockQuota);

      const result = await deleteQuota(TEST_IDS.quota);

      expect(result).toEqual(mockQuota);
      expect(prisma.surveyQuota.delete).toHaveBeenCalledWith({
        where: { id: TEST_IDS.quota },
      });
    });

    test("should throw DatabaseError when quota not found", async () => {
      // P2015 is the "required relation violation" code that maps to ResourceNotFoundError
      const notFoundError = new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2015",
        clientVersion: "1.0.0",
      });
      vi.mocked(prisma.surveyQuota.delete).mockRejectedValue(notFoundError);

      await expect(deleteQuota(TEST_IDS.quota)).rejects.toThrow(ResourceNotFoundError);
    });

    test("should throw DatabaseError on other Prisma errors", async () => {
      vi.mocked(prisma.surveyQuota.delete).mockRejectedValue(COMMON_ERRORS.UNIQUE_CONSTRAINT);

      await expect(deleteQuota(TEST_IDS.quota)).rejects.toThrow(DatabaseError);
    });

    test("should re-throw non-Prisma errors", async () => {
      const genericError = new Error("Generic error");
      vi.mocked(prisma.surveyQuota.delete).mockRejectedValue(genericError);

      await expect(deleteQuota(TEST_IDS.quota)).rejects.toThrow("Generic error");
    });
  });

  describe("reduceQuotaLimits", () => {
    test("should reduce quota limits successfully", async () => {
      vi.mocked(prisma.surveyQuota.updateMany).mockResolvedValue({ count: 1 });
      await reduceQuotaLimits([TEST_IDS.quota]);
      expect(prisma.surveyQuota.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [TEST_IDS.quota] }, limit: { gt: 1 } },
        data: { limit: { decrement: 1 } },
      });
    });

    test("should throw DatabaseError on Prisma error", async () => {
      vi.mocked(prisma.surveyQuota.updateMany).mockRejectedValue(COMMON_ERRORS.UNIQUE_CONSTRAINT);
      await expect(reduceQuotaLimits([TEST_IDS.quota])).rejects.toThrow(DatabaseError);
    });

    test("should throw error on unknown error", async () => {
      vi.mocked(prisma.surveyQuota.updateMany).mockRejectedValue(new Error("Unknown error"));
      await expect(reduceQuotaLimits([TEST_IDS.quota])).rejects.toThrow(Error);
    });
  });
});
