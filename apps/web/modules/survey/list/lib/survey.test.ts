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
import { buildWhereClause } from "@/modules/survey/lib/utils";
import { doesWorkspaceExist, getWorkspaceWithLanguages } from "@/modules/survey/list/lib/workspace";
import { TWorkspaceWithLanguages } from "../types/surveys";
// Import the module to be tested
import { copySurveyToOtherWorkspace, getSurveyCount, hasArchivedSurveys } from "./survey";

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
      findFirst: vi.fn(),
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
    actionClass: {
      findMany: vi.fn(),
    },
    surveyQuota: {
      findMany: vi.fn(),
    },
    organization: {
      findFirst: vi.fn(),
    },
    // Added for the Embedded Data reconcile the copy runs (ENG-1978)
    embeddedData: {
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    surveyEmbeddedData: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
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
  vi.mocked(buildWhereClause).mockClear();
  vi.mocked(doesWorkspaceExist).mockClear();
  vi.mocked(getWorkspaceWithLanguages).mockClear();
  vi.mocked(getOrganizationByWorkspaceId).mockClear();
  vi.mocked(createId).mockClear();
  vi.mocked(prisma.survey.findMany).mockReset();
  vi.mocked(prisma.survey.findUnique).mockReset();
  vi.mocked(prisma.survey.findFirst).mockReset();
  vi.mocked(prisma.survey.count).mockReset();
  vi.mocked(prisma.survey.delete).mockReset();
  vi.mocked(prisma.survey.create).mockReset();
  vi.mocked(prisma.segment.delete).mockReset();
  vi.mocked(prisma.segment.findFirst).mockReset();
  vi.mocked(prisma.actionClass.findMany).mockReset();
  vi.mocked(getQuotas).mockReset();
  vi.mocked(logger.error).mockClear();

  // copySurveyToOtherWorkspace wraps its writes in a transaction (ENG-1978) so the survey and its
  // Embedded Data rows land together. Reset first like every mock above — otherwise the call history
  // these tests assert on accumulates across tests — then run the callback against the same mocked
  // client, and start the copy with no existing links so the reconcile is a no-op unless a test says
  // otherwise.
  vi.mocked(prisma.$transaction).mockReset();
  vi.mocked(prisma.surveyEmbeddedData.findMany).mockReset();
  vi.mocked(prisma.surveyEmbeddedData.create).mockReset();
  vi.mocked(prisma.embeddedData.create).mockReset();

  vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(prisma));
  vi.mocked(prisma.surveyEmbeddedData.findMany).mockResolvedValue([]);
  vi.mocked(prisma.embeddedData.create).mockResolvedValue({ id: "ed_1" } as never);
  vi.mocked(prisma.surveyEmbeddedData.create).mockResolvedValue({} as never);
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
    // The copy carries the source survey's Embedded Data, which the reconcile re-creates for the new
    // survey (ENG-1978).
    variables: [{ id: "var_cuid", name: "score", type: "number", value: 0 }],
    hiddenFields: { enabled: true, fieldIds: ["plan"] },
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

  test("defines the copied survey's embedded data in the TARGET workspace, not the source", async () => {
    // The function's `workspaceId` argument is the source. Reading it instead of the created
    // survey's own workspace would define the fields in the wrong tenant — which the composite
    // foreign keys then reject, leaving the copy with no fields at all.
    await copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, targetWorkspaceId, userId);

    const workspaces = vi
      .mocked(prisma.embeddedData.create)
      .mock.calls.map(([args]) => (args as { data: { workspaceId: string } }).data.workspaceId);

    expect(workspaces).toHaveLength(2);
    expect(new Set(workspaces)).toEqual(new Set([targetWorkspaceId]));
  });

  test("re-creates the copied survey's variables and hidden fields under their original keys", async () => {
    await copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, targetWorkspaceId, userId);

    const links = vi
      .mocked(prisma.surveyEmbeddedData.create)
      .mock.calls.map(([args]) => (args as { data: { storageKey: string; order: number } }).data);

    // A variable keeps its cuid and a hidden field its name, so the copy's recall tokens — cloned
    // verbatim from the source — still resolve. The positions come across too, so the copy exports
    // its columns in the same order as the survey it was made from.
    expect(links.map(({ storageKey, order }) => [storageKey, order])).toEqual([
      ["var_cuid", 0],
      ["plan", 1],
    ]);
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

describe("hasArchivedSurveys", () => {
  const workspaceId = "clq5n7p1q0000m7z0h5p6g3r3";

  beforeEach(() => {
    resetMocks();
    vi.mocked(validateInputs).mockReturnValue([] as never);
  });

  test("returns true when the workspace has at least one archived survey", async () => {
    vi.mocked(prisma.survey.findFirst).mockResolvedValue({ id: "survey_1" } as never);

    await expect(hasArchivedSurveys(workspaceId)).resolves.toBe(true);
    expect(prisma.survey.findFirst).toHaveBeenCalledWith({
      where: { workspaceId, archivedAt: { not: null } },
      select: { id: true },
    });
  });

  test("returns false when the workspace has no archived surveys", async () => {
    vi.mocked(prisma.survey.findFirst).mockResolvedValue(null as never);

    await expect(hasArchivedSurveys(workspaceId)).resolves.toBe(false);
  });

  test("throws DatabaseError on a Prisma known request error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("db down", {
      code: "P2010",
      clientVersion: "4.0.0",
    });
    vi.mocked(prisma.survey.findFirst).mockRejectedValue(prismaError);

    await expect(hasArchivedSurveys(workspaceId)).rejects.toThrow(DatabaseError);
  });
});
