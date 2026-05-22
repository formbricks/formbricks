import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { updateSurvey } from "@/lib/survey/service";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import { patchV3Survey } from "./patch";
import { V3SurveyReferenceValidationError } from "./reference-validation";
import { ZV3CreateSurveyBody } from "./schemas";
import { V3SurveyWritePermissionError } from "./write-permissions";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    language: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/survey/service", () => ({
  updateSurvey: vi.fn(),
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationByWorkspaceId: vi.fn(),
}));

vi.mock("@/modules/survey/lib/permission", () => ({
  getExternalUrlsPermission: vi.fn(),
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

type TLanguageUpsertArgs = Parameters<typeof prisma.language.upsert>[0];
type TLanguageUpsertReturn = ReturnType<typeof prisma.language.upsert>;

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
          id: `cllang${workspaceIdCode.code.toLowerCase().replaceAll("-", "")}`,
          code: workspaceIdCode.code,
          alias: null,
          workspaceId: workspaceIdCode.workspaceId,
          createdAt: new Date("2026-04-21T10:00:00.000Z"),
          updatedAt: new Date("2026-04-21T10:00:00.000Z"),
        }) as TLanguageUpsertReturn;
      }
    );
    vi.mocked(updateSurvey).mockImplementation(async (survey) => survey);
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
      isAIDataAnalysisEnabled: false,
      whitelabel: undefined,
    });
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(true);
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
    expect(updateSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        id: currentSurvey.id,
        workspaceId,
        createdBy: "user_1",
        type: "link",
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
        languages: expect.arrayContaining([
          expect.objectContaining({ default: true, enabled: true }),
          expect.objectContaining({
            language: expect.objectContaining({ code: "de-DE" }),
            default: false,
            enabled: true,
          }),
        ]),
      })
    );
    expect(getExternalUrlsPermission).not.toHaveBeenCalled();
  });

  test("rejects invalid patch documents before updating", async () => {
    await expect(
      patchV3Survey(currentSurvey, {
        defaultLanguage: "de-DE",
      })
    ).rejects.toThrow(V3SurveyReferenceValidationError);

    expect(updateSurvey).not.toHaveBeenCalled();
  });

  test("allows patching unrelated fields when existing external URLs are unchanged", async () => {
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);
    const externalUrlBody = ZV3CreateSurveyBody.parse({
      workspaceId,
      name: "Product Feedback",
      defaultLanguage: "en-US",
      blocks: [
        {
          id: "clbk1234567890123456789012",
          name: "Main Block",
          elements: [
            {
              id: "external_cta",
              type: "cta",
              headline: { "en-US": "Continue" },
              required: false,
              buttonExternal: true,
              buttonUrl: "https://example.com",
              ctaButtonLabel: { "en-US": "Open" },
            },
          ],
        },
      ],
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
    expect(updateSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Renamed Feedback",
        blocks: externalUrlBody.blocks,
        endings: externalUrlBody.endings,
      })
    );
  });

  test("reuses external URL permission checks for patched survey documents", async () => {
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);

    await expect(
      patchV3Survey(
        currentSurvey,
        {
          blocks: [
            {
              ...createBody.blocks[0],
              elements: [
                {
                  id: "external_cta",
                  type: "cta",
                  headline: { "en-US": "Continue" },
                  required: false,
                  buttonExternal: true,
                  buttonUrl: "https://example.com",
                  ctaButtonLabel: { "en-US": "Open" },
                },
              ],
            },
          ],
        },
        "req_2",
        "org_1"
      )
    ).rejects.toThrow(V3SurveyWritePermissionError);

    expect(updateSurvey).not.toHaveBeenCalled();
  });
});
