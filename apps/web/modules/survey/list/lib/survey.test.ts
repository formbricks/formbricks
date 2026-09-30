import { createId } from "@paralleldrive/cuid2";
import { cache as reactCache } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { TActionClassType } from "@formbricks/types/action-classes";
import { DatabaseError, OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { checkForInvalidMediaInBlocks } from "@/lib/survey/utils";
import { validateInputs } from "@/lib/utils/validate";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { getQuotas } from "@/modules/ee/quotas/lib/quotas";
import { buildWhereClause } from "@/modules/survey/lib/utils";
import { doesWorkspaceExist, getWorkspaceWithLanguages } from "@/modules/survey/list/lib/workspace";
import { TWorkspaceWithLanguages } from "../types/surveys";
// Import the module to be tested
import { copySurveyToOtherWorkspace, getSurveyCount, getWorkspaceSurveyCount } from "./survey";

const UNENFORCED_CONTEXT = {
  enforced: false,
  isOrganizationAdmin: false,
  kind: "user",
  userId: "user_1",
} as const;

// Survey visibility (ENG-3282) is not enforced here: the readiness marker is off, not read from a database.
vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: vi.fn(async () => false) }));
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

vi.mock("@/lib/authorization", () => ({
  can: vi.fn(),
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
  vi.mocked(can).mockReset();
  vi.mocked(can).mockResolvedValue(true);

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
    const count = await getSurveyCount(workspaceId, undefined, UNENFORCED_CONTEXT);
    expect(count).toBe(5);
    expect(prisma.survey.count).toHaveBeenCalledWith({
      where: { workspaceId, AND: [] },
    });
    expect(validateInputs).toHaveBeenCalledWith([workspaceId, expect.any(Object)]);
  });

  test("should throw DatabaseError on Prisma error", async () => {
    const prismaError = makePrismaKnownError();
    vi.mocked(prisma.survey.count).mockRejectedValue(prismaError);
    await expect(getSurveyCount(workspaceId, undefined, UNENFORCED_CONTEXT)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith(prismaError, "Error getting survey count");
  });

  test("should rethrow unknown error", async () => {
    const unknownError = new Error("Unknown error");
    vi.mocked(prisma.survey.count).mockRejectedValue(unknownError);
    await expect(getSurveyCount(workspaceId, undefined, UNENFORCED_CONTEXT)).rejects.toThrow(unknownError);
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

  // Resolve only what the query selects, the way Prisma does. Returning the whole survey regardless
  // of the `select` would let these tests pass even when a column is never read — which is the bug.
  const mockSourceSurvey = (columns: Record<string, unknown>) => {
    const sourceSurvey: Record<string, unknown> = { ...mockExistingSurveyDetails, ...columns };
    vi.mocked(prisma.survey.findUnique).mockImplementation((({ select }: { select: object }) =>
      Promise.resolve(
        Object.fromEntries(Object.keys(select).map((column) => [column, sourceSurvey[column]]))
      )) as never);
  };

  test("carries the source survey's behaviour and security settings onto the copy", async () => {
    const configuredSettings = {
      pin: "1234",
      autoComplete: 50,
      autoClose: 30,
      delay: 5,
      redirectUrl: "https://example.com/thanks",
      displayPercentage: 25,
      showLanguageSwitch: true,
      recaptcha: { enabled: true, threshold: 0.5 },
      isVerifyEmailEnabled: true,
      isAnonymizeResponsesEnabled: true,
      isCaptureIpEnabled: true,
      isBackButtonHidden: true,
      isAutoProgressingEnabled: true,
      metadata: { title: { default: "Shared title" } },
      customHeadScripts: "<script>analytics()</script>",
      customHeadScriptsMode: "replace",
      inlineTriggers: { codeConfig: { identifier: "inline" } },
    };
    mockSourceSurvey(configuredSettings);

    await copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, sourceWorkspaceId, userId);

    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining(configuredSettings) })
    );
  });

  test("does not carry the scheduling dates onto the copy", async () => {
    // The scheduler closes an `inProgress` survey whose `closeOn` has passed, so a copy that
    // inherited a past date would complete itself on the first tick after the user publishes it.
    mockSourceSurvey({ publishOn: new Date("2020-01-01"), closeOn: new Date("2020-02-01") });

    await copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, sourceWorkspaceId, userId);

    const { data } = vi.mocked(prisma.survey.create).mock.calls[0][0];
    expect(data).not.toHaveProperty("publishOn");
    expect(data).not.toHaveProperty("closeOn");
  });

  test("keeps head scripts on a copy to another workspace, but adds them to the target's own", async () => {
    // "replace" would switch off the target workspace's head scripts on the copy. A same-workspace
    // duplicate keeps "replace"; the settings test above covers that.
    mockSourceSurvey({ customHeadScripts: "<script>analytics()</script>", customHeadScriptsMode: "replace" });

    await copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, targetWorkspaceId, userId);

    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customHeadScripts: "<script>analytics()</script>",
          customHeadScriptsMode: "add",
        }),
      })
    );
  });

  test("refuses to carry head scripts into a workspace the user cannot manage", async () => {
    mockSourceSurvey({ customHeadScripts: "<script>analytics()</script>", customHeadScriptsMode: "add" });
    vi.mocked(can).mockResolvedValue(false);

    await expect(
      copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, targetWorkspaceId, userId)
    ).rejects.toThrow(OperationNotAllowedError);

    expect(can).toHaveBeenCalledWith({ type: "user", id: userId }, "workspace.manage", {
      type: "workspace",
      id: targetWorkspaceId,
    });
    expect(prisma.survey.create).not.toHaveBeenCalled();
  });

  test("duplicates a survey with head scripts in its own workspace without Manage access", async () => {
    // The scripts were already approved for this workspace, so a Read & write member can duplicate.
    vi.mocked(getWorkspaceWithLanguages).mockReset();
    vi.mocked(getWorkspaceWithLanguages).mockResolvedValue(mockSourceWorkspace);
    mockSourceSurvey({ customHeadScripts: "<script>analytics()</script>", customHeadScriptsMode: "add" });
    vi.mocked(can).mockResolvedValue(false);

    await copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, sourceWorkspaceId, userId);

    expect(can).not.toHaveBeenCalled();
    expect(prisma.survey.create).toHaveBeenCalled();
  });

  test("accounts for every Survey column, so a new one cannot be dropped silently", async () => {
    // The copy is built by spreading whatever `getExistingSurvey` selects, so a column that is
    // neither selected nor listed below is reset to its database default without anyone noticing.
    // That is the ENG-2144 bug, and #6802 before it. Adding a Survey column fails this test until
    // you decide which side it belongs on.
    const RESET_ON_COPY = new Set([
      // Identity and ownership: the copy is a new row in a workspace the caller chose.
      "id",
      "createdAt",
      "updatedAt",
      "workspaceId",
      "createdBy",
      // Not reset: the copy reconnects or recreates the segment through the `segment` relation.
      "segmentId",
      // Lifecycle: every copy starts as an unpublished, unarchived draft with its own link.
      "status",
      "archivedAt",
      "slug",
      "publishOn",
      "closeOn",
      // Visibility (ENG-3282): the copy gets its own creation facts — owned by the actor, restricted or
      // workspace-visible by who made it — never the source survey's owner, state or history.
      "visibility",
      "ownerId",
      "visibilityVersion",
      "visibilityProjectedVersion",
      "visibilityPending",
      "visibilityChangedAt",
      "visibilityChangedById",
    ]);

    await copySurveyToOtherWorkspace(sourceWorkspaceId, surveyId, sourceWorkspaceId, userId);

    const { select } = vi.mocked(prisma.survey.findUnique).mock.calls[0][0];
    const unaccounted = Object.keys(Prisma.SurveyScalarFieldEnum).filter(
      (column) => !(column in (select ?? {})) && !RESET_ON_COPY.has(column)
    );

    expect(unaccounted).toEqual([]);
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

describe("getWorkspaceSurveyCount", () => {
  const workspaceId = "clq5n7p1q0000m7z0h5p6g3r3";

  beforeEach(() => {
    resetMocks();
    vi.mocked(validateInputs).mockReturnValue([] as never);
  });

  test("counts archived surveys too, so an all-archived workspace is not empty", async () => {
    vi.mocked(prisma.survey.count).mockResolvedValue(3 as never);

    await expect(getWorkspaceSurveyCount(workspaceId, UNENFORCED_CONTEXT)).resolves.toBe(3);
    // No archivedAt narrowing: an archived survey still makes the workspace non-empty.
    expect(prisma.survey.count).toHaveBeenCalledWith({ where: { workspaceId, AND: [] } });
  });

  test("returns 0 when the workspace has no surveys at all", async () => {
    vi.mocked(prisma.survey.count).mockResolvedValue(0 as never);

    await expect(getWorkspaceSurveyCount(workspaceId, UNENFORCED_CONTEXT)).resolves.toBe(0);
  });

  test("throws DatabaseError on a Prisma known request error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("db down", {
      code: "P2010",
      clientVersion: "4.0.0",
    });
    vi.mocked(prisma.survey.count).mockRejectedValue(prismaError);

    await expect(getWorkspaceSurveyCount(workspaceId, UNENFORCED_CONTEXT)).rejects.toThrow(DatabaseError);
  });
});
