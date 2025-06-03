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
});
