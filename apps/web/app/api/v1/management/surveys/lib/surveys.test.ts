import { cache } from "@/lib/cache";
import { selectSurvey } from "@/lib/survey/service";
import { transformPrismaSurvey } from "@/lib/survey/utils";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getSurveys } from "./surveys";

// Mock dependencies
vi.mock("@/lib/cache");
vi.mock("@/lib/survey/cache");
vi.mock("@/lib/survey/utils");
vi.mock("@/lib/utils/validate");
vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock("@formbricks/logger");
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    cache: vi.fn((fn) => fn), // Mock reactCache to just execute the function
  };
});

const environmentId1 = "env1";
const environmentId2 = "env2";
const surveyId1 = "survey1";
const surveyId2 = "survey2";
const surveyId3 = "survey3";

const mockSurveyPrisma1 = {
  id: surveyId1,
  environmentId: environmentId1,
  name: "Survey 1",
  updatedAt: new Date(),
};
const mockSurveyPrisma2 = {
  id: surveyId2,
  environmentId: environmentId1,
  name: "Survey 2",
  updatedAt: new Date(),
};
const mockSurveyPrisma3 = {
  id: surveyId3,
  environmentId: environmentId2,
  name: "Survey 3",
  updatedAt: new Date(),
};

const mockSurveyTransformed1: TSurvey = {
  ...mockSurveyPrisma1,
  displayPercentage: null,
  segment: null,
} as TSurvey;
const mockSurveyTransformed2: TSurvey = {
  ...mockSurveyPrisma2,
  displayPercentage: null,
  segment: null,
} as TSurvey;
const mockSurveyTransformed3: TSurvey = {
  ...mockSurveyPrisma3,
  displayPercentage: null,
  segment: null,
} as TSurvey;

describe("getSurveys (Management API)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Mock the cache function to simply execute the underlying function
    vi.mocked(cache).mockImplementation((fn) => async () => {
      return fn();
    });
    vi.mocked(transformPrismaSurvey).mockImplementation((survey) => ({
      ...survey,
      displayPercentage: null,
      segment: null,
    }));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("should return surveys for a single environment ID with limit and offset", async () => {
    const limit = 1;
    const offset = 1;
    vi.mocked(prisma.survey.findMany).mockResolvedValue([mockSurveyPrisma2]);

    const surveys = await getSurveys([environmentId1], limit, offset);

    expect(validateInputs).toHaveBeenCalledWith(
      [[environmentId1], expect.any(Object)],
      [limit, expect.any(Object)],
      [offset, expect.any(Object)]
    );
    expect(prisma.survey.findMany).toHaveBeenCalledWith({
      where: { environmentId: { in: [environmentId1] } },
      select: selectSurvey,
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    });
    expect(transformPrismaSurvey).toHaveBeenCalledTimes(1);
    expect(transformPrismaSurvey).toHaveBeenCalledWith(mockSurveyPrisma2);
    expect(surveys).toEqual([mockSurveyTransformed2]);
    expect(cache).toHaveBeenCalledTimes(1);
  });

  test("should return surveys for multiple environment IDs without limit and offset", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([
      mockSurveyPrisma1,
      mockSurveyPrisma2,
      mockSurveyPrisma3,
    ]);

    const surveys = await getSurveys([environmentId1, environmentId2]);

    expect(validateInputs).toHaveBeenCalledWith(
      [[environmentId1, environmentId2], expect.any(Object)],
      [undefined, expect.any(Object)],
      [undefined, expect.any(Object)]
    );
    expect(prisma.survey.findMany).toHaveBeenCalledWith({
      where: { environmentId: { in: [environmentId1, environmentId2] } },
      select: selectSurvey,
      orderBy: { updatedAt: "desc" },
      take: undefined,
      skip: undefined,
    });
    expect(transformPrismaSurvey).toHaveBeenCalledTimes(3);
    expect(surveys).toEqual([mockSurveyTransformed1, mockSurveyTransformed2, mockSurveyTransformed3]);
    expect(cache).toHaveBeenCalledTimes(1);
  });

  test("should return an empty array if no surveys are found", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([]);

    const surveys = await getSurveys([environmentId1]);

    expect(prisma.survey.findMany).toHaveBeenCalled();
    expect(transformPrismaSurvey).not.toHaveBeenCalled();
    expect(surveys).toEqual([]);
    expect(cache).toHaveBeenCalledTimes(1);
  });

  test("should handle PrismaClientKnownRequestError", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("DB error", {
      code: "P2021",
      clientVersion: "4.0.0",
    });
    vi.mocked(prisma.survey.findMany).mockRejectedValue(prismaError);

    await expect(getSurveys([environmentId1])).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith(prismaError, "Error getting surveys");
    expect(cache).toHaveBeenCalledTimes(1);
  });

  test("should handle generic errors", async () => {
    const genericError = new Error("Something went wrong");
    vi.mocked(prisma.survey.findMany).mockRejectedValue(genericError);

    await expect(getSurveys([environmentId1])).rejects.toThrow(genericError);
    expect(logger.error).not.toHaveBeenCalled();
    expect(cache).toHaveBeenCalledTimes(1);
  });

  test("should throw validation error for invalid input", async () => {
    const invalidEnvId = "invalid-env";
    const validationError = new Error("Validation failed");
    vi.mocked(validateInputs).mockImplementation(() => {
      throw validationError;
    });

    await expect(getSurveys([invalidEnvId])).rejects.toThrow(validationError);
    expect(prisma.survey.findMany).not.toHaveBeenCalled();
    expect(cache).toHaveBeenCalledTimes(1); // Cache wrapper is still called
  });
});
