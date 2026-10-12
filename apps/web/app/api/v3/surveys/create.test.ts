import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TooManyRequestsError } from "@formbricks/types/errors";
import type { TSurvey } from "@formbricks/types/surveys/types";
import {
  type TV3SurveyWriteReport,
  V3CustomCssInvalidError,
  V3CustomCssPlanRequiredError,
} from "@/app/api/v3/lib/custom-css";
import { getActionClasses } from "@/lib/actionClass/service";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { createSurvey, getSurveyWithCustomCss } from "@/lib/survey/service";
import { resolveSurveyCreationFacts } from "@/lib/survey/visibility/creation";
import { assertWorkspaceSurveyLimit } from "@/lib/survey/visibility/limit";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getCustomCssPlanAllowed } from "@/modules/custom-css/lib/access";
import { processCustomCss } from "@/modules/custom-css/processor";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import { V3SurveyCreatePermissionError, V3SurveyInputValidationError, createV3Survey } from "./create";
import { V3SurveyReferenceValidationError } from "./reference-validation";
import { ZV3CreateSurveyBody } from "./schemas";
import { resolveV3ContactsEntitlement } from "./targeting";

vi.mock("server-only", () => ({}));

// ENG-3641: the processor contract and the plan gate; the save rules between them run for real.
vi.mock("@/modules/custom-css/processor", () => ({
  CUSTOM_CSS_PROCESSOR_VERSION: 3,
  processCustomCss: vi.fn(),
  normalizeCustomCssInput: (input: { light: string | null; dark: string | null } | null | undefined) => {
    const light = input?.light?.trim() ? input.light : null;
    const dark = input?.dark?.trim() ? input.dark : null;
    return light === null && dark === null ? null : { light, dark };
  },
}));
vi.mock("@/modules/custom-css/lib/access", () => ({
  CUSTOM_CSS_PLAN_REQUIRED_MESSAGE: "Adding or editing custom CSS requires the Scale plan.",
  getCustomCssPlanAllowed: vi.fn(),
}));
vi.mock("@/lib/cache", () => ({ cache: { del: vi.fn() } }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));

vi.mock("@formbricks/database", () => ({
  prisma: {
    language: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/survey/service", () => ({
  createSurvey: vi.fn(),
  getSurveyWithCustomCss: vi.fn(),
}));

vi.mock("@/lib/survey/visibility/limit", () => ({
  WorkspaceSurveyLimitError: class extends Error {},
  assertWorkspaceSurveyLimit: vi.fn(),
}));

vi.mock("@/lib/survey/visibility/creation", () => ({
  resolveSurveyCreationFacts: vi.fn(),
}));

vi.mock("@/lib/actionClass/service", () => ({
  getActionClasses: vi.fn(),
}));

vi.mock("./targeting", () => ({
  resolveV3ContactsEntitlement: vi.fn(),
  assertV3SurveyTargetingFilterReferences: vi.fn(),
  V3_CONTACTS_NOT_ENABLED_MESSAGE: "Contact targeting is not enabled.",
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

const rawCreateBody = {
  workspaceId,
  name: "Product Feedback",
  defaultLanguage: "en-US",
  languages: [{ code: "de-DE", enabled: true }],
  metadata: {
    cx_operation: "enterprise_onboarding",
    title: { "en-US": "Product Feedback", "de-DE": "Produktfeedback" },
  },
  blocks: [
    {
      id: "clbk1234567890123456789012",
      name: "Main Block",
      elements: [
        {
          id: "satisfaction",
          type: "openText",
          headline: {
            "en-US": "What should we improve?",
            "de-DE": "Was sollen wir verbessern?",
          },
          required: true,
        },
      ],
    },
  ],
};

const createBody = ZV3CreateSurveyBody.parse(rawCreateBody);

const createdSurvey = {
  id: "clsv1234567890123456789012",
  workspaceId,
  createdAt: new Date("2026-04-21T10:00:00.000Z"),
  updatedAt: new Date("2026-04-21T10:00:00.000Z"),
  name: "Product Feedback",
  type: "link",
  status: "draft",
  metadata: {},
  languages: [],
  questions: [],
  welcomeCard: { enabled: false },
  blocks: createBody.blocks,
  endings: [],
  hiddenFields: { enabled: false },
  variables: [],
} as unknown as TSurvey;

type TLanguageUpsertArgs = Parameters<typeof prisma.language.upsert>[0];
type TLanguageUpsertReturn = ReturnType<typeof prisma.language.upsert>;

const WORKSPACE_FACTS = { ownerId: null, visibility: "workspace" } as const;

describe("createV3Survey", () => {
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
    vi.mocked(createSurvey).mockResolvedValue(createdSurvey);
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
    vi.mocked(getSurveyWithCustomCss).mockResolvedValue(createdSurvey);
    vi.mocked(resolveSurveyCreationFacts).mockResolvedValue(WORKSPACE_FACTS);
  });

  test("maps the public v3 body to the internal create payload", async () => {
    await createV3Survey(
      createBody,
      {
        user: { id: "user_1", email: "user@example.com", name: "User" },
        expires: "2026-05-01",
      },
      "req_1",
      "org_1"
    );

    expect(prisma.language.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId_code: { workspaceId, code: "en-US" } },
        create: { workspaceId, code: "en-US", alias: null },
      })
    );
    expect(prisma.language.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId_code: { workspaceId, code: "de-DE" } },
        create: { workspaceId, code: "de-DE", alias: null },
      })
    );
    expect(createSurvey).toHaveBeenCalledWith(
      workspaceId,
      expect.objectContaining({
        name: "Product Feedback",
        type: "link",
        status: "draft",
        createdBy: "user_1",
        questions: [],
        metadata: expect.objectContaining({
          cx_operation: "enterprise_onboarding",
          title: { default: "Product Feedback", "de-DE": "Produktfeedback" },
        }),
        blocks: [
          expect.objectContaining({
            elements: [
              expect.objectContaining({
                headline: {
                  default: "What should we improve?",
                  "de-DE": "Was sollen wir verbessern?",
                },
              }),
            ],
          }),
        ],
        languages: [
          expect.objectContaining({ default: true, enabled: true }),
          expect.objectContaining({ default: false, enabled: true }),
        ],
      }),
      { creationFacts: WORKSPACE_FACTS, privateSegmentFilters: [], customCss: null }
    );
    expect(getOrganizationByWorkspaceId).not.toHaveBeenCalled();
    expect(getExternalUrlsPermission).not.toHaveBeenCalled();
  });

  test("persists the language settings from the body", async () => {
    await createV3Survey(
      { ...createBody, showLanguageSwitch: true, autoSelectLanguage: true },
      { user: { id: "user_1", email: "user@example.com", name: "User" }, expires: "2026-05-01" },
      "req_1",
      "org_1"
    );

    expect(createSurvey).toHaveBeenCalledWith(
      workspaceId,
      expect.objectContaining({ showLanguageSwitch: true, autoSelectLanguage: true }),
      expect.anything()
    );
  });

  test("keeps createdBy null for API key calls and honors explicit disabled languages", async () => {
    const body = ZV3CreateSurveyBody.parse({
      ...rawCreateBody,
      languages: [
        { code: "de-DE", enabled: true },
        { code: "fr-FR", enabled: false },
      ],
      metadata: {
        ...rawCreateBody.metadata,
        title: {
          ...rawCreateBody.metadata.title,
          "fr-FR": "Commentaires produit",
        },
      },
      blocks: [
        {
          ...rawCreateBody.blocks[0],
          elements: [
            {
              ...rawCreateBody.blocks[0].elements[0],
              headline: {
                ...rawCreateBody.blocks[0].elements[0].headline,
                "fr-FR": "Que devons-nous améliorer ?",
              },
            },
          ],
        },
      ],
    });

    await createV3Survey(
      body,
      {
        type: "apiKey",
        apiKeyId: "key_1",
        organizationId: "org_1",
        organizationAccess: { accessControl: { read: true, write: true } },
        workspacePermissions: [],
      },
      "req_2"
    );

    expect(createSurvey).toHaveBeenCalledWith(
      workspaceId,
      expect.objectContaining({
        createdBy: null,
        languages: expect.arrayContaining([
          expect.objectContaining({ language: expect.objectContaining({ code: "fr-FR" }), enabled: false }),
        ]),
      }),
      { creationFacts: WORKSPACE_FACTS, privateSegmentFilters: [], customCss: null }
    );
  });

  test("rejects invalid media URLs before creating the survey", async () => {
    const body = ZV3CreateSurveyBody.parse({
      ...rawCreateBody,
      blocks: [
        {
          ...rawCreateBody.blocks[0],
          elements: [
            {
              ...rawCreateBody.blocks[0].elements[0],
              videoUrl: "https://evil.example.com/not-a-video",
            },
          ],
        },
      ],
    });

    await expect(createV3Survey(body, null, "req_media")).rejects.toThrow(V3SurveyReferenceValidationError);
    expect(createSurvey).not.toHaveBeenCalled();
    expect(prisma.language.upsert).not.toHaveBeenCalled();
  });

  test("rejects external CTA buttons when the organization does not have external URL permission", async () => {
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);
    const body = ZV3CreateSurveyBody.parse({
      ...rawCreateBody,
      blocks: [
        {
          ...rawCreateBody.blocks[0],
          elements: [
            {
              id: "external_cta",
              type: "cta",
              headline: { "en-US": "Continue", "de-DE": "Weiter" },
              required: false,
              buttonExternal: true,
              buttonUrl: "https://example.com",
              ctaButtonLabel: { "en-US": "Open", "de-DE": "Öffnen" },
            },
          ],
        },
      ],
    });

    await expect(createV3Survey(body, null, "req_3")).rejects.toThrow(V3SurveyCreatePermissionError);
    expect(createSurvey).not.toHaveBeenCalled();
  });

  // ENG-2587. Driven through the real `ZSurveyCreateInput`/`surveyRefinement` rather than a
  // synthetic schema, so it also fails if the refinement's issue path moves, or if the CTA branch
  // stops firing (it is gated on `buttonExternal`). `createSurvey` is mocked, so no DB is involved.
  test("rejects a CTA buttonUrl scheme the request schema admits but the write schema does not", async () => {
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(true);
    const body = ZV3CreateSurveyBody.parse({
      ...rawCreateBody,
      blocks: [
        {
          ...rawCreateBody.blocks[0],
          elements: [
            {
              id: "tel_cta",
              type: "cta",
              headline: { "en-US": "Call us", "de-DE": "Ruf uns an" },
              required: false,
              buttonExternal: true,
              buttonUrl: "tel:+123456789",
              ctaButtonLabel: { "en-US": "Call", "de-DE": "Anrufen" },
            },
          ],
        },
      ],
    });

    const error = await createV3Survey(body, null, "req_eng2587").catch((err: unknown) => err);

    expect(error).toBeInstanceOf(V3SurveyInputValidationError);
    expect((error as V3SurveyInputValidationError).invalidParams).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "blocks.0.elements.0.buttonUrl" })])
    );
    // The whole point of pre-write validation: nothing was written.
    expect(createSurvey).not.toHaveBeenCalled();
  });

  // Found in review on #8991: a second case the request schema admits and the write schema rejects, so
  // it used to be a 500 too. Same path as the CTA case above, different refinement — worth pinning
  // because the description claims this case is covered, and a live check alone would not keep it so.
  // The other case the request schema admits and the write schema rejects: `isSafeLinkUrl` allows
  // `http:`, `safeUrlRefinement` allows only `https://` and `http://localhost`. Per review this is the
  // most common of the three in practice, so it gets its own assertion rather than riding on `tel:`.
  test("rejects a plain http CTA buttonUrl the request schema admits", async () => {
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(true);
    const body = ZV3CreateSurveyBody.parse({
      ...rawCreateBody,
      blocks: [
        {
          ...rawCreateBody.blocks[0],
          elements: [
            {
              id: "http_cta",
              type: "cta",
              headline: { "en-US": "Docs", "de-DE": "Doku" },
              required: false,
              buttonExternal: true,
              buttonUrl: "http://example.com",
              ctaButtonLabel: { "en-US": "Open", "de-DE": "Oeffnen" },
            },
          ],
        },
      ],
    });

    const error = await createV3Survey(body, null, "req_http_cta").catch((err: unknown) => err);

    expect(error).toBeInstanceOf(V3SurveyInputValidationError);
    expect((error as V3SurveyInputValidationError).invalidParams).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "blocks.0.elements.0.buttonUrl" })])
    );
    expect(createSurvey).not.toHaveBeenCalled();
  });

  // A blank headline is rejected either side of the new parse, and which side depends on the language
  // set rather than on the blankness. What `prepareV3SurveyCreate` catches here is the *absent* `de-DE`
  // key, since `rawCreateBody` declares `de-DE` while this headline carries only `en-US`.
  test("routes a blank headline with a missing declared locale to the earlier preparation guard", async () => {
    const body = ZV3CreateSurveyBody.parse({
      ...rawCreateBody,
      blocks: [
        {
          ...rawCreateBody.blocks[0],
          elements: [
            {
              id: "blank_headline_missing_locale",
              type: "openText",
              headline: { "en-US": "   " },
              required: true,
            },
          ],
        },
      ],
    });

    const error = await createV3Survey(body, null, "req_blank_missing_locale").catch((err: unknown) => err);

    expect(error).toBeInstanceOf(V3SurveyReferenceValidationError);
    expect(error).not.toBeInstanceOf(V3SurveyInputValidationError);
    expect(createSurvey).not.toHaveBeenCalled();
  });

  // ...and once every declared locale key is present, the blank headline reaches the new pre-write parse
  // instead. These two shapes were 500s on `main`, so they are part of what this PR fixes. Found in
  // review after an earlier version of this suite pinned only the shape above and over-generalised
  // from it.
  test.each([
    ["no languages declared", undefined, { "en-US": "   " }, { "en-US": "Product Feedback" }],
    [
      "every declared locale present and blank",
      [{ code: "de-DE", enabled: true }],
      { "en-US": "   ", "de-DE": "   " },
      { "en-US": "Product Feedback", "de-DE": "Produktfeedback" },
    ],
  ])(
    "rejects a blank headline with %s through the new pre-write parse",
    async (_label, languages, headline, title) => {
      const body = ZV3CreateSurveyBody.parse({
        ...rawCreateBody,
        languages,
        // The metadata title has to carry the same declared locales, or preparation rejects *that*
        // missing key first and the element never reaches the parse under test.
        metadata: { cx_operation: "enterprise_onboarding", title },
        blocks: [
          {
            ...rawCreateBody.blocks[0],
            elements: [{ id: "blank_headline", type: "openText", headline, required: true }],
          },
        ],
      });

      const error = await createV3Survey(body, null, "req_blank_headline").catch((err: unknown) => err);

      expect(error).toBeInstanceOf(V3SurveyInputValidationError);
      expect((error as V3SurveyInputValidationError).invalidParams).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: "blocks.0.elements.0.headline" })])
      );
      expect(createSurvey).not.toHaveBeenCalled();
    }
  );

  test("accepts an https CTA buttonUrl through the same path", async () => {
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(true);
    const body = ZV3CreateSurveyBody.parse({
      ...rawCreateBody,
      blocks: [
        {
          ...rawCreateBody.blocks[0],
          elements: [
            {
              id: "https_cta",
              type: "cta",
              headline: { "en-US": "Continue", "de-DE": "Weiter" },
              required: false,
              buttonExternal: true,
              buttonUrl: "https://example.com",
              ctaButtonLabel: { "en-US": "Open", "de-DE": "\u00d6ffnen" },
            },
          ],
        },
      ],
    });

    await expect(createV3Survey(body, null, "req_eng2587_ok")).resolves.toBeDefined();
    expect(createSurvey).toHaveBeenCalled();
  });

  test("rejects external CTA buttons for API-key creates without external URL permission", async () => {
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);
    const body = ZV3CreateSurveyBody.parse({
      ...rawCreateBody,
      blocks: [
        {
          ...rawCreateBody.blocks[0],
          elements: [
            {
              id: "external_cta",
              type: "cta",
              headline: { "en-US": "Continue", "de-DE": "Weiter" },
              required: false,
              buttonExternal: true,
              buttonUrl: "https://example.com",
              ctaButtonLabel: { "en-US": "Open", "de-DE": "Öffnen" },
            },
          ],
        },
      ],
    });

    await expect(
      createV3Survey(
        body,
        {
          type: "apiKey",
          apiKeyId: "key_1",
          organizationId: "org_1",
          organizationAccess: { accessControl: { read: true, write: true } },
          workspacePermissions: [],
        },
        "req_api_key",
        "org_1"
      )
    ).rejects.toThrow(V3SurveyCreatePermissionError);

    expect(getOrganizationByWorkspaceId).not.toHaveBeenCalled();
    expect(getExternalUrlsPermission).toHaveBeenCalledWith("org_1");
    expect(createSurvey).not.toHaveBeenCalled();
  });

  test("rejects redirect endings when the organization does not have external URL permission", async () => {
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);
    const body = ZV3CreateSurveyBody.parse({
      ...rawCreateBody,
      endings: [
        {
          id: "clen1234567890123456789012",
          type: "redirectToUrl",
          url: "https://example.com/next",
        },
      ],
    });

    await expect(createV3Survey(body, null, "req_4")).rejects.toThrow(V3SurveyCreatePermissionError);
    expect(createSurvey).not.toHaveBeenCalled();
  });

  test("rejects external URLs for session-authenticated public creates without external URL permission", async () => {
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(false);
    const body = ZV3CreateSurveyBody.parse({
      ...rawCreateBody,
      type: "app",
      endings: [
        {
          id: "clen1234567890123456789012",
          type: "redirectToUrl",
          url: "https://example.com/next",
        },
      ],
    });

    await expect(
      createV3Survey(
        body,
        {
          user: { id: "user_1", email: "user@example.com", name: "User" },
          expires: "2026-05-01",
        },
        "req_5"
      )
    ).rejects.toThrow(V3SurveyCreatePermissionError);

    expect(getOrganizationByWorkspaceId).toHaveBeenCalledWith(workspaceId);
    expect(getExternalUrlsPermission).toHaveBeenCalledWith("org_1");
    expect(createSurvey).not.toHaveBeenCalled();
  });

  test("create still rejects invalid v3 documents", async () => {
    const body = ZV3CreateSurveyBody.parse({
      ...rawCreateBody,
      hiddenFields: { enabled: true, fieldIds: ["utm_source"] },
      blocks: [
        {
          ...rawCreateBody.blocks[0],
          elements: [
            {
              ...rawCreateBody.blocks[0].elements[0],
              headline: { "en-US": "Tell us about #recall:missing_reference" },
            },
          ],
        },
      ],
    });

    await expect(
      createV3Survey(
        body,
        {
          user: { id: "user_1", email: "user@example.com", name: "User" },
          expires: "2026-05-01",
        },
        "req_6"
      )
    ).rejects.toThrow(V3SurveyReferenceValidationError);
    expect(createSurvey).not.toHaveBeenCalled();
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

    const appSurveyId = "clsvapp01234567890123456789";
    const appSegment = { id: "clsg1234567890123456789012", filters: [] };
    // `createSurvey` returns the survey BEFORE the private segment is connected (segment: null).
    const createdAppSurvey = {
      ...createdSurvey,
      id: appSurveyId,
      type: "app",
      segment: null,
    } as unknown as TSurvey;
    // `getSurveyWithCustomCss` re-reads it WITH the auto-created segment connected.
    const appSurveyWithSegment = {
      ...createdSurvey,
      id: appSurveyId,
      type: "app",
      segment: appSegment,
    } as unknown as TSurvey;

    beforeEach(() => {
      vi.mocked(createSurvey).mockResolvedValue(createdAppSurvey);
      vi.mocked(getSurveyWithCustomCss).mockResolvedValue(appSurveyWithSegment);
    });

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

    const buildAppBody = (overrides: Record<string, unknown> = {}) =>
      ZV3CreateSurveyBody.parse({
        workspaceId,
        name: "In-App Feedback",
        type: "app",
        defaultLanguage: "en-US",
        blocks: [
          {
            id: "clbk1234567890123456789012",
            name: "Main",
            elements: [
              {
                id: "feedback",
                type: "openText",
                headline: { "en-US": "How is it going?" },
                required: false,
              },
            ],
          },
        ],
        ...overrides,
      });

    test("forwards distribution scalars and resolved triggers to createSurvey", async () => {
      vi.mocked(getActionClasses).mockResolvedValue([actionClass]);

      const body = buildAppBody({
        distribution: {
          displayOption: "respondMultiple",
          recontactDays: 7,
          delay: 5,
          triggers: [{ actionClassId: actionClass.id }],
        },
      });

      await createV3Survey(body, null, "req_app_1");

      expect(createSurvey).toHaveBeenCalledWith(
        workspaceId,
        expect.objectContaining({
          type: "app",
          displayOption: "respondMultiple",
          recontactDays: 7,
          delay: 5,
          triggers: [{ actionClass }],
        }),
        { creationFacts: WORKSPACE_FACTS, privateSegmentFilters: [], customCss: null }
      );
      // No targeting filters → empty private segment, no entitlement check.
      expect(resolveV3ContactsEntitlement).not.toHaveBeenCalled();
    });

    test("passes targeting filters into createSurvey and returns the re-read survey", async () => {
      // Targeting is created atomically with the survey's private segment inside createSurvey (one
      // transaction); the re-read then surfaces the connected segment + numeric display fields.
      vi.mocked(getSurveyWithCustomCss).mockResolvedValueOnce({
        ...appSurveyWithSegment,
        segment: { ...appSegment, filters: attributeFilters },
      } as unknown as TSurvey);
      const body = buildAppBody({ targeting: { filters: attributeFilters } });

      const result = await createV3Survey(body, null, "req_app_2", "org_1");

      expect(resolveV3ContactsEntitlement).toHaveBeenCalledWith(workspaceId, "org_1");
      expect(createSurvey).toHaveBeenCalledWith(workspaceId, expect.objectContaining({ type: "app" }), {
        creationFacts: WORKSPACE_FACTS,
        privateSegmentFilters: attributeFilters,
        customCss: null,
      });
      expect(getSurveyWithCustomCss).toHaveBeenCalledWith(appSurveyId);
      expect(result.segment?.filters).toEqual(attributeFilters);
    });

    test("rolls back atomically when createSurvey fails (no partial survey)", async () => {
      // Targeting is written inside createSurvey's transaction, so a failed segment/targeting write
      // rolls the whole create back and surfaces an error instead of leaving a survey behind.
      vi.mocked(createSurvey).mockRejectedValueOnce(new Error("segment write failed"));
      const body = buildAppBody({ targeting: { filters: attributeFilters } });

      await expect(createV3Survey(body, null, "req_app_targeting_fail", "org_1")).rejects.toThrow();
      expect(getSurveyWithCustomCss).not.toHaveBeenCalled();
    });

    test("rejects targeting when contacts are not enabled, before any write", async () => {
      vi.mocked(resolveV3ContactsEntitlement).mockResolvedValue({
        resolvedOrganizationId: "org_1",
        isContactsEnabled: false,
      });
      const body = buildAppBody({ targeting: { filters: attributeFilters } });

      await expect(createV3Survey(body, null, "req_app_3", "org_1")).rejects.toThrow(
        V3SurveyCreatePermissionError
      );
      expect(createSurvey).not.toHaveBeenCalled();
    });

    test("rejects unknown trigger action class ids", async () => {
      vi.mocked(getActionClasses).mockResolvedValue([]);
      const body = buildAppBody({ distribution: { triggers: [{ actionClassId: actionClass.id }] } });

      await expect(createV3Survey(body, null, "req_app_4")).rejects.toThrow(V3SurveyReferenceValidationError);
      expect(createSurvey).not.toHaveBeenCalled();
    });

    test("rejects duplicate trigger action class ids", async () => {
      vi.mocked(getActionClasses).mockResolvedValue([actionClass]);
      const body = buildAppBody({
        distribution: { triggers: [{ actionClassId: actionClass.id }, { actionClassId: actionClass.id }] },
      });

      await expect(createV3Survey(body, null, "req_app_5")).rejects.toThrow(V3SurveyReferenceValidationError);
      expect(createSurvey).not.toHaveBeenCalled();
    });
  });

  describe("ownership and visibility (ENG-3282)", () => {
    test("resolves the creation facts from the principal and hands them to the service", async () => {
      vi.mocked(resolveSurveyCreationFacts).mockResolvedValueOnce({
        ownerId: "user_1",
        visibility: "restricted",
      });

      await createV3Survey(
        createBody,
        { user: { id: "user_1", email: "user@example.com", name: "User" }, expires: "2026-05-01" },
        "req_facts",
        "org_1"
      );

      expect(resolveSurveyCreationFacts).toHaveBeenCalledWith({
        actor: { type: "user", id: "user_1" },
        organizationId: "org_1",
      });
      expect(createSurvey).toHaveBeenCalledWith(workspaceId, expect.anything(), {
        creationFacts: { ownerId: "user_1", visibility: "restricted" },
        privateSegmentFilters: [],
        customCss: null,
      });
    });

    test("checks the workspace cap before writing anything", async () => {
      vi.mocked(assertWorkspaceSurveyLimit).mockRejectedValueOnce(new Error("limit"));

      await expect(createV3Survey(createBody, null, "req_cap", "org_1")).rejects.toThrow("limit");
      expect(assertWorkspaceSurveyLimit).toHaveBeenCalledWith(workspaceId);
      expect(prisma.language.upsert).not.toHaveBeenCalled();
      expect(createSurvey).not.toHaveBeenCalled();
    });
  });
});

describe("createV3Survey custom CSS (ENG-3641)", () => {
  const warning = {
    code: "import_removed" as const,
    scope: "survey" as const,
    appearance: "light" as const,
    line: 1,
    column: 1,
    reason: "@import is not supported",
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.language.upsert).mockImplementation(((args: TLanguageUpsertArgs) =>
      Promise.resolve({
        id: `cllang${String(args.where.workspaceId_code?.code).toLowerCase().replaceAll("-", "")}`,
        code: args.where.workspaceId_code?.code,
        alias: null,
        workspaceId,
        createdAt: new Date("2026-04-21T10:00:00.000Z"),
        updatedAt: new Date("2026-04-21T10:00:00.000Z"),
      })) as unknown as typeof prisma.language.upsert);
    vi.mocked(createSurvey).mockResolvedValue(createdSurvey);
    vi.mocked(getExternalUrlsPermission).mockResolvedValue(true);
    vi.mocked(getActionClasses).mockResolvedValue([]);
    vi.mocked(resolveSurveyCreationFacts).mockResolvedValue(WORKSPACE_FACTS);
    vi.mocked(getCustomCssPlanAllowed).mockResolvedValue(true);
    vi.mocked(processCustomCss).mockReturnValue({
      ok: true,
      compiled: { light: "@layer fb-survey{x}", dark: null },
      warnings: [warning],
      processorVersion: 3,
    });
  });

  test("processes the source, stores trusted output and reports the warnings", async () => {
    const report: TV3SurveyWriteReport = {};
    const body = ZV3CreateSurveyBody.parse({ ...rawCreateBody, customCss: { light: "a{}", dark: null } });

    await createV3Survey(body, null, "req_css", "org_1", { report });

    expect(getCustomCssPlanAllowed).toHaveBeenCalledWith("org_1");
    expect(processCustomCss).toHaveBeenCalledWith({ scope: "survey", input: { light: "a{}", dark: null } });
    expect(createSurvey).toHaveBeenCalledWith(
      workspaceId,
      expect.not.objectContaining({ customCss: expect.anything() }),
      {
        creationFacts: WORKSPACE_FACTS,
        privateSegmentFilters: [],
        customCss: {
          light: { source: "a{}", compiled: "@layer fb-survey{x}" },
          dark: null,
          processorVersion: 3,
        },
      }
    );
    expect(report.customCssWarnings).toEqual([warning]);
  });

  test("an organization without the plan cannot create a survey with CSS, and nothing is written", async () => {
    vi.mocked(getCustomCssPlanAllowed).mockResolvedValue(false);
    const body = ZV3CreateSurveyBody.parse({ ...rawCreateBody, customCss: { light: "a{}", dark: null } });

    await expect(createV3Survey(body, null, "req_css", "org_1")).rejects.toBeInstanceOf(
      V3CustomCssPlanRequiredError
    );
    expect(processCustomCss).not.toHaveBeenCalled();
    expect(createSurvey).not.toHaveBeenCalled();
    expect(prisma.language.upsert).not.toHaveBeenCalled();
  });

  test("CSS the processor rejects fails the create before any write", async () => {
    vi.mocked(processCustomCss).mockReturnValue({
      ok: false,
      errors: [{ ...warning, code: "syntax_error" as const, reason: "Unexpected token" }],
    });
    const body = ZV3CreateSurveyBody.parse({ ...rawCreateBody, customCss: { light: "a{", dark: null } });

    await expect(createV3Survey(body, null, "req_css", "org_1")).rejects.toBeInstanceOf(
      V3CustomCssInvalidError
    );
    expect(createSurvey).not.toHaveBeenCalled();
  });

  test("no CSS, or empty CSS, needs neither the plan nor the processor", async () => {
    vi.mocked(getCustomCssPlanAllowed).mockResolvedValue(false);
    const report: TV3SurveyWriteReport = {};

    await createV3Survey(createBody, null, "req_css", "org_1", { report });
    await createV3Survey(
      ZV3CreateSurveyBody.parse({ ...rawCreateBody, customCss: { light: "  ", dark: null } }),
      null,
      "req_css",
      "org_1"
    );

    expect(getCustomCssPlanAllowed).not.toHaveBeenCalled();
    expect(processCustomCss).not.toHaveBeenCalled();
    expect(vi.mocked(createSurvey).mock.calls[0][2]).toMatchObject({ customCss: null });
    expect(report.customCssWarnings).toBeUndefined();
  });

  test("charges processing to the caller's custom CSS budget; a spent budget refuses the create", async () => {
    const apiKey = { apiKeyId: "key_1", organizationId: "org_1", workspacePermissions: [] } as never;
    const session = { user: { id: "user_1" }, expires: "2099-01-01" } as never;
    const body = ZV3CreateSurveyBody.parse({ ...rawCreateBody, customCss: { light: "a{}", dark: null } });

    await createV3Survey(body, apiKey, "req_css", "org_1");
    expect(applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.api.v3CustomCss, "key_1");

    vi.mocked(createSurvey).mockClear();
    vi.mocked(processCustomCss).mockClear();
    vi.mocked(applyRateLimit).mockRejectedValueOnce(new TooManyRequestsError("Slow down", 30));
    await expect(createV3Survey(body, session, "req_css", "org_1")).rejects.toBeInstanceOf(
      TooManyRequestsError
    );
    expect(applyRateLimit).toHaveBeenLastCalledWith(rateLimitConfigs.api.v3CustomCss, "user_1");
    expect(processCustomCss).not.toHaveBeenCalled();
    expect(createSurvey).not.toHaveBeenCalled();
  });

  test("a create without CSS spends nothing from the custom CSS budget", async () => {
    const session = { user: { id: "user_1" }, expires: "2099-01-01" } as never;

    await createV3Survey(createBody, session, "req_css", "org_1");

    expect(applyRateLimit).not.toHaveBeenCalled();
  });

  test("the body schema rejects caller-supplied compiled output and processor versions", () => {
    for (const customCss of [
      { light: "a{}", dark: null, compiled: "x" },
      { light: "a{}", dark: null, processorVersion: 1 },
      { light: { source: "a{}", compiled: "x" }, dark: null },
      { light: "a{}" },
    ]) {
      expect(ZV3CreateSurveyBody.safeParse({ ...rawCreateBody, customCss }).success).toBe(false);
    }
  });
});
