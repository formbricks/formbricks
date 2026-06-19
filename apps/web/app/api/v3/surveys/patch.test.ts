import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getActionClasses } from "@/lib/actionClass/service";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import {
  isSurveySchedulingDue,
  normalizeSurveyScheduling,
  reconcileDueSurveySchedules,
} from "@/modules/survey/scheduling/lib/survey-scheduling";
import { executeV3SurveyPatch, patchV3Survey } from "./patch";
import { V3SurveyReferenceValidationError } from "./reference-validation";
import { ZV3CreateSurveyBody } from "./schemas";
import {
  areV3SurveyTargetingFiltersEqual,
  resolveV3ContactsEntitlement,
  setV3SurveySegmentFilters,
} from "./targeting";
import { V3SurveyWritePermissionError } from "./write-permissions";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => {
  const prisma = {
    language: {
      upsert: vi.fn(),
    },
    survey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    segment: {
      update: vi.fn(),
    },
    // Interactive transaction: run the callback with the mocked client as the tx client.
    $transaction: vi.fn((callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma)),
  };
  return { prisma };
});

vi.mock("@/lib/survey/service", () => ({
  selectSurvey: {
    id: true,
  },
}));

vi.mock("@/lib/actionClass/service", () => ({
  getActionClasses: vi.fn(),
}));

vi.mock("./targeting", () => ({
  setV3SurveySegmentFilters: vi.fn(),
  areV3SurveyTargetingFiltersEqual: vi.fn(),
  resolveV3ContactsEntitlement: vi.fn(),
  V3_CONTACTS_NOT_ENABLED_MESSAGE: "Contact targeting is not enabled.",
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationByWorkspaceId: vi.fn(),
}));

vi.mock("@/modules/survey/lib/permission", () => ({
  getExternalUrlsPermission: vi.fn(),
}));

vi.mock("@/modules/survey/scheduling/lib/survey-scheduling", () => ({
  isSurveySchedulingDue: vi.fn(),
  normalizeSurveyScheduling: vi.fn(),
  reconcileDueSurveySchedules: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

const workspaceId = "clxx1234567890123456789012";

const createBody = ZV3CreateSurveyBody.parse({
  workspaceId,
  name: "Product Feedback",
  defaultLanguage: "en-US",
  metadata: {
    title: { "en-US": "Product Feedback" },
  },
  blocks: [
    {
      id: "clbk1234567890123456789012",
      name: "Main Block",
      elements: [
        {
          id: "satisfaction",
          type: "openText",
          headline: { "en-US": "What should we improve?" },
          required: true,
        },
      ],
    },
  ],
});

const currentSurvey = {
  id: "clsv1234567890123456789012",
  workspaceId,
  createdAt: new Date("2026-04-21T10:00:00.000Z"),
  updatedAt: new Date("2026-04-21T10:00:00.000Z"),
  name: "Product Feedback",
  type: "link",
  createdBy: "user_1",
  status: "draft",
  displayOption: "displayOnce",
  autoClose: null,
  triggers: [],
  recontactDays: null,
  displayLimit: null,
  questions: [],
  welcomeCard: { enabled: false },
  blocks: createBody.blocks,
  endings: [],
  hiddenFields: { enabled: false },
  variables: [],
  followUps: [],
  delay: 0,
  publishOn: null,
  closeOn: null,
  autoComplete: null,
  workspaceOverwrites: null,
  styling: null,
  showLanguageSwitch: null,
  surveyClosedMessage: null,
  segment: null,
  singleUse: null,
  isVerifyEmailEnabled: false,
  recaptcha: null,
  isSingleResponsePerEmailEnabled: false,
  isBackButtonHidden: false,
  isAutoProgressingEnabled: false,
  isCaptureIpEnabled: false,
  pin: null,
  displayPercentage: null,
  languages: [
    {
      language: {
        id: "cllangenus000000000000000",
        code: "en-US",
        alias: null,
        workspaceId,
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:00:00.000Z"),
      },
      default: true,
      enabled: true,
    },
  ],
  metadata: createBody.metadata,
  slug: null,
  customHeadScripts: null,
  customHeadScriptsMode: null,
} as unknown as TSurvey;

const createExternalCtaBlock = () => ({
  ...createBody.blocks[0],
  elements: [
    {
      id: "external_cta",
      type: "cta" as const,
      headline: { "en-US": "Continue" },
      required: false,
      buttonExternal: true,
      buttonUrl: "https://example.com",
      ctaButtonLabel: { "en-US": "Open" },
    },
  ],
});

type TLanguageUpsertArgs = Parameters<typeof prisma.language.upsert>[0];
type TLanguageUpsertReturn = ReturnType<typeof prisma.language.upsert>;
type TSurveyUpdateArgs = Parameters<typeof prisma.survey.update>[0];
type TSurveyUpdateReturn = ReturnType<typeof prisma.survey.update>;

describe("patchV3Survey", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.language.upsert).mockImplementation(
      (args: TLanguageUpsertArgs): TLanguageUpsertReturn => {
        const workspaceIdCode = args.where.workspaceId_code;
        if (!workspaceIdCode) {
          throw new Error("Expected workspaceId_code upsert selector");
        }

        return Promise.resolve({
          id:
            workspaceIdCode.code === "en-US"
              ? "cllangenus000000000000000"
              : `cllang${workspaceIdCode.code.toLowerCase().replaceAll("-", "")}`,
          code: workspaceIdCode.code,
          alias: null,
          workspaceId: workspaceIdCode.workspaceId,
          createdAt: new Date("2026-04-21T10:00:00.000Z"),
          updatedAt: new Date("2026-04-21T10:00:00.000Z"),
        }) as TLanguageUpsertReturn;
      }
    );
    vi.mocked(prisma.survey.update).mockImplementation((args: TSurveyUpdateArgs): TSurveyUpdateReturn => {
      const data = args.data;

      return Promise.resolve({
        ...currentSurvey,
        name: data.name ?? currentSurvey.name,
        status: data.status ?? currentSurvey.status,
        metadata: data.metadata ?? currentSurvey.metadata,
        welcomeCard: data.welcomeCard ?? currentSurvey.welcomeCard,
        blocks: data.blocks ?? currentSurvey.blocks,
        endings: data.endings ?? currentSurvey.endings,
        hiddenFields: data.hiddenFields ?? currentSurvey.hiddenFields,
        variables: data.variables ?? currentSurvey.variables,
        closeOn: data.closeOn ?? currentSurvey.closeOn,
        publishOn: data.publishOn ?? currentSurvey.publishOn,
      }) as unknown as TSurveyUpdateReturn;
    });
    vi.mocked(prisma.$transaction).mockImplementation(((callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback(prisma)) as typeof prisma.$transaction);
    vi.mocked(normalizeSurveyScheduling).mockImplementation(({ closeOn, publishOn }) => ({
      closeOn,
      publishOn,
    }));
    vi.mocked(isSurveySchedulingDue).mockReturnValue(false);
    vi.mocked(reconcileDueSurveySchedules).mockResolvedValue({
      closedCount: 0,
      publishedCount: 0,
      surveyUpdated: false,
    });
    vi.mocked(getOrganizationByWorkspaceId).mockResolvedValue({
      id: "org_1",
      name: "Organization",
      createdAt: new Date(),
      updatedAt: new Date(),
      billing: {
        limits: { monthly: { responses: 1000 }, workspaces: 1 },
        stripeCustomerId: null,
        usageCycleAnchor: null,
      },
      isAISmartToolsEnabled: false,
      whitelabel: undefined,
    });
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(true);
    vi.mocked(getActionClasses).mockResolvedValue([]);
    vi.mocked(resolveV3ContactsEntitlement).mockResolvedValue({
      resolvedOrganizationId: "org_1",
      isContactsEnabled: true,
    });
    vi.mocked(areV3SurveyTargetingFiltersEqual).mockReturnValue(true);
  });

  test("patches a name-only payload through v3 persistence", async () => {
    await patchV3Survey(
      currentSurvey,
      { name: "Start from scratch (MCP QA test renamed)" },
      "req_qa",
      "org_1"
    );

    expect(prisma.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: currentSurvey.id },
        data: expect.objectContaining({
          name: "Start from scratch (MCP QA test renamed)",
          metadata: currentSurvey.metadata,
          hiddenFields: currentSurvey.hiddenFields,
        }),
      })
    );
  });

  test("patches metadata and hidden fields through v3 persistence", async () => {
    await patchV3Survey(
      currentSurvey,
      {
        metadata: {
          title: { "en-US": "MCP QA title" },
        },
        hiddenFields: { enabled: true, fieldIds: ["utm_source"] },
      },
      "req_qa",
      "org_1"
    );

    expect(prisma.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: {
            title: { default: "MCP QA title" },
          },
          hiddenFields: { enabled: true, fieldIds: ["utm_source"] },
        }),
      })
    );
  });

  test("maps the prepared v3 patch onto the existing internal survey", async () => {
    await patchV3Survey(
      currentSurvey,
      {
        name: "Updated Feedback",
        metadata: {
          title: { "en-US": "Updated Feedback", "de-DE": "Aktualisiertes Feedback" },
        },
        languages: [{ code: "de-DE", enabled: true }],
        blocks: [
          {
            ...createBody.blocks[0],
            elements: [
              {
                ...createBody.blocks[0].elements[0],
                headline: {
                  "en-US": "What should we improve?",
                  "de-DE": "Was sollen wir verbessern?",
                },
              },
            ],
          },
        ],
      },
      "req_1",
      "org_1"
    );

    expect(prisma.language.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId_code: { workspaceId, code: "de-DE" } },
        create: { workspaceId, code: "de-DE", alias: null },
      })
    );
    expect(prisma.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: currentSurvey.id },
        data: expect.objectContaining({
          name: "Updated Feedback",
          metadata: {
            title: { default: "Updated Feedback", "de-DE": "Aktualisiertes Feedback" },
          },
          blocks: [
            expect.objectContaining({
              elements: [
                expect.objectContaining({
                  headline: { default: "What should we improve?", "de-DE": "Was sollen wir verbessern?" },
                }),
              ],
            }),
          ],
          languages: expect.objectContaining({
            create: [
              expect.objectContaining({
                default: false,
                enabled: true,
                languageId: "cllangdede",
              }),
            ],
            updateMany: expect.arrayContaining([
              expect.objectContaining({
                data: { default: true, enabled: true },
              }),
            ]),
          }),
        }),
      })
    );
    expect(getExternalUrlsPermission).not.toHaveBeenCalled();
  });

  test("removes languages that are no longer present in the v3 survey document", async () => {
    const currentSurveyWithGerman = {
      ...currentSurvey,
      languages: [
        ...currentSurvey.languages,
        {
          language: {
            id: "cllangdede",
            code: "de-DE",
            alias: null,
            workspaceId,
            createdAt: new Date("2026-04-21T10:00:00.000Z"),
            updatedAt: new Date("2026-04-21T10:00:00.000Z"),
          },
          default: false,
          enabled: true,
        },
      ],
    } as TSurvey;

    await executeV3SurveyPatch({
      currentSurvey: currentSurveyWithGerman,
      document: {
        name: currentSurvey.name,
        status: currentSurvey.status,
        metadata: currentSurvey.metadata,
        defaultLanguage: "en-US",
        languages: [{ code: "en-US", enabled: true }],
        welcomeCard: currentSurvey.welcomeCard,
        blocks: currentSurvey.blocks,
        endings: currentSurvey.endings,
        hiddenFields: currentSurvey.hiddenFields,
        variables: currentSurvey.variables,
      },
      languageRequests: [{ code: "en-US", default: true, enabled: true }],
      requestId: "req_1",
    });

    expect(prisma.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          languages: expect.objectContaining({
            deleteMany: [{ languageId: "cllangdede" }],
          }),
        }),
      })
    );
  });

  test("reconciles due survey schedules without refetching when no schedule transition persisted", async () => {
    vi.mocked(isSurveySchedulingDue).mockReturnValue(true);
    vi.mocked(reconcileDueSurveySchedules).mockResolvedValue({
      closedCount: 0,
      publishedCount: 0,
      surveyUpdated: false,
    });

    const result = await patchV3Survey(currentSurvey, { name: "Updated Feedback" }, "req_1", "org_1");

    expect(reconcileDueSurveySchedules).toHaveBeenCalledWith({
      logContext: {
        source: "v3-survey-patch",
        surveyId: currentSurvey.id,
        workspaceId,
      },
      surveyId: currentSurvey.id,
    });
    expect(prisma.survey.findUnique).not.toHaveBeenCalled();
    expect(result.name).toBe("Updated Feedback");
  });

  test("returns the refetched survey when schedule reconciliation persists a transition", async () => {
    vi.mocked(isSurveySchedulingDue).mockReturnValue(true);
    vi.mocked(reconcileDueSurveySchedules).mockResolvedValue({
      closedCount: 0,
      publishedCount: 1,
      surveyUpdated: true,
    });
    vi.mocked(prisma.survey.findUnique).mockResolvedValueOnce({
      ...currentSurvey,
      name: "Published Feedback",
      status: "inProgress",
    } as unknown as Awaited<ReturnType<typeof prisma.survey.findUnique>>);

    const result = await patchV3Survey(currentSurvey, { name: "Updated Feedback" }, "req_1", "org_1");

    expect(prisma.survey.findUnique).toHaveBeenCalledWith({
      where: { id: currentSurvey.id },
      select: { id: true },
    });
    expect(result.name).toBe("Published Feedback");
    expect(result.status).toBe("inProgress");
  });

  test("throws not found when schedule reconciliation updates a survey that cannot be refetched", async () => {
    vi.mocked(isSurveySchedulingDue).mockReturnValue(true);
    vi.mocked(reconcileDueSurveySchedules).mockResolvedValue({
      closedCount: 1,
      publishedCount: 0,
      surveyUpdated: true,
    });
    vi.mocked(prisma.survey.findUnique).mockResolvedValueOnce(null);

    await expect(
      patchV3Survey(currentSurvey, { name: "Updated Feedback" }, "req_1", "org_1")
    ).rejects.toThrow(ResourceNotFoundError);
  });

  test("maps Prisma persistence errors to database errors", async () => {
    vi.mocked(prisma.survey.update).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Survey update failed", {
        code: "P2025",
        clientVersion: "test",
      })
    );

    await expect(
      patchV3Survey(currentSurvey, { name: "Updated Feedback" }, "req_1", "org_1")
    ).rejects.toThrow(DatabaseError);
  });

  test("rethrows unknown persistence errors", async () => {
    const unknownError = new Error("unexpected persistence failure");
    vi.mocked(prisma.survey.update).mockRejectedValueOnce(unknownError);

    await expect(patchV3Survey(currentSurvey, { name: "Updated Feedback" }, "req_1", "org_1")).rejects.toBe(
      unknownError
    );
  });

  test("rejects invalid media URLs before updating the survey", async () => {
    await expect(
      patchV3Survey(
        currentSurvey,
        {
          blocks: [
            {
              id: "clbk1234567890123456789012",
              name: "Main Block",
              elements: [
                {
                  id: "satisfaction",
                  type: "openText",
                  headline: { "en-US": "What should we improve?" },
                  required: true,
                  videoUrl: "https://evil.example.com/not-a-video",
                },
              ],
            },
          ],
        },
        "req_media",
        "org_1"
      )
    ).rejects.toThrow(V3SurveyReferenceValidationError);

    expect(prisma.survey.update).not.toHaveBeenCalled();
  });

  test("rejects invalid patch documents before updating", async () => {
    await expect(
      patchV3Survey(currentSurvey, {
        defaultLanguage: "de-DE",
      })
    ).rejects.toThrow(V3SurveyReferenceValidationError);

    expect(prisma.survey.update).not.toHaveBeenCalled();
  });

  test("allows patching unrelated fields when existing external URLs are unchanged", async () => {
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);
    const externalUrlBody = ZV3CreateSurveyBody.parse({
      workspaceId,
      name: "Product Feedback",
      defaultLanguage: "en-US",
      blocks: [createExternalCtaBlock()],
      endings: [
        {
          id: "clen1234567890123456789012",
          type: "endScreen",
          headline: { "en-US": "Thanks" },
          buttonLabel: { "en-US": "Open" },
          buttonLink: "https://example.com",
        },
      ],
    });
    const currentSurveyWithExternalUrls = {
      ...currentSurvey,
      blocks: externalUrlBody.blocks,
      endings: externalUrlBody.endings,
    } as TSurvey;

    await patchV3Survey(currentSurveyWithExternalUrls, { name: "Renamed Feedback" }, "req_2", "org_1");

    expect(getExternalUrlsPermission).not.toHaveBeenCalled();
    expect(prisma.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Renamed Feedback",
          blocks: externalUrlBody.blocks,
          endings: externalUrlBody.endings,
        }),
      })
    );
  });

  test("reuses external URL permission checks for patched survey documents", async () => {
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);

    await expect(
      patchV3Survey(
        currentSurvey,
        {
          blocks: [createExternalCtaBlock()],
        },
        "req_2",
        "org_1"
      )
    ).rejects.toThrow(V3SurveyWritePermissionError);

    expect(prisma.survey.update).not.toHaveBeenCalled();
  });

  test("reuses external URL permission checks for patched redirect endings", async () => {
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);

    await expect(
      patchV3Survey(
        currentSurvey,
        {
          endings: [
            {
              id: "clen1234567890123456789012",
              type: "redirectToUrl",
              url: "https://example.com/next",
            },
          ],
        },
        "req_2",
        "org_1"
      )
    ).rejects.toThrow(V3SurveyWritePermissionError);

    expect(prisma.survey.update).not.toHaveBeenCalled();
  });

  test("fails closed when external URL permissions cannot resolve an organization", async () => {
    vi.mocked(getOrganizationByWorkspaceId).mockResolvedValue(null);

    await expect(
      patchV3Survey(
        currentSurvey,
        {
          blocks: [createExternalCtaBlock()],
        },
        "req_2"
      )
    ).rejects.toThrow(`Unable to verify external URL permissions for workspaceId: ${workspaceId}`);

    expect(getExternalUrlsPermission).not.toHaveBeenCalled();
    expect(prisma.survey.update).not.toHaveBeenCalled();
  });

  describe("app surveys", () => {
    const actionClass = {
      id: "claa1234567890123456789012",
      name: "Checkout Complete",
      description: null,
      type: "code" as const,
      key: "checkout_complete",
      noCodeConfig: null,
      workspaceId,
      createdAt: new Date("2026-04-21T10:00:00.000Z"),
      updatedAt: new Date("2026-04-21T10:00:00.000Z"),
    };

    const appCurrentSurvey = {
      ...currentSurvey,
      type: "app",
      recontactDays: 7,
      triggers: [],
      segment: { id: "clsg1234567890123456789012", filters: [] },
    } as unknown as TSurvey;

    const attributeFilters = [
      {
        id: "clf01234567890123456789012",
        connector: null,
        resource: {
          id: "clf11234567890123456789012",
          root: { type: "attribute", contactAttributeKey: "plan" },
          qualifier: { operator: "equals" },
          value: "pro",
        },
      },
    ];

    test("writes distribution scalars and the trigger diff", async () => {
      vi.mocked(getActionClasses).mockResolvedValue([actionClass]);

      await patchV3Survey(
        appCurrentSurvey,
        {
          distribution: {
            displayOption: "displayMultiple",
            recontactDays: 14,
            triggers: [{ actionClassId: actionClass.id }],
          },
        },
        "req_app_patch_1",
        "org_1"
      );

      expect(prisma.survey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            displayOption: "displayMultiple",
            recontactDays: 14,
            triggers: { create: [{ actionClassId: actionClass.id }] },
          }),
        })
      );
    });

    test("preserves omitted app fields under replacement merge", async () => {
      await patchV3Survey(appCurrentSurvey, { name: "Renamed" }, "req_app_patch_2", "org_1");

      expect(prisma.survey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Renamed",
            recontactDays: 7,
            displayOption: "displayOnce",
          }),
        })
      );
    });

    test("updates segment filters when targeting changes and contacts are enabled", async () => {
      vi.mocked(areV3SurveyTargetingFiltersEqual).mockReturnValue(false);
      // Run the interactive transaction with a DISTINCT tx client so the assertions prove both writes
      // go through it (not the global prisma) — i.e. that the update really is transactional.
      const tx = {
        survey: { update: vi.fn(vi.mocked(prisma.survey.update).getMockImplementation()) },
        segment: { update: vi.fn() },
      };
      vi.mocked(prisma.$transaction).mockImplementationOnce(((
        callback: (client: typeof tx) => Promise<unknown>
      ) => callback(tx)) as unknown as typeof prisma.$transaction);

      await patchV3Survey(
        appCurrentSurvey,
        { targeting: { filters: attributeFilters } },
        "req_app_patch_3",
        "org_1"
      );

      expect(resolveV3ContactsEntitlement).toHaveBeenCalledWith(workspaceId, "org_1");
      // Segment-filter write and survey update must use the SAME tx client (true atomic behavior).
      expect(setV3SurveySegmentFilters).toHaveBeenCalledWith(
        "clsg1234567890123456789012",
        attributeFilters,
        tx
      );
      expect(tx.survey.update).toHaveBeenCalled();
      expect(prisma.survey.update).not.toHaveBeenCalled();
    });

    test("rejects a targeting change when the app survey has no segment", async () => {
      // App surveys always get an auto-created segment; if one is missing, a targeting change must
      // fail loudly rather than return 200 while silently dropping the filters.
      vi.mocked(areV3SurveyTargetingFiltersEqual).mockReturnValue(false);
      const segmentlessSurvey = { ...appCurrentSurvey, segment: null } as unknown as TSurvey;

      await expect(
        patchV3Survey(
          segmentlessSurvey,
          { targeting: { filters: attributeFilters } },
          "req_app_no_segment",
          "org_1"
        )
      ).rejects.toThrow(V3SurveyReferenceValidationError);

      expect(setV3SurveySegmentFilters).not.toHaveBeenCalled();
      expect(prisma.survey.update).not.toHaveBeenCalled();
    });

    test("rejects targeting changes when contacts are not enabled", async () => {
      vi.mocked(areV3SurveyTargetingFiltersEqual).mockReturnValue(false);
      vi.mocked(resolveV3ContactsEntitlement).mockResolvedValue({
        resolvedOrganizationId: "org_1",
        isContactsEnabled: false,
      });

      await expect(
        patchV3Survey(
          appCurrentSurvey,
          { targeting: { filters: attributeFilters } },
          "req_app_patch_4",
          "org_1"
        )
      ).rejects.toThrow(V3SurveyWritePermissionError);

      expect(setV3SurveySegmentFilters).not.toHaveBeenCalled();
      expect(prisma.survey.update).not.toHaveBeenCalled();
    });

    test("rejects unknown trigger action class ids before writing", async () => {
      vi.mocked(getActionClasses).mockResolvedValue([]);

      await expect(
        patchV3Survey(
          appCurrentSurvey,
          { distribution: { triggers: [{ actionClassId: actionClass.id }] } },
          "req_app_patch_5",
          "org_1"
        )
      ).rejects.toThrow(V3SurveyReferenceValidationError);

      expect(prisma.survey.update).not.toHaveBeenCalled();
    });
  });
});
