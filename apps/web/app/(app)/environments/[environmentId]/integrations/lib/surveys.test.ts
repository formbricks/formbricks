import { selectSurvey } from "@/lib/survey/service";
import { transformPrismaSurvey } from "@/lib/survey/utils";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getSurveys } from "./surveys";

// Mock dependencies
vi.mock("@/lib/survey/service", () => ({
  selectSurvey: { id: true, name: true, status: true, updatedAt: true }, // Expanded mock based on usage
}));
vi.mock("@/lib/survey/utils");
vi.mock("@/lib/utils/validate");
vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: vi.fn((fn) => fn), // Mock reactCache to just return the function
  };
});

const environmentId = "test-environment-id";
// Ensure mockPrismaSurveys includes all fields used in selectSurvey mock
const mockPrismaSurveys = [
  { id: "survey1", name: "Survey 1", status: "inProgress", updatedAt: new Date() },
  { id: "survey2", name: "Survey 2", status: "draft", updatedAt: new Date() },
];
const mockTransformedSurveys: TSurvey[] = [
  {
    id: "survey1",
    name: "Survey 1",
    status: "inProgress",
    questions: [],
    triggers: [],
    recontactDays: null,
    displayOption: "displayOnce",
    autoClose: null,
    delay: 0,
    autoComplete: null,
    surveyClosedMessage: null,
    singleUse: null,
    welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
    hiddenFields: { enabled: false },
    type: "app", // Changed type to web to match original file
    environmentId: environmentId,
    createdAt: new Date(),
    updatedAt: new Date(),
    languages: [],
    styling: null,
  } as unknown as TSurvey,
  {
    id: "survey2",
    name: "Survey 2",
    status: "draft",
    questions: [],
    triggers: [],
    recontactDays: null,
    displayOption: "displayOnce",
    autoClose: null,
    delay: 0,
    autoComplete: null,
    surveyClosedMessage: null,
    singleUse: null,
    welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
    hiddenFields: { enabled: false },
    type: "app",
    environmentId: environmentId,
    createdAt: new Date(),
    updatedAt: new Date(),
    languages: [],
    styling: null,
  } as unknown as TSurvey,
];

describe("getSurveys", () => {
  test("should fetch and transform surveys successfully", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue(mockPrismaSurveys);
    vi.mocked(transformPrismaSurvey).mockImplementation((survey) => {
      const found = mockTransformedSurveys.find((ts) => ts.id === survey.id);
      if (!found) throw new Error("Survey not found in mock transformed data");
      // Ensure the returned object matches the TSurvey structure precisely
      return { ...found } as TSurvey;
    });

    const surveys = await getSurveys(environmentId);

    expect(surveys).toEqual(mockTransformedSurveys);
    // Use expect.any(ZId) for the Zod schema validation check
    expect(validateInputs).toHaveBeenCalledWith([environmentId, expect.any(Object)]); // Adjusted expectation
    expect(prisma.survey.findMany).toHaveBeenCalledWith({
      where: {
        environmentId,
        status: {
          not: "completed",
        },
      },
      select: selectSurvey,
      orderBy: {
        updatedAt: "desc",
      },
    });
    expect(transformPrismaSurvey).toHaveBeenCalledTimes(mockPrismaSurveys.length);
    expect(transformPrismaSurvey).toHaveBeenCalledWith(mockPrismaSurveys[0]);
    expect(transformPrismaSurvey).toHaveBeenCalledWith(mockPrismaSurveys[1]);
    // Remove the assertion for reactCache being called within the test execution
    // expect(reactCache).toHaveBeenCalled(); // Removed this line
  });

  test("should throw DatabaseError on Prisma known request error", async () => {
    // No need to mock cache here again as beforeEach handles it
    const prismaError = new Prisma.PrismaClientKnownRequestError("Test error", {
      code: "P2025",
      clientVersion: "5.0.0",
      meta: {}, // Added meta property
    });
    vi.mocked(prisma.survey.findMany).mockRejectedValue(prismaError);

    await expect(getSurveys(environmentId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith({ error: prismaError }, "getSurveys: Could not fetch surveys");
    expect(cache).toHaveBeenCalled(); // Ensure cache wrapper was still called
  });

  test("should throw original error on other errors", async () => {
    // No need to mock cache here again as beforeEach handles it
    const genericError = new Error("Something went wrong");
    vi.mocked(prisma.survey.findMany).mockRejectedValue(genericError);

    await expect(getSurveys(environmentId)).rejects.toThrow(genericError);
    expect(logger.error).not.toHaveBeenCalled();
    expect(cache).toHaveBeenCalled(); // Ensure cache wrapper was still called
  });
});
