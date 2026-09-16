import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { PUBLIC_API_SURVEY_NAME_PLACEHOLDER } from "@formbricks/types/js-constants";
import { selectSurveyEmbeddedDataLinks } from "@/lib/embedded-data/survey-fields";
import { getWorkspaceStateData } from "./data";

vi.mock("server-only", () => ({}));

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
    },
    segment: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@/modules/storage/utils", () => ({
  resolveStorageUrlsInObject: vi.fn((obj) => obj),
}));

vi.mock("@/modules/survey/lib/utils", () => ({
  transformPrismaSurvey: vi.fn((survey) => survey),
}));

const workspaceId = "cjld2cjxh0000qzrmn831i7rn";

const mockWorkspaceData = {
  id: workspaceId,
  appSetupCompleted: true,
  recontactDays: 30,
  clickOutsideClose: true,
  overlay: "none",
  placement: "bottomRight",
  inAppSurveyBranding: true,
  styling: { allowStyleOverwrite: false },
  actionClasses: [
    {
      id: "action-1",
      type: "code",
      name: "Test Action",
      key: "test-action",
      noCodeConfig: null,
    },
  ],
  surveys: [
    {
      id: "survey-1",
      name: "Test Survey",
      type: "app",
      status: "inProgress",
      welcomeCard: { enabled: false },
      questions: [],
      blocks: null,
      variables: [],
      showLanguageSwitch: false,
      languages: [],
      endings: [],
      autoClose: null,
      styling: null,
      recaptcha: { enabled: false },
      segment: null,
      recontactDays: null,
      displayLimit: null,
      displayOption: "displayOnce",
      hiddenFields: { enabled: false },
      isBackButtonHidden: false,
      triggers: [],
      displayPercentage: null,
      delay: 0,
      workspaceOverwrites: null,
    },
  ],
};

describe("getWorkspaceStateData", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("should return environment state data when workspace exists", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(mockWorkspaceData as never);

    const result = await getWorkspaceStateData(workspaceId);

    expect(result).toEqual({
      workspace: {
        id: workspaceId,
        appSetupCompleted: true,
        workspaceSettings: {
          id: workspaceId,
          recontactDays: 30,
          clickOutsideClose: true,
          overlay: "none",
          placement: "bottomRight",
          inAppSurveyBranding: true,
          styling: { allowStyleOverwrite: false },
        },
      },
      // `survey.name` is replaced with a back-compat placeholder; segment was
      // null in the mock so the sanitized segment stays null.
      surveys: [
        {
          ...mockWorkspaceData.surveys[0],
          name: PUBLIC_API_SURVEY_NAME_PLACEHOLDER,
        },
      ],
      actionClasses: mockWorkspaceData.actionClasses,
    });

    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: workspaceId },
      select: expect.objectContaining({
        id: true,
        appSetupCompleted: true,
        recontactDays: true,
        actionClasses: expect.any(Object),
        surveys: expect.any(Object),
      }),
    });
  });

  /**
   * ENG-1845: this payload is the renderer's allow-list for app surveys. `getSurveyEmbeddedFields`
   * fails closed, so a select that loses the join is indistinguishable from a survey with no fields
   * — and every value passed through `setEmbeddedData` or `track({ hiddenFields })` would be silently
   * dropped instead of ingested. This is where that has to fail.
   */
  test("carries the Embedded Data join, which is the renderer's ingest allow-list", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(mockWorkspaceData as never);

    await getWorkspaceStateData(workspaceId);

    const [{ select }] = vi.mocked(prisma.workspace.findUnique).mock.calls[0] as [
      { select: { surveys: { select: Record<string, unknown> } } },
    ];
    expect(select.surveys.select.embeddedDataLinks).toEqual(selectSurveyEmbeddedDataLinks);
  });

  test("should throw ResourceNotFoundError when workspace is not found", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

    await expect(getWorkspaceStateData(workspaceId)).rejects.toThrow(ResourceNotFoundError);
    await expect(getWorkspaceStateData(workspaceId)).rejects.toThrow("workspace");
  });

  test("should throw DatabaseError on Prisma database errors", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Connection failed", {
      code: "P2024",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.workspace.findUnique).mockRejectedValue(prismaError);

    await expect(getWorkspaceStateData(workspaceId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalled();
  });

  test("should rethrow unexpected errors", async () => {
    const unexpectedError = new Error("Unexpected error");
    vi.mocked(prisma.workspace.findUnique).mockRejectedValue(unexpectedError);

    await expect(getWorkspaceStateData(workspaceId)).rejects.toThrow("Unexpected error");
    expect(logger.error).toHaveBeenCalled();
  });

  test("should handle empty surveys array", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      ...mockWorkspaceData,
      surveys: [],
    } as never);

    const result = await getWorkspaceStateData(workspaceId);

    expect(result.surveys).toEqual([]);
  });

  test("should handle empty actionClasses array", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      ...mockWorkspaceData,
      actionClasses: [],
    } as never);

    const result = await getWorkspaceStateData(workspaceId);

    expect(result.actionClasses).toEqual([]);
  });

  test("should transform surveys using transformPrismaSurvey", async () => {
    const multipleSurveys = [
      ...mockWorkspaceData.surveys,
      {
        ...mockWorkspaceData.surveys[0],
        id: "survey-2",
        name: "Second Survey",
      },
    ];

    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      ...mockWorkspaceData,
      surveys: multipleSurveys,
    } as never);

    const result = await getWorkspaceStateData(workspaceId);

    expect(result.surveys).toHaveLength(2);
  });

  test("should correctly map workspace properties to workspaceSettings", async () => {
    const customWorkspace = {
      ...mockWorkspaceData,
      recontactDays: 14,
      clickOutsideClose: false,
      overlay: "dark",
      placement: "center",
      inAppSurveyBranding: false,
      styling: { allowStyleOverwrite: true, brandColor: "#ff0000" },
    };

    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(customWorkspace as never);

    const result = await getWorkspaceStateData(workspaceId);

    expect(result.workspace.workspaceSettings).toEqual({
      id: workspaceId,
      recontactDays: 14,
      clickOutsideClose: false,
      overlay: "dark",
      placement: "center",
      inAppSurveyBranding: false,
      styling: { allowStyleOverwrite: true, brandColor: "#ff0000" },
    });
  });

  test("should validate workspaceId input", async () => {
    // Invalid CUID should throw validation error
    await expect(getWorkspaceStateData("invalid-id")).rejects.toThrow();
  });

  test("should handle appSetupCompleted false", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      ...mockWorkspaceData,
      appSetupCompleted: false,
    } as never);

    const result = await getWorkspaceStateData(workspaceId);

    expect(result.workspace.appSetupCompleted).toBe(false);
  });

  test("should not include organization in result", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(mockWorkspaceData as never);

    const result = await getWorkspaceStateData(workspaceId);

    expect(result).not.toHaveProperty("organization");
  });

  // ENG-1067 back-compat: SDK clients match the display language by exact code, so alongside each
  // canonical region-tagged code we expose its bare legacy code for multi-language surveys.
  const buildLanguage = (code: string, isDefault = false) => ({
    default: isDefault,
    enabled: true,
    language: {
      id: `lang-${code}`,
      code,
      alias: null,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
      workspaceId,
    },
  });

  test("appends bare legacy language codes for multi-language surveys", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      ...mockWorkspaceData,
      surveys: [
        {
          ...mockWorkspaceData.surveys[0],
          languages: [buildLanguage("en-US", true), buildLanguage("de-DE")],
        },
      ],
    } as never);

    const result = await getWorkspaceStateData(workspaceId);
    const codes = result.surveys[0].languages.map((sl) => sl.language.code);

    // canonical entries stay first; bare legacy entries are appended
    expect(codes).toEqual(["en-US", "de-DE", "en", "de"]);
  });

  test("does not append legacy codes for single-language surveys", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      ...mockWorkspaceData,
      surveys: [{ ...mockWorkspaceData.surveys[0], languages: [buildLanguage("en-US", true)] }],
    } as never);

    const result = await getWorkspaceStateData(workspaceId);
    const codes = result.surveys[0].languages.map((sl) => sl.language.code);

    expect(codes).toEqual(["en-US"]);
  });

  test("does not duplicate a bare code that a real language already uses", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      ...mockWorkspaceData,
      surveys: [
        {
          ...mockWorkspaceData.surveys[0],
          languages: [buildLanguage("en-US", true), buildLanguage("de-DE"), buildLanguage("de")],
        },
      ],
    } as never);

    const result = await getWorkspaceStateData(workspaceId);
    const codes = result.surveys[0].languages.map((sl) => sl.language.code);

    // "de" already present → only "en" gets appended
    expect(codes).toEqual(["en-US", "de-DE", "de", "en"]);
  });

  test("appends real legacy aliases (not a region-strip) for alias-mapped codes", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      ...mockWorkspaceData,
      surveys: [
        {
          ...mockWorkspaceData.surveys[0],
          // fil-PH's legacy alias is "tl" (not "fil"); ak-GH has two aliases ("ak", "tw")
          languages: [buildLanguage("en-US", true), buildLanguage("fil-PH"), buildLanguage("ak-GH")],
        },
      ],
    } as never);

    const result = await getWorkspaceStateData(workspaceId);
    const codes = result.surveys[0].languages.map((sl) => sl.language.code);

    expect(codes).toEqual(["en-US", "fil-PH", "ak-GH", "en", "tl", "ak", "tw"]);
  });

  // Survey-interaction segment gate: per-survey `interactionRefresh`.
  const interactionSurvey = (id: string, operator: string, targetSurveyId: string) => ({
    ...mockWorkspaceData.surveys[0],
    id,
    segment: {
      id: `seg-${id}`,
      filters: [
        {
          id: "f1",
          connector: null,
          resource: {
            id: "r1",
            root: { type: "surveyInteraction" },
            qualifier: { operator },
            value: {
              surveyScope: "specific",
              surveyIds: [targetSurveyId],
              within: { amount: 1, unit: "months" },
            },
          },
        },
      ],
    },
  });

  test("attaches per-survey interactionRefresh for an interaction filter", async () => {
    // survey-B references survey-A via "have seen" → A gets onDisplay only; B (referenced by nobody) all-false.
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      ...mockWorkspaceData,
      surveys: [
        { ...mockWorkspaceData.surveys[0], id: "survey-A", segment: null },
        interactionSurvey("survey-B", "haveSeen", "survey-A"),
      ],
    } as never);
    vi.mocked(prisma.segment.findMany).mockResolvedValue([] as never);

    const result = await getWorkspaceStateData(workspaceId);

    const byId = Object.fromEntries(result.surveys.map((s) => [s.id, s]));
    expect((byId["survey-A"] as { interactionRefresh?: unknown }).interactionRefresh).toEqual({
      onDisplay: true,
      onResponse: false,
      onFinished: false,
    });
    expect((byId["survey-B"] as { interactionRefresh?: unknown }).interactionRefresh).toEqual({
      onDisplay: false,
      onResponse: false,
      onFinished: false,
    });
  });

  test("resolves an interaction filter hidden inside a nested userIsIn segment", async () => {
    // survey-A's segment only references segment "seg-nested" (userIsIn); that segment holds the
    // "have completed survey-A" interaction leaf, so A must still be flagged onFinished.
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      ...mockWorkspaceData,
      surveys: [
        {
          ...mockWorkspaceData.surveys[0],
          id: "survey-A",
          segment: {
            id: "seg-a",
            filters: [
              {
                id: "f1",
                connector: null,
                resource: {
                  id: "r1",
                  root: { type: "segment", segmentId: "seg-nested" },
                  qualifier: { operator: "userIsIn" },
                  value: "seg-nested",
                },
              },
            ],
          },
        },
      ],
    } as never);
    vi.mocked(prisma.segment.findMany).mockResolvedValue([
      {
        id: "seg-nested",
        filters: [
          {
            id: "f2",
            connector: null,
            resource: {
              id: "r2",
              root: { type: "surveyInteraction" },
              qualifier: { operator: "haveCompleted" },
              value: {
                surveyScope: "specific",
                surveyIds: ["survey-A"],
                within: { amount: 1, unit: "months" },
              },
            },
          },
        ],
      },
    ] as never);

    const result = await getWorkspaceStateData(workspaceId);

    expect((result.surveys[0] as { interactionRefresh?: unknown }).interactionRefresh).toEqual({
      onDisplay: false,
      onResponse: false,
      onFinished: true,
    });
    expect(prisma.segment.findMany).toHaveBeenCalledWith({
      where: { workspaceId },
      select: { id: true, filters: true },
    });
  });

  test("distinguishes Simplified and Traditional Chinese (script preserved, not a bare 'zh')", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      ...mockWorkspaceData,
      surveys: [
        {
          ...mockWorkspaceData.surveys[0],
          languages: [buildLanguage("en-US", true), buildLanguage("zh-Hans-CN"), buildLanguage("zh-Hant-TW")],
        },
      ],
    } as never);

    const result = await getWorkspaceStateData(workspaceId);
    const codes = result.surveys[0].languages.map((sl) => sl.language.code);

    // Each script keeps its own legacy aliases, so a deployed Chinese client matches whichever code it
    // holds: Simplified -> zh / zh-CN / zh-Hans, Traditional -> zh-Hant / zh-TW. A region-strip would have
    // emitted a single bare "zh" for both — which no Chinese client holds and can't tell the two apart.
    expect(codes).toEqual([
      "en-US",
      "zh-Hans-CN",
      "zh-Hant-TW",
      "en",
      "zh",
      "zh-CN",
      "zh-Hans",
      "zh-Hant",
      "zh-TW",
    ]);
  });
});

/**
 * ENG-1838. Already-deployed SDK bundles on customer sites read `survey.variables` and
 * `survey.hiddenFields.fieldIds` straight off this payload, and we do not control when a customer
 * upgrades their embed. The Embedded Data work added `embeddedDataLinks` *alongside* those keys
 * rather than replacing them, and ENG-2404 will eventually drop the columns they come from.
 *
 * When that happens this test fails, and whoever drops the columns has to derive the two keys from
 * the EmbeddedData rows instead. That failure is the whole point of the test — without it the
 * payload would quietly stop carrying them and every old bundle in the wild would break silently.
 */
describe("legacy Embedded Data shape on the wire (ENG-1838)", () => {
  const surveyWithFields = {
    ...mockWorkspaceData.surveys[0],
    variables: [{ id: "clx000000000000000000001", name: "score", type: "number", value: 7 }],
    hiddenFields: { enabled: true, fieldIds: ["utm_source", "plan"] },
  };

  test("the workspace-state payload still carries variables and hiddenFields", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      ...mockWorkspaceData,
      surveys: [surveyWithFields],
    } as never);

    const [survey] = (await getWorkspaceStateData(workspaceId)).surveys;

    expect(survey.variables).toEqual(surveyWithFields.variables);
    expect(survey.hiddenFields).toEqual(surveyWithFields.hiddenFields);
  });

  test("the query asks for both columns, so removing them from the select fails here", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(mockWorkspaceData as never);

    await getWorkspaceStateData(workspaceId);

    const [call] = vi.mocked(prisma.workspace.findUnique).mock.calls;
    const surveySelect = (call[0] as { select: { surveys: { select: Record<string, unknown> } } }).select
      .surveys.select;

    expect(surveySelect.variables).toBe(true);
    expect(surveySelect.hiddenFields).toBe(true);
  });
});
