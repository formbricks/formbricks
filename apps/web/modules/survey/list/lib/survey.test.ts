import { createId } from "@paralleldrive/cuid2";
import { cache as reactCache } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { TActionClassType } from "@formbricks/types/action-classes";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { checkForInvalidMediaInBlocks } from "@/lib/survey/utils";
import { validateInputs } from "@/lib/utils/validate";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { getQuotas } from "@/modules/ee/quotas/lib/quotas";
import { buildOrderByClause, buildWhereClause } from "@/modules/survey/lib/utils";
import { doesWorkspaceExist, getWorkspaceWithLanguages } from "@/modules/survey/list/lib/workspace";
import { TSurvey, TWorkspaceWithLanguages } from "../types/surveys";
// Import the module to be tested
import {
  copySurveyToOtherWorkspace,
  getSurvey,
  getSurveyCount,
  getSurveys,
  getSurveysSortedByRelevance,
} from "./survey";
import { surveySelect } from "./survey-record";

vi.mock("server-only", () => ({}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: vi.fn((fn) => fn), // Return the function itself, as reactCache is a HOF
  };
});

vi.mock("@/lib/survey/utils", () => ({
  checkForInvalidMediaInBlocks: vi.fn(() => ({ ok: true, data: undefined })),
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationByWorkspaceId: vi.fn(),
}));

vi.mock("@/modules/survey/lib/utils", () => ({
  buildOrderByClause: vi.fn((sortBy) => (sortBy ? [{ [sortBy]: "desc" }] : [])),
  buildWhereClause: vi.fn((filterCriteria) => (filterCriteria ? { name: filterCriteria.name } : {})),
}));

vi.mock("@/modules/survey/list/lib/workspace", () => ({
  doesWorkspaceExist: vi.fn(),
  getWorkspaceWithLanguages: vi.fn(),
}));

vi.mock("@paralleldrive/cuid2", () => ({
  createId: vi.fn(() => "new_cuid2_id"),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsQuotasEnabled: vi.fn(),
}));

vi.mock("@/modules/ee/quotas/lib/quotas", () => ({
  getQuotas: vi.fn(),
}));

vi.mock("@/lingodotdev/server", () => ({
  getTranslate: async () => (key: string, params?: Record<string, unknown>) => {
    if (key === "common.duplicate_copy") return "(copy)";
    if (key === "common.duplicate_copy_number") return `(copy ${params?.copyNumber})`;
    return key;
  },
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
    response: {
      groupBy: vi.fn(),
    },
    language: {
      // Added for language connectOrCreate in copySurvey
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    actionClass: {
      findMany: vi.fn(),
    },
    surveyQuota: {
      findMany: vi.fn(),
    },
    organization: {
      findFirst: vi.fn(),
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
  vi.mocked(checkForInvalidMediaInBlocks).mockClear();
  vi.mocked(validateInputs).mockClear();
  vi.mocked(buildOrderByClause).mockClear();
  vi.mocked(buildWhereClause).mockClear();
  vi.mocked(doesWorkspaceExist).mockClear();
  vi.mocked(getWorkspaceWithLanguages).mockClear();
  vi.mocked(getOrganizationByWorkspaceId).mockClear();
  vi.mocked(createId).mockClear();
  vi.mocked(prisma.survey.findMany).mockReset();
  vi.mocked(prisma.survey.findUnique).mockReset();
  vi.mocked(prisma.survey.count).mockReset();
  vi.mocked(prisma.survey.delete).mockReset();
  vi.mocked(prisma.survey.create).mockReset();
  vi.mocked(prisma.segment.delete).mockReset();
  vi.mocked(prisma.segment.findFirst).mockReset();
  vi.mocked(prisma.response.groupBy).mockReset();
  vi.mocked(prisma.actionClass.findMany).mockReset();
  vi.mocked(getQuotas).mockReset();
  vi.mocked(logger.error).mockClear();
};

const makePrismaKnownError = () =>
  new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
    code: "P2001",
    clientVersion: "test",
    meta: {},
  });

// Sample data
const workspaceId = "ws_1";
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
  workspaceId,
  _count: { responses: 10 },
};

describe("getSurveyCount", () => {
  beforeEach(() => {
    resetMocks();
  });

  test("should return survey count successfully", async () => {
    vi.mocked(prisma.survey.count).mockResolvedValue(5);
    const count = await getSurveyCount(workspaceId);
    expect(count).toBe(5);
    expect(prisma.survey.count).toHaveBeenCalledWith({
      where: { workspaceId },
    });
    expect(validateInputs).toHaveBeenCalledWith([workspaceId, expect.any(Object)]);
  });

  test("should throw DatabaseError on Prisma error", async () => {
    const prismaError = makePrismaKnownError();
    vi.mocked(prisma.survey.count).mockRejectedValue(prismaError);
    await expect(getSurveyCount(workspaceId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith(prismaError, "Error getting survey count");
  });

  test("should rethrow unknown error", async () => {
    const unknownError = new Error("Unknown error");
    vi.mocked(prisma.survey.count).mockRejectedValue(unknownError);
    await expect(getSurveyCount(workspaceId)).rejects.toThrow(unknownError);
  });
});

describe("getSurvey", () => {
  beforeEach(() => {
    resetMocks();
  });

  test("should return a survey if found", async () => {
    const prismaSurvey = { ...mockSurveyPrisma };
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(prismaSurvey as any);
    vi.mocked(prisma.response.groupBy).mockResolvedValue([{ surveyId, _count: { _all: 5 } }] as any);

    const survey = await getSurvey(surveyId);

    expect(survey).toEqual({
      id: prismaSurvey.id,
      createdAt: prismaSurvey.createdAt,
      updatedAt: prismaSurvey.updatedAt,
      name: prismaSurvey.name,
      type: prismaSurvey.type,
      creator: prismaSurvey.creator,
      status: prismaSurvey.status,
      singleUse: prismaSurvey.singleUse,
      workspaceId: prismaSurvey.workspaceId,
      responseCount: 5,
    });
    expect(survey).not.toHaveProperty("_count");
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

  test("should throw DatabaseError when response count lookup fails", async () => {
    const prismaError = makePrismaKnownError();
    vi.mocked(prisma.survey.findUnique).mockResolvedValue({ ...mockSurveyPrisma } as any);
    vi.mocked(prisma.response.groupBy).mockRejectedValue(prismaError);

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
    { ...mockSurveyPrisma, id: "s1", name: "Survey 1" },
    { ...mockSurveyPrisma, id: "s2", name: "Survey 2" },
  ];
  const expectedSurveys: TSurvey[] = mockPrismaSurveys.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    name: s.name,
    type: s.type,
    creator: s.creator,
    status: s.status,
    singleUse: s.singleUse,
    workspaceId: s.workspaceId,
    responseCount: s._count.responses,
  }));

  test("should return surveys with default parameters", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue(mockPrismaSurveys as any);
    vi.mocked(prisma.response.groupBy).mockResolvedValue([
      { surveyId: "s1", _count: { _all: 10 } },
      { surveyId: "s2", _count: { _all: 10 } },
    ] as any);
    const surveys = await getSurveys(workspaceId);

    expect(surveys).toEqual(expectedSurveys);
    expect(surveys[0]).not.toHaveProperty("_count");
    expect(prisma.survey.findMany).toHaveBeenCalledWith({
      where: { workspaceId, ...buildWhereClause() },
      select: surveySelect,
      orderBy: buildOrderByClause(),
      take: undefined,
      skip: undefined,
    });
  });

  test("should return surveys with limit and offset", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([mockPrismaSurveys[0]] as any);
    vi.mocked(prisma.response.groupBy).mockResolvedValue([{ surveyId: "s1", _count: { _all: 10 } }] as any);
    const surveys = await getSurveys(workspaceId, 1, 1);

    expect(surveys).toEqual([expectedSurveys[0]]);
    expect(prisma.survey.findMany).toHaveBeenCalledWith({
      where: { workspaceId, ...buildWhereClause() },
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
    vi.mocked(prisma.survey.findMany).mockResolvedValue(mockPrismaSurveys as any);
    vi.mocked(prisma.response.groupBy).mockResolvedValue([
      { surveyId: "s1", _count: { _all: 10 } },
      { surveyId: "s2", _count: { _all: 10 } },
    ] as any);

    const surveys = await getSurveys(workspaceId, undefined, undefined, filterCriteria);

    expect(surveys).toEqual(expectedSurveys);
    expect(buildWhereClause).toHaveBeenCalledWith(filterCriteria);
    expect(buildOrderByClause).toHaveBeenCalledWith("createdAt");
    expect(prisma.survey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId, AND: [{ name: { contains: "Test" } }] }, // Check with correct structure
        orderBy: [{ createdAt: "desc" }], // Check the mocked order by
      })
    );
  });

  test("should throw DatabaseError on Prisma error", async () => {
    const prismaError = makePrismaKnownError();
    vi.mocked(prisma.survey.findMany).mockRejectedValue(prismaError);
    await expect(getSurveys(workspaceId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith(prismaError, "Error getting surveys");
  });

  test("should rethrow unknown error", async () => {
    const unknownError = new Error("Unknown error");
    vi.mocked(prisma.survey.findMany).mockRejectedValue(unknownError);
    await expect(getSurveys(workspaceId)).rejects.toThrow(unknownError);
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
  };
  const mockOtherPrisma = {
    ...mockSurveyPrisma,
    id: "s_other",
    status: "completed" as any,
  };

  const expectedInProgressSurvey: TSurvey = {
    id: mockInProgressPrisma.id,
    createdAt: mockInProgressPrisma.createdAt,
    updatedAt: mockInProgressPrisma.updatedAt,
    name: mockInProgressPrisma.name,
    type: mockInProgressPrisma.type,
    creator: mockInProgressPrisma.creator,
    status: mockInProgressPrisma.status,
    singleUse: mockInProgressPrisma.singleUse,
    workspaceId: mockInProgressPrisma.workspaceId,
    responseCount: 3,
  };
  const expectedOtherSurvey: TSurvey = {
    id: mockOtherPrisma.id,
    createdAt: mockOtherPrisma.createdAt,
    updatedAt: mockOtherPrisma.updatedAt,
    name: mockOtherPrisma.name,
    type: mockOtherPrisma.type,
    creator: mockOtherPrisma.creator,
    status: mockOtherPrisma.status,
    singleUse: mockOtherPrisma.singleUse,
    workspaceId: mockOtherPrisma.workspaceId,
    responseCount: 5,
  };

  test("should fetch inProgress surveys first, then others if limit not met", async () => {
    vi.mocked(prisma.survey.count).mockResolvedValue(1); // 1 inProgress survey
    vi.mocked(prisma.survey.findMany)
      .mockResolvedValueOnce([mockInProgressPrisma] as any) // In-progress surveys
      .mockResolvedValueOnce([mockOtherPrisma] as any); // Additional surveys
    vi.mocked(prisma.response.groupBy).mockResolvedValue([
      { surveyId: "s_inprog", _count: { _all: 3 } },
      { surveyId: "s_other", _count: { _all: 5 } },
    ] as any);

    const surveys = await getSurveysSortedByRelevance(workspaceId, 2, 0);

    expect(surveys).toEqual([expectedInProgressSurvey, expectedOtherSurvey]);
    expect(surveys[0]).not.toHaveProperty("_count");
    expect(prisma.survey.count).toHaveBeenCalledWith({
      where: { workspaceId, status: "inProgress", ...buildWhereClause() },
    });
    expect(prisma.survey.findMany).toHaveBeenNthCalledWith(1, {
      where: { workspaceId, status: "inProgress", ...buildWhereClause() },
      select: surveySelect,
      orderBy: buildOrderByClause("updatedAt"),
      take: 2,
      skip: 0,
    });
    expect(prisma.survey.findMany).toHaveBeenNthCalledWith(2, {
      where: { workspaceId, status: { not: "inProgress" }, ...buildWhereClause() },
      select: surveySelect,
      orderBy: buildOrderByClause("updatedAt"),
      take: 1,
      skip: 0,
    });
  });

  test("should only fetch inProgress surveys if limit is met", async () => {
    vi.mocked(prisma.survey.count).mockResolvedValue(1);
    vi.mocked(prisma.survey.findMany).mockResolvedValueOnce([mockInProgressPrisma] as any);
    vi.mocked(prisma.response.groupBy).mockResolvedValue([
      { surveyId: "s_inprog", _count: { _all: 3 } },
    ] as any);

    const surveys = await getSurveysSortedByRelevance(workspaceId, 1, 0);
    expect(surveys).toEqual([expectedInProgressSurvey]);
    expect(prisma.survey.findMany).toHaveBeenCalledTimes(1);
  });

  test("should throw DatabaseError on Prisma error", async () => {
    const prismaError = makePrismaKnownError();
    vi.mocked(prisma.survey.count).mockRejectedValue(prismaError);
    await expect(getSurveysSortedByRelevance(workspaceId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith(prismaError, "Error getting surveys sorted by relevance");

    resetMocks(); // Reset for the next part of the test
    vi.mocked(prisma.survey.count).mockResolvedValue(0); // Make count succeed
    vi.mocked(prisma.survey.findMany).mockRejectedValue(prismaError); // Error on findMany
    await expect(getSurveysSortedByRelevance(workspaceId)).rejects.toThrow(DatabaseError);
  });

  test("should rethrow unknown error", async () => {
    const unknownError = new Error("Unknown error");
    vi.mocked(prisma.survey.count).mockRejectedValue(unknownError);
    await expect(getSurveysSortedByRelevance(workspaceId)).rejects.toThrow(unknownError);
  });
});

const mockExistingSurveyDetails = {
  name: "Original Survey",
  type: "web" as any,
  languages: [{ default: true, enabled: true, language: { code: "en", alias: "English" } }],
  welcomeCard: { enabled: true, headline: { default: "Welcome!" } },
  blocks: [
    {
      id: "block1",
      name: "Block 1",
      elements: [{ id: "q1", type: "openText", headline: { default: "Question 1" } }],
    },
  ],
  questions: [],
  endings: [{ type: "default", headline: { default: "Thanks!" } }],
  variables: [{ id: "var1", name: "Var One" }],
  hiddenFields: { enabled: true, fieldIds: ["hf1"] },
  surveyClosedMessage: { enabled: false },
  singleUse: { enabled: false },
  workspaceOverwrites: null,
  styling: { theme: {} },
  segment: null,
  followUps: [{ name: "Follow Up 1", trigger: {}, action: {} }],
  displayOption: "respondMultiple" as any,
  recontactDays: 7,
  displayLimit: 5,
  triggers: [
    {
      actionClass: {
        id: "ac1",
        name: "Code Action",
        workspaceId,
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
        workspaceId,
        description: "",
        type: "noCode" as TActionClassType,
        key: null,
        noCodeConfig: { type: "url" },
      },
    },
  ],
};

describe("copySurveyToOtherWorkspace", () => {
  const sourceWorkspaceId = "proj_source";
  const targetWorkspaceId = "proj_target";

  const mockSourceWorkspace: TWorkspaceWithLanguages = {
    id: sourceWorkspaceId,
    languages: [{ code: "en", alias: "English" }],
  };
  const mockTargetWorkspace: TWorkspaceWithLanguages = {
    id: targetWorkspaceId,
    languages: [{ code: "en", alias: "English" }],
  };

  const mockNewSurveyResult = {
    id: "new_cuid2_id",
    workspaceId: targetWorkspaceId,
    segment: null,
    triggers: [
      { actionClass: { id: "new_ac1", name: "Code Action", workspaceId: targetWorkspaceId } },
      { actionClass: { id: "new_ac2", name: "No-Code Action", workspaceId: targetWorkspaceId } },
    ],
    languages: [{ language: { code: "en" } }],
  };

  beforeEach(() => {
    resetMocks();
    vi.mocked(createId).mockReturnValue("new_cuid2_id");
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(mockExistingSurveyDetails as any);
    vi.mocked(doesWorkspaceExist).mockResolvedValue(sourceWorkspaceId);
    vi.mocked(getWorkspaceWithLanguages)
      .mockResolvedValueOnce(mockSourceWorkspace)
      .mockResolvedValueOnce(mockTargetWorkspace);
    vi.mocked(getIsQuotasEnabled).mockResolvedValue(true);
    vi.mocked(prisma.survey.create).mockResolvedValue(mockNewSurveyResult as any);
    vi.mocked(prisma.segment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.actionClass.findMany).mockResolvedValue([]);
    vi.mocked(prisma.surveyQuota.findMany).mockResolvedValue([]);
    vi.mocked(getQuotas).mockResolvedValue([]);
    vi.mocked(getOrganizationByWorkspaceId).mockResolvedValue({
      billing: {},
      id: "org_123",
    } as any);
  });

  test("should copy survey to a different workspace successfully", async () => {
    const newSurvey = await copySurveyToOtherWorkspace(
      sourceWorkspaceId,
      surveyId,
      targetWorkspaceId,
      userId
    );

    expect(newSurvey).toBeDefined();
    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: "new_cuid2_id",
          name: `${mockExistingSurveyDetails.name} (copy)`,
          workspace: { connect: { id: targetWorkspaceId } },
          creator: { connect: { id: userId } },
          status: "draft",
          triggers: {
            create: [
              expect.objectContaining({
                actionClass: {
                  connectOrCreate: {
                    where: {
                      key_workspaceId: { key: "code_action_key", workspaceId: targetWorkspaceId },
                    },
                    create: expect.objectContaining({ name: "Code Action", key: "code_action_key" }),
                  },
                },
              }),
              expect.objectContaining({
                actionClass: {
                  connectOrCreate: {
                    where: {
                      name_workspaceId: { name: "No-Code Action", workspaceId: targetWorkspaceId },
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
    expect(checkForInvalidMediaInBlocks).toHaveBeenCalledWith(mockExistingSurveyDetails.blocks);
  });

  test("should copy survey to the same workspace successfully", async () => {
    vi.mocked(getWorkspaceWithLanguages).mockReset();
    vi.mocked(getWorkspaceWithLanguages).mockResolvedValue(mockSourceWorkspace);

    await copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, sourceWorkspaceId, userId);

    expect(getWorkspaceWithLanguages).toHaveBeenCalledTimes(1);
    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspace: { connect: { id: sourceWorkspaceId } },
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

    await copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, targetWorkspaceId, userId);

    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          segment: {
            create: {
              title: "new_cuid2_id",
              isPrivate: true,
              filters: surveyWithPrivateSegment.segment.filters,
              workspace: { connect: { id: targetWorkspaceId } },
            },
          },
        }),
      })
    );
  });

  test("should handle public segment: connect if same workspace, create new if different workspace (no existing in target)", async () => {
    const surveyWithPublicSegment = {
      ...mockExistingSurveyDetails,
      segment: { id: "seg_public", title: "Public Segment", isPrivate: false, filters: [] },
    };
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(surveyWithPublicSegment as any);
    vi.mocked(getWorkspaceWithLanguages)
      .mockReset() // for same workspace part
      .mockResolvedValueOnce(mockSourceWorkspace);

    // Case 1: Same workspace
    await copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, sourceWorkspaceId, userId); // target is same
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
    vi.mocked(doesWorkspaceExist).mockResolvedValue(sourceWorkspaceId);
    vi.mocked(getWorkspaceWithLanguages)
      .mockResolvedValueOnce(mockSourceWorkspace)
      .mockResolvedValueOnce(mockTargetWorkspace);
    vi.mocked(prisma.survey.create).mockResolvedValue(mockNewSurveyResult as any);
    vi.mocked(prisma.segment.findFirst).mockResolvedValue(null); // No existing public segment with same title in target
    vi.mocked(prisma.actionClass.findMany).mockResolvedValue([]);
    vi.mocked(getQuotas).mockResolvedValue([]);
    vi.mocked(getIsQuotasEnabled).mockResolvedValue(true);
    vi.mocked(getOrganizationByWorkspaceId).mockResolvedValue({
      billing: {},
      id: "org_123",
    } as any);

    // Case 2: Different workspace, segment with same title does not exist in target
    await copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, targetWorkspaceId, userId);
    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          segment: {
            create: {
              title: "Public Segment",
              isPrivate: false,
              filters: [],
              workspace: { connect: { id: targetWorkspaceId } },
            },
          },
        }),
      })
    );
  });

  test("should handle public segment: create new with appended timestamp if different workspace and segment with same title exists in target", async () => {
    const surveyWithPublicSegment = {
      ...mockExistingSurveyDetails,
      segment: { id: "seg_public", title: "Public Segment", isPrivate: false, filters: [] },
    };
    resetMocks();
    vi.mocked(createId).mockReturnValue("new_cuid2_id");
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(surveyWithPublicSegment as any);
    vi.mocked(doesWorkspaceExist).mockResolvedValue(sourceWorkspaceId);
    vi.mocked(getWorkspaceWithLanguages)
      .mockResolvedValueOnce(mockSourceWorkspace)
      .mockResolvedValueOnce(mockTargetWorkspace);
    vi.mocked(prisma.survey.create).mockResolvedValue(mockNewSurveyResult as any);
    vi.mocked(prisma.segment.findFirst).mockResolvedValue({ id: "existing_target_seg" } as any); // Segment with same title EXISTS
    vi.mocked(prisma.actionClass.findMany).mockResolvedValue([]);
    vi.mocked(getQuotas).mockResolvedValue([]);
    vi.mocked(getIsQuotasEnabled).mockResolvedValue(true);
    vi.mocked(getOrganizationByWorkspaceId).mockResolvedValue({
      billing: {},
      id: "org_123",
    } as any);
    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(1234567890);

    await copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, targetWorkspaceId, userId);
    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          segment: {
            create: {
              title: `Public Segment-1234567890`,
              isPrivate: false,
              filters: [],
              workspace: { connect: { id: targetWorkspaceId } },
            },
          },
        }),
      })
    );
    dateNowSpy.mockRestore();
  });

  test("should throw ResourceNotFoundError if source workspace not found", async () => {
    vi.mocked(doesWorkspaceExist).mockResolvedValueOnce(null);
    await expect(
      copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, targetWorkspaceId, userId)
    ).rejects.toThrow(new ResourceNotFoundError("Workspace", sourceWorkspaceId));
  });

  test("should throw ResourceNotFoundError if source workspace with languages not found", async () => {
    vi.mocked(getWorkspaceWithLanguages).mockReset().mockResolvedValueOnce(null);
    await expect(
      copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, targetWorkspaceId, userId)
    ).rejects.toThrow(new ResourceNotFoundError("Workspace", sourceWorkspaceId));
  });

  test("should throw ResourceNotFoundError if existing survey not found", async () => {
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(null);
    await expect(
      copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, targetWorkspaceId, userId)
    ).rejects.toThrow(new ResourceNotFoundError("Survey", surveyId));
  });

  test("should throw ResourceNotFoundError if target workspace not found (different workspace copy)", async () => {
    vi.mocked(doesWorkspaceExist).mockResolvedValueOnce(sourceWorkspaceId).mockResolvedValueOnce(null);
    vi.mocked(getWorkspaceWithLanguages).mockReset();
    vi.mocked(getWorkspaceWithLanguages)
      .mockResolvedValueOnce(mockSourceWorkspace)
      .mockResolvedValueOnce(null);
    await expect(
      copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, targetWorkspaceId, userId)
    ).rejects.toThrow(new ResourceNotFoundError("Workspace", targetWorkspaceId));
  });

  test("should throw DatabaseError on Prisma create error", async () => {
    const prismaError = makePrismaKnownError();
    vi.mocked(prisma.survey.create).mockRejectedValue(prismaError);
    await expect(
      copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, targetWorkspaceId, userId)
    ).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith(prismaError, "Error copying survey to other workspace");
  });

  test("should rethrow unknown error during copy", async () => {
    const unknownError = new Error("Some unknown error during copy");
    vi.mocked(prisma.survey.create).mockRejectedValue(unknownError);
    await expect(
      copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, targetWorkspaceId, userId)
    ).rejects.toThrow(unknownError);
  });

  test("should handle survey with no languages", async () => {
    const surveyWithoutLanguages = { ...mockExistingSurveyDetails, languages: [] };
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(surveyWithoutLanguages as any);

    await copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, targetWorkspaceId, userId);
    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          languages: undefined,
        }),
      })
    );
  });

  test("should handle survey with no triggers", async () => {
    const surveyWithoutTriggers = { ...mockExistingSurveyDetails, triggers: [] };
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(surveyWithoutTriggers as any);

    await copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, targetWorkspaceId, userId);
    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          triggers: { create: [] },
        }),
      })
    );
  });

  test("should copy recontact options (displayOption, recontactDays, displayLimit)", async () => {
    await copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, targetWorkspaceId, userId);

    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          displayOption: "respondMultiple",
          recontactDays: 7,
          displayLimit: 5,
        }),
      })
    );
  });

  test("should copy recontact options with null values", async () => {
    const surveyWithNullRecontact = {
      ...mockExistingSurveyDetails,
      displayOption: "displayOnce" as any,
      recontactDays: null,
      displayLimit: null,
    };
    vi.mocked(prisma.survey.findUnique).mockResolvedValue(surveyWithNullRecontact as any);

    await copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, targetWorkspaceId, userId);

    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          displayOption: "displayOnce",
          recontactDays: null,
          displayLimit: null,
        }),
      })
    );
  });
});
