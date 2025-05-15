import { cache } from "@/lib/cache";
import { surveyCache } from "@/lib/survey/cache";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getSurvey } from "../surveys";

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/cache", () => ({
  cache: vi.fn((fn) => fn),
}));

vi.mock("@/lib/survey/cache", () => ({
  surveyCache: {
    tag: {
      byId: vi.fn((id) => `survey-${id}`),
    },
  },
}));

describe("getSurvey", () => {
  const mockSurveyId = "survey-123";
  const mockEnvironmentId = "env-456";
  const mockSurvey = {
    id: mockSurveyId,
    environmentId: mockEnvironmentId,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("should return survey data when survey is found", async () => {
    vi.mocked(prisma.survey.findUnique).mockResolvedValueOnce(mockSurvey);

    const result = await getSurvey(mockSurveyId);

    expect(prisma.survey.findUnique).toHaveBeenCalledWith({
      where: { id: mockSurveyId },
      select: {
        id: true,
        environmentId: true,
        status: true,
        type: true,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockSurvey);
    }

    expect(surveyCache.tag.byId).toHaveBeenCalledWith(mockSurveyId);
    expect(cache).toHaveBeenCalledWith(expect.any(Function), [`contact-link-getSurvey-${mockSurveyId}`], {
      tags: [`survey-${mockSurveyId}`],
    });
  });

  test("should return not_found error when survey doesn't exist", async () => {
    vi.mocked(prisma.survey.findUnique).mockResolvedValueOnce(null);

    const result = await getSurvey(mockSurveyId);

    expect(prisma.survey.findUnique).toHaveBeenCalledWith({
      where: { id: mockSurveyId },
      select: {
        id: true,
        environmentId: true,
        status: true,
        type: true,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toStrictEqual({
        type: "not_found",
        details: [{ field: "survey", issue: "not found" }],
      });
    }
  });

  test("should return internal_server_error when database throws an error", async () => {
    const mockError = new Error("Database connection failed");
    vi.mocked(prisma.survey.findUnique).mockRejectedValueOnce(mockError);

    const result = await getSurvey(mockSurveyId);

    expect(prisma.survey.findUnique).toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toStrictEqual({
        type: "internal_server_error",
        details: [{ field: "survey", issue: "Database connection failed" }],
      });
    }
  });

  test("should use correct cache key and tags", async () => {
    vi.mocked(prisma.survey.findUnique).mockResolvedValueOnce(mockSurvey);

    await getSurvey(mockSurveyId);

    expect(cache).toHaveBeenCalledWith(expect.any(Function), [`contact-link-getSurvey-${mockSurveyId}`], {
      tags: [`survey-${mockSurveyId}`],
    });
    expect(surveyCache.tag.byId).toHaveBeenCalledWith(mockSurveyId);
  });
});
