import { cache } from "@/lib/cache";
import { responseCache } from "@/lib/response/cache";
import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { getResponseCountBySurveyId } from "./response";

// Mock dependencies
vi.mock("@/lib/cache", () => ({
  cache: vi.fn((fn) => fn),
}));

vi.mock("@/lib/response/cache", () => ({
  responseCache: {
    tag: {
      bySurveyId: vi.fn((surveyId) => `survey-${surveyId}-responses`),
    },
  },
}));

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    cache: vi.fn((fn) => fn), // Mock react's cache to just return the function
  };
});

vi.mock("@formbricks/database", () => ({
  prisma: {
    response: {
      count: vi.fn(),
    },
  },
}));

const surveyId = "test-survey-id";

describe("getResponseCountBySurveyId", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should return the response count for a survey", async () => {
    const mockCount = 5;
    vi.mocked(prisma.response.count).mockResolvedValue(mockCount);

    const result = await getResponseCountBySurveyId(surveyId);

    expect(result).toBe(mockCount);
    expect(prisma.response.count).toHaveBeenCalledWith({
      where: { surveyId },
    });
    expect(cache).toHaveBeenCalledTimes(1);
    expect(responseCache.tag.bySurveyId).toHaveBeenCalledWith(surveyId);
  });

  test("should throw DatabaseError if PrismaClientKnownRequestError occurs", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
      code: "P2002",
      clientVersion: "2.0.0",
    });
    vi.mocked(prisma.response.count).mockRejectedValue(prismaError);

    await expect(getResponseCountBySurveyId(surveyId)).rejects.toThrow(DatabaseError);
    expect(prisma.response.count).toHaveBeenCalledWith({
      where: { surveyId },
    });
    expect(cache).toHaveBeenCalledTimes(1);
  });

  test("should throw generic error if an unknown error occurs", async () => {
    const genericError = new Error("Test Generic Error");
    vi.mocked(prisma.response.count).mockRejectedValue(genericError);

    await expect(getResponseCountBySurveyId(surveyId)).rejects.toThrow(genericError);
    expect(prisma.response.count).toHaveBeenCalledWith({
      where: { surveyId },
    });
    expect(cache).toHaveBeenCalledTimes(1);
  });
});
