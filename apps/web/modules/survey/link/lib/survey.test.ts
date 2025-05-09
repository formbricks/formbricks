import { cache } from "@/lib/cache";
import { surveyCache } from "@/lib/survey/cache";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getSurveyMetadata, getSurveyPin } from "./survey";

vi.mock("@/lib/cache");
vi.mock("@/lib/survey/cache", () => ({
  surveyCache: {
    tag: {
      byId: vi.fn().mockImplementation((id) => `survey-${id}`),
    },
  },
}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      findUnique: vi.fn(),
    },
  },
}));
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    cache: vi.fn().mockImplementation((fn) => fn),
  };
});

describe("Survey functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(surveyCache.tag.byId).mockImplementation((id) => `survey-${id}`);
  });

  describe("getSurveyMetadata", () => {
    test("returns survey metadata when survey exists", async () => {
      const mockSurvey = {
        id: "survey-123",
        type: "link",
        status: "active",
        environmentId: "env-123",
        name: "Test Survey",
        styling: { colorPrimary: "#000000" },
      };

      vi.mocked(prisma.survey.findUnique).mockResolvedValueOnce(mockSurvey);
      vi.mocked(cache).mockImplementationOnce((fn) => async () => fn()); // NOSONAR

      const result = await getSurveyMetadata("survey-123");

      expect(surveyCache.tag.byId).toHaveBeenCalledWith("survey-123");
      expect(cache).toHaveBeenCalledWith(expect.any(Function), ["link-survey-getSurveyMetadata-survey-123"], {
        tags: ["survey-survey-123"],
      });

      expect(prisma.survey.findUnique).toHaveBeenCalledWith({
        where: { id: "survey-123" },
        select: {
          id: true,
          type: true,
          status: true,
          environmentId: true,
          name: true,
          styling: true,
        },
      });

      expect(result).toEqual(mockSurvey);
    });

    test("throws ResourceNotFoundError when survey doesn't exist", async () => {
      vi.mocked(prisma.survey.findUnique).mockResolvedValueOnce(null);
      vi.mocked(cache).mockImplementationOnce((fn) => async () => fn()); // NOSONAR

      await expect(getSurveyMetadata("non-existent-id")).rejects.toThrow(
        new ResourceNotFoundError("Survey", "non-existent-id")
      );
    });

    test("handles database errors correctly", async () => {
      const dbError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "4.0.0",
      });

      vi.mocked(prisma.survey.findUnique).mockRejectedValueOnce(dbError);
      vi.mocked(cache).mockImplementationOnce((fn) => async () => fn()); // NOSONAR

      await expect(getSurveyMetadata("survey-123")).rejects.toThrow(new DatabaseError("Database error"));

      expect(logger.error).toHaveBeenCalledWith(dbError);
    });

    test("propagates other errors", async () => {
      const randomError = new Error("Random error");

      vi.mocked(prisma.survey.findUnique).mockRejectedValueOnce(randomError);
      vi.mocked(cache).mockImplementationOnce((fn) => async () => fn()); // NOSONAR

      await expect(getSurveyMetadata("survey-123")).rejects.toThrow(randomError);
    });
  });

  describe("getSurveyPin", () => {
    test("returns survey pin when survey exists", async () => {
      const mockSurvey = {
        pin: "1234",
      };

      vi.mocked(prisma.survey.findUnique).mockResolvedValueOnce(mockSurvey);
      vi.mocked(cache).mockImplementationOnce((fn) => async () => fn()); // NOSONAR

      const result = await getSurveyPin("survey-123");

      expect(surveyCache.tag.byId).toHaveBeenCalledWith("survey-123");
      expect(cache).toHaveBeenCalledWith(expect.any(Function), ["link-survey-getSurveyPin-survey-123"], {
        tags: ["survey-survey-123"],
      });

      expect(prisma.survey.findUnique).toHaveBeenCalledWith({
        where: { id: "survey-123" },
        select: { pin: true },
      });

      expect(result).toBe("1234");
    });

    test("throws ResourceNotFoundError when survey doesn't exist", async () => {
      vi.mocked(prisma.survey.findUnique).mockResolvedValueOnce(null);
      vi.mocked(cache).mockImplementationOnce((fn) => async () => fn()); // NOSONAR

      await expect(getSurveyPin("non-existent-id")).rejects.toThrow(
        new ResourceNotFoundError("Survey", "non-existent-id")
      );
    });
  });
});
