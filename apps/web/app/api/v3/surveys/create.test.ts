import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { createSurvey } from "@/lib/survey/service";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import { V3SurveyCreatePermissionError, createV3Survey } from "./create";
import { V3SurveyReferenceValidationError } from "./reference-validation";
import { ZV3CreateSurveyBody } from "./schemas";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    language: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/survey/service", () => ({
  createSurvey: vi.fn(),
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
  });

  test("maps the public v3 body to the internal create payload", async () => {
    await createV3Survey(
      createBody,
      {
        user: { id: "user_1", email: "user@example.com", name: "User" },
        expires: "2026-05-01",
      },
      "req_1"
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
      })
    );
    expect(getOrganizationByWorkspaceId).not.toHaveBeenCalled();
    expect(getExternalUrlsPermission).not.toHaveBeenCalled();
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
      })
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
});
