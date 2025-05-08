import * as cacheModule from "@/lib/cache";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { getExistingContactResponse, getResponseBySingleUseId, isSurveyResponsePresent } from "./response";

// Mock dependencies
vi.mock("@/lib/cache", () => ({
  cache: vi.fn(),
}));

vi.mock("@/lib/response/cache", () => ({
  responseCache: {
    tag: {
      bySurveyId: vi.fn((surveyId) => `survey-${surveyId}`),
      bySingleUseId: vi.fn((surveyId, singleUseId) => `survey-${surveyId}-singleuse-${singleUseId}`),
      byContactId: vi.fn((contactId) => `contact-${contactId}`),
    },
  },
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("react", () => ({
  cache: (fn) => fn, // Simplify React cache for testing
}));

describe("response lib", () => {
  const mockCache = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(cacheModule.cache).mockImplementation((fn, key, options) => {
      mockCache(key, options);
      return () => fn();
    });
  });

  describe("isSurveyResponsePresent", () => {
    test("should return true when a response is found", async () => {
      vi.mocked(prisma.response.findFirst).mockResolvedValueOnce({ id: "response-1" });

      const result = await isSurveyResponsePresent("survey-1", "test@example.com");

      expect(prisma.response.findFirst).toHaveBeenCalledWith({
        where: {
          surveyId: "survey-1",
          data: {
            path: ["verifiedEmail"],
            equals: "test@example.com",
          },
        },
        select: { id: true },
      });
      expect(mockCache).toHaveBeenCalledWith(
        ["link-surveys-isSurveyResponsePresent-survey-1-test@example.com"],
        { tags: ["survey-survey-1"] }
      );
      expect(result).toBe(true);
    });

    test("should return false when no response is found", async () => {
      vi.mocked(prisma.response.findFirst).mockResolvedValueOnce(null);

      const result = await isSurveyResponsePresent("survey-1", "test@example.com");

      expect(result).toBe(false);
    });

    test("should throw DatabaseError when Prisma throws a known error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "4.0.0",
      });
      vi.mocked(prisma.response.findFirst).mockRejectedValueOnce(prismaError);

      await expect(isSurveyResponsePresent("survey-1", "test@example.com")).rejects.toThrow(DatabaseError);
    });

    test("should rethrow unknown errors", async () => {
      const error = new Error("Unknown error");
      vi.mocked(prisma.response.findFirst).mockRejectedValueOnce(error);

      await expect(isSurveyResponsePresent("survey-1", "test@example.com")).rejects.toThrow(error);
    });
  });

  describe("getResponseBySingleUseId", () => {
    test("should return response when found", async () => {
      const mockResponse = { id: "response-1", finished: true };
      vi.mocked(prisma.response.findFirst).mockResolvedValueOnce(mockResponse);

      const result = await getResponseBySingleUseId("survey-1", "single-use-1");

      expect(prisma.response.findFirst).toHaveBeenCalledWith({
        where: {
          surveyId: "survey-1",
          singleUseId: "single-use-1",
        },
        select: {
          id: true,
          finished: true,
        },
      });
      expect(mockCache).toHaveBeenCalledWith(
        ["link-surveys-getResponseBySingleUseId-survey-1-single-use-1"],
        { tags: ["survey-survey-1-singleuse-single-use-1"] }
      );
      expect(result).toEqual(mockResponse);
    });

    test("should return null when no response is found", async () => {
      vi.mocked(prisma.response.findFirst).mockResolvedValueOnce(null);

      const result = await getResponseBySingleUseId("survey-1", "single-use-1");

      expect(result).toBeNull();
    });

    test("should throw DatabaseError when Prisma throws a known error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "4.0.0",
      });
      vi.mocked(prisma.response.findFirst).mockRejectedValueOnce(prismaError);

      await expect(getResponseBySingleUseId("survey-1", "single-use-1")).rejects.toThrow(DatabaseError);
    });

    test("should rethrow unknown errors", async () => {
      const error = new Error("Unknown error");
      vi.mocked(prisma.response.findFirst).mockRejectedValueOnce(error);

      await expect(getResponseBySingleUseId("survey-1", "single-use-1")).rejects.toThrow(error);
    });
  });

  describe("getExistingContactResponse", () => {
    test("should return response when found", async () => {
      const mockResponse = { id: "response-1", finished: true };
      vi.mocked(prisma.response.findFirst).mockResolvedValueOnce(mockResponse);

      const result = await getExistingContactResponse("survey-1", "contact-1");

      expect(prisma.response.findFirst).toHaveBeenCalledWith({
        where: {
          surveyId: "survey-1",
          contactId: "contact-1",
        },
        select: {
          id: true,
          finished: true,
        },
      });
      expect(mockCache).toHaveBeenCalledWith(
        ["link-surveys-getExisitingContactResponse-survey-1-contact-1"],
        { tags: ["survey-survey-1", "contact-contact-1"] }
      );
      expect(result).toEqual(mockResponse);
    });

    test("should return null when no response is found", async () => {
      vi.mocked(prisma.response.findFirst).mockResolvedValueOnce(null);

      const result = await getExistingContactResponse("survey-1", "contact-1");

      expect(result).toBeNull();
    });

    test("should throw DatabaseError when Prisma throws a known error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "4.0.0",
      });
      vi.mocked(prisma.response.findFirst).mockRejectedValueOnce(prismaError);

      await expect(getExistingContactResponse("survey-1", "contact-1")).rejects.toThrow(DatabaseError);
    });

    test("should rethrow unknown errors", async () => {
      const error = new Error("Unknown error");
      vi.mocked(prisma.response.findFirst).mockRejectedValueOnce(error);

      await expect(getExistingContactResponse("survey-1", "contact-1")).rejects.toThrow(error);
    });
  });
});
