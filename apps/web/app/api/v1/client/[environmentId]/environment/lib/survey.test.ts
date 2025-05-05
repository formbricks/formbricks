import { cache } from "@/lib/cache";
import { validateInputs } from "@/lib/utils/validate";
import { transformPrismaSurvey } from "@/modules/survey/lib/utils";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { getSurveysForEnvironmentState } from "./survey";

// Mock dependencies
vi.mock("@/lib/cache");
vi.mock("@/lib/utils/validate");
vi.mock("@/modules/survey/lib/utils");
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

const environmentId = "test-environment-id";

const mockPrismaSurvey = {
  id: "survey-1",
  welcomeCard: { enabled: false },
  name: "Test Survey",
  questions: [],
  variables: [],
  type: "app",
  showLanguageSwitch: false,
  languages: [],
  endings: [],
  autoClose: null,
  styling: null,
  status: "inProgress",
  recaptcha: null,
  segment: null,
  recontactDays: null,
  displayLimit: null,
  displayOption: "displayOnce",
  hiddenFields: { enabled: false },
  isBackButtonHidden: false,
  triggers: [],
  displayPercentage: null,
  delay: 0,
  projectOverwrites: null,
};

const mockTransformedSurvey: TJsEnvironmentStateSurvey = {
  id: "survey-1",
  welcomeCard: { enabled: false } as TJsEnvironmentStateSurvey["welcomeCard"],
  name: "Test Survey",
  questions: [],
  variables: [],
  type: "app",
  showLanguageSwitch: false,
  languages: [],
  endings: [],
  autoClose: null,
  styling: null,
  status: "inProgress",
  recaptcha: null,
  segment: null,
  recontactDays: null,
  displayLimit: null,
  displayOption: "displayOnce",
  hiddenFields: { enabled: false },
  isBackButtonHidden: false,
  triggers: [],
  displayPercentage: null,
  delay: 0,
  projectOverwrites: null,
};

describe("getSurveysForEnvironmentState", () => {
  beforeEach(() => {
    vi.mocked(cache).mockImplementation((fn) => async () => {
      return fn();
    });
    vi.mocked(validateInputs).mockReturnValue([environmentId]); // Assume validation passes
    vi.mocked(transformPrismaSurvey).mockReturnValue(mockTransformedSurvey);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("should return transformed surveys on successful fetch", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([mockPrismaSurvey]);

    const result = await getSurveysForEnvironmentState(environmentId);

    expect(validateInputs).toHaveBeenCalledWith([environmentId, expect.any(Object)]);
    expect(prisma.survey.findMany).toHaveBeenCalledWith({
      where: { environmentId },
      select: expect.any(Object), // Check if select is called, specific fields are in the original code
    });
    expect(transformPrismaSurvey).toHaveBeenCalledWith(mockPrismaSurvey);
    expect(result).toEqual([mockTransformedSurvey]);
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("should return an empty array if no surveys are found", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([]);

    const result = await getSurveysForEnvironmentState(environmentId);

    expect(prisma.survey.findMany).toHaveBeenCalledWith({
      where: { environmentId },
      select: expect.any(Object),
    });
    expect(transformPrismaSurvey).not.toHaveBeenCalled();
    expect(result).toEqual([]);
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("should throw DatabaseError on Prisma known request error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
      code: "P2025",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.survey.findMany).mockRejectedValue(prismaError);

    await expect(getSurveysForEnvironmentState(environmentId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith(prismaError, "Error getting surveys for environment state");
  });

  test("should rethrow unknown errors", async () => {
    const unknownError = new Error("Something went wrong");
    vi.mocked(prisma.survey.findMany).mockRejectedValue(unknownError);

    await expect(getSurveysForEnvironmentState(environmentId)).rejects.toThrow(unknownError);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
