import { checkForInvalidImagesInQuestions } from "@/lib/survey/utils";
import { validateInputs } from "@/lib/utils/validate";
import { buildOrderByClause, buildWhereClause } from "@/modules/survey/lib/utils";
import { doesEnvironmentExist } from "@/modules/survey/list/lib/environment";
import { getProjectWithLanguagesByEnvironmentId } from "@/modules/survey/list/lib/project";
import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TActionClassType } from "@formbricks/types/action-classes";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TProjectWithLanguages, TSurvey } from "../types/surveys";
// Import the module to be tested
import {
  copySurveyToOtherEnvironment,
  deleteSurvey,
  getSurvey,
  getSurveyCount,
  getSurveys,
  getSurveysSortedByRelevance,
  surveySelect,
} from "./survey";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: vi.fn((fn) => fn), // Return the function itself, as reactCache is a HOF
  };
});

vi.mock("@/lib/survey/utils", () => ({
  checkForInvalidImagesInQuestions: vi.fn(),
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@/modules/survey/lib/utils", () => ({
  buildOrderByClause: vi.fn((sortBy) => (sortBy ? [{ [sortBy]: "desc" }] : [])),
  buildWhereClause: vi.fn((filterCriteria) => (filterCriteria ? { name: filterCriteria.name } : {})),
}));

vi.mock("@/modules/survey/list/lib/environment", () => ({
  doesEnvironmentExist: vi.fn(),
}));

vi.mock("@/modules/survey/list/lib/project", () => ({
  getProjectWithLanguagesByEnvironmentId: vi.fn(),
}));

vi.mock("@paralleldrive/cuid2", () => ({
  createId: vi.fn(() => "new_cuid2_id"),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
    },
    segment: {
      delete: vi.fn(),
      findFirst: vi.fn(),
    },
    language: {
      // Added for language connectOrCreate in copySurvey
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

// Helper to reset mocks
const resetMocks = () => {
  vi.mocked(reactCache).mockClear();
  vi.mocked(checkForInvalidImagesInQuestions).mockClear();
  vi.mocked(validateInputs).mockClear();
  vi.mocked(buildOrderByClause).mockClear();
  vi.mocked(buildWhereClause).mockClear();
  vi.mocked(doesEnvironmentExist).mockClear();
  vi.mocked(getProjectWithLanguagesByEnvironmentId).mockClear();
  vi.mocked(createId).mockClear();
  vi.mocked(prisma.survey.findMany).mockReset();
  vi.mocked(prisma.survey.findUnique).mockReset();
  vi.mocked(prisma.survey.count).mockReset();
  vi.mocked(prisma.survey.delete).mockReset();
  vi.mocked(prisma.survey.create).mockReset();
  vi.mocked(prisma.segment.delete).mockReset();
  vi.mocked(prisma.segment.findFirst).mockReset();
  vi.mocked(logger.error).mockClear();
};

const makePrismaKnownError = () =>
  new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
    code: "P2001",
    clientVersion: "test",
    meta: {},
  });

// Sample data
const environmentId = "env_1";
const surveyId = "survey_1";
const userId = "user_1";

const mockSurveyPrisma = {
  id: surveyId,
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Survey",
  type: "web" as any,
  creator: { name: "Test User" },
  status: "draft" as any,
  singleUse: null,
  environmentId,
  _count: { responses: 10 },
};

describe("getSurveyCount", () => {
  beforeEach(() => {
    resetMocks();
  });

  test("should return survey count successfully", async () => {
    vi.mocked(prisma.survey.count).mockResolvedValue(5);
    const count = await getSurveyCount(environmentId);
    expect(count).toBe(5);
    expect(prisma.survey.count).toHaveBeenCalledWith({
      where: { environmentId },
    });
    expect(validateInputs).toHaveBeenCalledWith([environmentId, expect.any(Object)]);
  });

  test("should throw DatabaseError on Prisma error", async () => {
    const prismaError = makePrismaKnownError();
    vi.mocked(prisma.survey.count).mockRejectedValue(prismaError);
    await expect(getSurveyCount(environmentId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith(prismaError, "Error getting survey count");
  });

  test("should rethrow unknown error", async () => {
    const unknownError = new Error("Unknown error");
    vi.mocked(prisma.survey.count).mockRejectedValue(unknownError);
    await expect(getSurveyCount(environmentId)).rejects.toThrow(unknownError);
  });
});

describe("getSurvey", () => {
  beforeEach(() => {
    resetMocks();
  });

  test("should return a survey if found", async () => {
    const prismaSurvey = { ...mockSurveyPrisma, _count: { responses: 5 } };
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(prismaSurvey);

    const survey = await getSurvey(surveyId);

    expect(survey).toEqual({ ...prismaSurvey, responseCount: 5 });
    expect(prisma.survey.findUnique).toHaveBeenCalledWith({
      where: { id: surveyId },
      select: surveySelect,
    });
  });

  test("should return null if survey not found", async () => {
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(null);
    const survey = await getSurvey(surveyId);
    expect(survey).toBeNull();
  });

  test("should throw DatabaseError on Prisma error", async () => {
    const prismaError = makePrismaKnownError();
    vi.mocked(prisma.survey.findUnique).mockRejectedValue(prismaError);
    await expect(getSurvey(surveyId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith(prismaError, "Error getting survey");
  });

  test("should rethrow unknown error", async () => {
    const unknownError = new Error("Unknown error");
    vi.mocked(prisma.survey.findUnique).mockRejectedValue(unknownError);
    await expect(getSurvey(surveyId)).rejects.toThrow(unknownError);
  });
});

describe("getSurveys", () => {
  beforeEach(() => {
    resetMocks();
  });

  const mockPrismaSurveys = [
    { ...mockSurveyPrisma, id: "s1", name: "Survey 1", _count: { responses: 1 } },
    { ...mockSurveyPrisma, id: "s2", name: "Survey 2", _count: { responses: 2 } },
  ];
  const expectedSurveys: TSurvey[] = mockPrismaSurveys.map((s) => ({
    ...s,
    responseCount: s._count.responses,
  }));

  test("should return surveys with default parameters", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue(mockPrismaSurveys);
    const surveys = await getSurveys(environmentId);

    expect(surveys).toEqual(expectedSurveys);
    expect(prisma.survey.findMany).toHaveBeenCalledWith({
      where: { environmentId, ...buildWhereClause() },
      select: surveySelect,
      orderBy: buildOrderByClause(),
      take: undefined,
      skip: undefined,
    });
  });

  test("should return surveys with limit and offset", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([mockPrismaSurveys[0]]);
    const surveys = await getSurveys(environmentId, 1, 1);

    expect(surveys).toEqual([expectedSurveys[0]]);
    expect(prisma.survey.findMany).toHaveBeenCalledWith({
      where: { environmentId, ...buildWhereClause() },
      select: surveySelect,
      orderBy: buildOrderByClause(),
      take: 1,
      skip: 1,
    });
  });

  test("should return surveys with filterCriteria", async () => {
    const filterCriteria: any = { name: "Test", sortBy: "createdAt" };
    vi.mocked(buildWhereClause).mockReturnValue({ AND: [{ name: { contains: "Test" } }] }); // Mock correct return type
    vi.mocked(buildOrderByClause).mockReturnValue([{ createdAt: "desc" }]); // Mock specific return
    vi.mocked(prisma.survey.findMany).mockResolvedValue(mockPrismaSurveys);

    const surveys = await getSurveys(environmentId, undefined, undefined, filterCriteria);

    expect(surveys).toEqual(expectedSurveys);
    expect(buildWhereClause).toHaveBeenCalledWith(filterCriteria);
    expect(buildOrderByClause).toHaveBeenCalledWith("createdAt");
    expect(prisma.survey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { environmentId, AND: [{ name: { contains: "Test" } }] }, // Check with correct structure
        orderBy: [{ createdAt: "desc" }], // Check the mocked order by
      })
    );
  });

  test("should throw DatabaseError on Prisma error", async () => {
    const prismaError = makePrismaKnownError();
    vi.mocked(prisma.survey.findMany).mockRejectedValue(prismaError);
    await expect(getSurveys(environmentId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith(prismaError, "Error getting surveys");
  });

  test("should rethrow unknown error", async () => {
    const unknownError = new Error("Unknown error");
    vi.mocked(prisma.survey.findMany).mockRejectedValue(unknownError);
    await expect(getSurveys(environmentId)).rejects.toThrow(unknownError);
  });
});

describe("getSurveysSortedByRelevance", () => {
  beforeEach(() => {
    resetMocks();
  });

  const mockInProgressPrisma = {
    ...mockSurveyPrisma,
    id: "s_inprog",
    status: "inProgress" as any,
    _count: { responses: 3 },
  };
  const mockOtherPrisma = {
    ...mockSurveyPrisma,
    id: "s_other",
    status: "completed" as any,
    _count: { responses: 5 },
  };

  const expectedInProgressSurvey: TSurvey = { ...mockInProgressPrisma, responseCount: 3 };
  const expectedOtherSurvey: TSurvey = { ...mockOtherPrisma, responseCount: 5 };

  test("should fetch inProgress surveys first, then others if limit not met", async () => {
    vi.mocked(prisma.survey.count).mockResolvedValue(1); // 1 inProgress survey
    vi.mocked(prisma.survey.findMany)
      .mockResolvedValueOnce([mockInProgressPrisma]) // In-progress surveys
      .mockResolvedValueOnce([mockOtherPrisma]); // Additional surveys

    const surveys = await getSurveysSortedByRelevance(environmentId, 2, 0);

    expect(surveys).toEqual([expectedInProgressSurvey, expectedOtherSurvey]);
    expect(prisma.survey.count).toHaveBeenCalledWith({
      where: { environmentId, status: "inProgress", ...buildWhereClause() },
    });
    expect(prisma.survey.findMany).toHaveBeenNthCalledWith(1, {
      where: { environmentId, status: "inProgress", ...buildWhereClause() },
      select: surveySelect,
      orderBy: buildOrderByClause("updatedAt"),
      take: 2,
      skip: 0,
    });
    expect(prisma.survey.findMany).toHaveBeenNthCalledWith(2, {
      where: { environmentId, status: { not: "inProgress" }, ...buildWhereClause() },
      select: surveySelect,
      orderBy: buildOrderByClause("updatedAt"),
      take: 1,
      skip: 0,
    });
  });

  test("should only fetch inProgress surveys if limit is met", async () => {
    vi.mocked(prisma.survey.count).mockResolvedValue(1);
    vi.mocked(prisma.survey.findMany).mockResolvedValueOnce([mockInProgressPrisma]);

    const surveys = await getSurveysSortedByRelevance(environmentId, 1, 0);
    expect(surveys).toEqual([expectedInProgressSurvey]);
    expect(prisma.survey.findMany).toHaveBeenCalledTimes(1);
  });

  test("should throw DatabaseError on Prisma error", async () => {
    const prismaError = makePrismaKnownError();
    vi.mocked(prisma.survey.count).mockRejectedValue(prismaError);
    await expect(getSurveysSortedByRelevance(environmentId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith(prismaError, "Error getting surveys sorted by relevance");

    resetMocks(); // Reset for the next part of the test
    vi.mocked(prisma.survey.count).mockResolvedValue(0); // Make count succeed
    vi.mocked(prisma.survey.findMany).mockRejectedValue(prismaError); // Error on findMany
    await expect(getSurveysSortedByRelevance(environmentId)).rejects.toThrow(DatabaseError);
  });

  test("should rethrow unknown error", async () => {
    const unknownError = new Error("Unknown error");
    vi.mocked(prisma.survey.count).mockRejectedValue(unknownError);
    await expect(getSurveysSortedByRelevance(environmentId)).rejects.toThrow(unknownError);
  });
});

describe("deleteSurvey", () => {
  beforeEach(() => {
    resetMocks();
  });

  const mockDeletedSurveyData = {
    id: surveyId,
    environmentId,
    segment: null,
    type: "web" as any,
    resultShareKey: "sharekey1",
    triggers: [{ actionClass: { id: "action_1" } }],
  };

  test("should delete a survey and revalidate caches (no private segment)", async () => {
    vi.mocked(prisma.survey.delete).mockResolvedValue(mockDeletedSurveyData as any);
    const result = await deleteSurvey(surveyId);

    expect(result).toBe(true);
    expect(prisma.survey.delete).toHaveBeenCalledWith({
      where: { id: surveyId },
      select: expect.objectContaining({ id: true, environmentId: true, segment: expect.anything() }),
    });
    expect(prisma.segment.delete).not.toHaveBeenCalled();
  });

  test("should revalidate segment cache for non-private segment if segment exists", async () => {
    const surveyWithPublicSegment = {
      ...mockDeletedSurveyData,
      segment: { id: "segment_public_1", isPrivate: false },
    };
    vi.mocked(prisma.survey.delete).mockResolvedValue(surveyWithPublicSegment as any);

    await deleteSurvey(surveyId);

    expect(prisma.segment.delete).not.toHaveBeenCalled();
  });

  test("should throw DatabaseError on Prisma error", async () => {
    const prismaError = makePrismaKnownError();
    vi.mocked(prisma.survey.delete).mockRejectedValue(prismaError);
    await expect(deleteSurvey(surveyId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith(prismaError, "Error deleting survey");
  });

  test("should rethrow unknown error", async () => {
    const unknownError = new Error("Unknown error");
    vi.mocked(prisma.survey.delete).mockRejectedValue(unknownError);
    await expect(deleteSurvey(surveyId)).rejects.toThrow(unknownError);
  });
});

const mockExistingSurveyDetails = {
  name: "Original Survey",
  type: "web" as any,
  languages: [{ default: true, enabled: true, language: { code: "en", alias: "English" } }],
  welcomeCard: { enabled: true, headline: { default: "Welcome!" } },
  questions: [{ id: "q1", type: "openText", headline: { default: "Question 1" } }],
  endings: [{ type: "default", headline: { default: "Thanks!" } }],
  variables: [{ id: "var1", name: "Var One" }],
  hiddenFields: { enabled: true, fieldIds: ["hf1"] },
  surveyClosedMessage: { enabled: false },
  singleUse: { enabled: false },
  projectOverwrites: null,
  styling: { theme: {} },
  segment: null,
  followUps: [{ name: "Follow Up 1", trigger: {}, action: {} }],
  triggers: [
    {
      actionClass: {
        id: "ac1",
        name: "Code Action",
        environmentId,
        description: "",
        type: "code" as TActionClassType,
        key: "code_action_key",
        noCodeConfig: null,
      },
    },
    {
      actionClass: {
        id: "ac2",
        name: "No-Code Action",
        environmentId,
        description: "",
        type: "noCode" as TActionClassType,
        key: null,
        noCodeConfig: { type: "url" },
      },
    },
  ],
};

describe("copySurveyToOtherEnvironment", () => {
  const targetEnvironmentId = "env_target";
  const sourceProjectId = "proj_source";
  const targetProjectId = "proj_target";

  const mockSourceProject: TProjectWithLanguages = {
    id: sourceProjectId,
    languages: [{ code: "en", alias: "English" }],
  };
  const mockTargetProject: TProjectWithLanguages = {
    id: targetProjectId,
    languages: [{ code: "en", alias: "English" }],
  };

  const mockNewSurveyResult = {
    id: "new_cuid2_id",
    environmentId: targetEnvironmentId,
    segment: null,
    triggers: [
      { actionClass: { id: "new_ac1", name: "Code Action", environmentId: targetEnvironmentId } },
      { actionClass: { id: "new_ac2", name: "No-Code Action", environmentId: targetEnvironmentId } },
    ],
    languages: [{ language: { code: "en" } }],
    resultShareKey: null,
  };

  beforeEach(() => {
    resetMocks();
    vi.mocked(createId).mockReturnValue("new_cuid2_id");
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(mockExistingSurveyDetails as any);
    vi.mocked(doesEnvironmentExist).mockResolvedValue(environmentId);
    vi.mocked(getProjectWithLanguagesByEnvironmentId)
      .mockResolvedValueOnce(mockSourceProject)
      .mockResolvedValueOnce(mockTargetProject);
    vi.mocked(prisma.survey.create).mockResolvedValue(mockNewSurveyResult as any);
    vi.mocked(prisma.segment.findFirst).mockResolvedValue(null);
  });

  test("should copy survey to a different environment successfully", async () => {
    const newSurvey = await copySurveyToOtherEnvironment(
      environmentId,
      surveyId,
      targetEnvironmentId,
      userId
    );

    expect(newSurvey).toBeDefined();
    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: "new_cuid2_id",
          name: `${mockExistingSurveyDetails.name} (copy)`,
          environment: { connect: { id: targetEnvironmentId } },
          creator: { connect: { id: userId } },
          status: "draft",
          triggers: {
            create: [
              expect.objectContaining({
                actionClass: {
                  connectOrCreate: {
                    where: {
                      key_environmentId: { key: "code_action_key", environmentId: targetEnvironmentId },
                    },
                    create: expect.objectContaining({ name: "Code Action", key: "code_action_key" }),
                  },
                },
              }),
              expect.objectContaining({
                actionClass: {
                  connectOrCreate: {
                    where: {
                      name_environmentId: { name: "No-Code Action", environmentId: targetEnvironmentId },
                    },
                    create: expect.objectContaining({
                      name: "No-Code Action",
                      noCodeConfig: { type: "url" },
                    }),
                  },
                },
              }),
            ],
          },
        }),
      })
    );
    expect(checkForInvalidImagesInQuestions).toHaveBeenCalledWith(mockExistingSurveyDetails.questions);
    expect(actionClassCache.revalidate).toHaveBeenCalledTimes(2);
    expect(surveyCache.revalidate).toHaveBeenCalledWith(expect.objectContaining({ id: "new_cuid2_id" }));
    expect(surveyCache.revalidate).toHaveBeenCalledWith({ actionClassId: "ac1" });
    expect(surveyCache.revalidate).toHaveBeenCalledWith({ actionClassId: "ac2" });
  });

  test("should copy survey to the same environment successfully", async () => {
    vi.mocked(getProjectWithLanguagesByEnvironmentId).mockReset();
    vi.mocked(getProjectWithLanguagesByEnvironmentId).mockResolvedValue(mockSourceProject);

    await copySurveyToOtherEnvironment(environmentId, surveyId, environmentId, userId);

    expect(getProjectWithLanguagesByEnvironmentId).toHaveBeenCalledTimes(1);
    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          environment: { connect: { id: environmentId } },
          triggers: {
            create: [
              { actionClass: { connect: { id: "ac1" } } },
              { actionClass: { connect: { id: "ac2" } } },
            ],
          },
        }),
      })
    );
  });

  test("should handle private segment: create new private segment in target", async () => {
    const surveyWithPrivateSegment = {
      ...mockExistingSurveyDetails,
      segment: { id: "seg_private", isPrivate: true, filters: [{ type: "user", value: "test" }] },
    };
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(surveyWithPrivateSegment as any);

    const mockNewSurveyWithSegment = { ...mockNewSurveyResult, segment: { id: "new_seg_private" } };
    vi.mocked(prisma.survey.create).mockResolvedValue(mockNewSurveyWithSegment as any);

    await copySurveyToOtherEnvironment(environmentId, surveyId, targetEnvironmentId, userId);

    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          segment: {
            create: {
              title: "new_cuid2_id",
              isPrivate: true,
              filters: surveyWithPrivateSegment.segment.filters,
              environment: { connect: { id: targetEnvironmentId } },
            },
          },
        }),
      })
    );
    expect(segmentCache.revalidate).toHaveBeenCalledWith({
      id: "new_seg_private",
      environmentId: targetEnvironmentId,
    });
  });

  test("should handle public segment: connect if same env, create new if different env (no existing in target)", async () => {
    const surveyWithPublicSegment = {
      ...mockExistingSurveyDetails,
      segment: { id: "seg_public", title: "Public Segment", isPrivate: false, filters: [] },
    };
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(surveyWithPublicSegment as any);
    vi.mocked(getProjectWithLanguagesByEnvironmentId)
      .mockReset() // for same env part
      .mockResolvedValueOnce(mockSourceProject);

    // Case 1: Same environment
    await copySurveyToOtherEnvironment(environmentId, surveyId, environmentId, userId); // target is same
    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          segment: { connect: { id: "seg_public" } },
        }),
      })
    );

    // Reset for different env part
    resetMocks();
    vi.mocked(createId).mockReturnValue("new_cuid2_id");
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(surveyWithPublicSegment as any);
    vi.mocked(doesEnvironmentExist).mockResolvedValue(environmentId);
    vi.mocked(getProjectWithLanguagesByEnvironmentId)
      .mockResolvedValueOnce(mockSourceProject)
      .mockResolvedValueOnce(mockTargetProject);
    vi.mocked(prisma.survey.create).mockResolvedValue(mockNewSurveyResult as any);
    vi.mocked(prisma.segment.findFirst).mockResolvedValue(null); // No existing public segment with same title in target

    // Case 2: Different environment, segment with same title does not exist in target
    await copySurveyToOtherEnvironment(environmentId, surveyId, targetEnvironmentId, userId);
    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          segment: {
            create: {
              title: "Public Segment",
              isPrivate: false,
              filters: [],
              environment: { connect: { id: targetEnvironmentId } },
            },
          },
        }),
      })
    );
  });

  test("should handle public segment: create new with appended timestamp if different env and segment with same title exists in target", async () => {
    const surveyWithPublicSegment = {
      ...mockExistingSurveyDetails,
      segment: { id: "seg_public", title: "Public Segment", isPrivate: false, filters: [] },
    };
    resetMocks();
    vi.mocked(createId).mockReturnValue("new_cuid2_id");
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(surveyWithPublicSegment as any);
    vi.mocked(doesEnvironmentExist).mockResolvedValue(environmentId);
    vi.mocked(getProjectWithLanguagesByEnvironmentId)
      .mockResolvedValueOnce(mockSourceProject)
      .mockResolvedValueOnce(mockTargetProject);
    vi.mocked(prisma.survey.create).mockResolvedValue(mockNewSurveyResult as any);
    vi.mocked(prisma.segment.findFirst).mockResolvedValue({ id: "existing_target_seg" } as any); // Segment with same title EXISTS
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(1234567890);

    await copySurveyToOtherEnvironment(environmentId, surveyId, targetEnvironmentId, userId);
    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          segment: {
            create: {
              title: `Public Segment-1234567890`,
              isPrivate: false,
              filters: [],
              environment: { connect: { id: targetEnvironmentId } },
            },
          },
        }),
      })
    );
    dateNowSpy.mockRestore();
  });

  test("should throw ResourceNotFoundError if source environment not found", async () => {
    vi.mocked(doesEnvironmentExist).mockResolvedValueOnce(null);
    await expect(
      copySurveyToOtherEnvironment(environmentId, surveyId, targetEnvironmentId, userId)
    ).rejects.toThrow(new ResourceNotFoundError("Environment", environmentId));
  });

  test("should throw ResourceNotFoundError if source project not found", async () => {
    vi.mocked(getProjectWithLanguagesByEnvironmentId).mockReset().mockResolvedValueOnce(null);
    await expect(
      copySurveyToOtherEnvironment(environmentId, surveyId, targetEnvironmentId, userId)
    ).rejects.toThrow(new ResourceNotFoundError("Project", environmentId));
  });

  test("should throw ResourceNotFoundError if existing survey not found", async () => {
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(null);
    await expect(
      copySurveyToOtherEnvironment(environmentId, surveyId, targetEnvironmentId, userId)
    ).rejects.toThrow(new ResourceNotFoundError("Survey", surveyId));
  });

  test("should throw ResourceNotFoundError if target environment not found (different env copy)", async () => {
    vi.mocked(doesEnvironmentExist).mockResolvedValueOnce(environmentId).mockResolvedValueOnce(null);
    await expect(
      copySurveyToOtherEnvironment(environmentId, surveyId, targetEnvironmentId, userId)
    ).rejects.toThrow(new ResourceNotFoundError("Environment", targetEnvironmentId));
  });

  test("should throw DatabaseError on Prisma create error", async () => {
    const prismaError = makePrismaKnownError();
    vi.mocked(prisma.survey.create).mockRejectedValue(prismaError);
    await expect(
      copySurveyToOtherEnvironment(environmentId, surveyId, targetEnvironmentId, userId)
    ).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith(prismaError, "Error copying survey to other environment");
  });

  test("should rethrow unknown error during copy", async () => {
    const unknownError = new Error("Some unknown error during copy");
    vi.mocked(prisma.survey.create).mockRejectedValue(unknownError);
    await expect(
      copySurveyToOtherEnvironment(environmentId, surveyId, targetEnvironmentId, userId)
    ).rejects.toThrow(unknownError);
  });

  test("should handle survey with no languages", async () => {
    const surveyWithoutLanguages = { ...mockExistingSurveyDetails, languages: [] };
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(surveyWithoutLanguages as any);

    await copySurveyToOtherEnvironment(environmentId, surveyId, targetEnvironmentId, userId);
    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          languages: undefined,
        }),
      })
    );
    expect(projectCache.revalidate).not.toHaveBeenCalled();
  });

  test("should handle survey with no triggers", async () => {
    const surveyWithoutTriggers = { ...mockExistingSurveyDetails, triggers: [] };
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(surveyWithoutTriggers as any);

    await copySurveyToOtherEnvironment(environmentId, surveyId, targetEnvironmentId, userId);
    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          triggers: { create: [] },
        }),
      })
    );
  });
});
