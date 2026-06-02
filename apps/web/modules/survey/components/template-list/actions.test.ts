import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";
import { createSurveyAction } from "./actions";

const mocks = vi.hoisted(() => {
  const warn = vi.fn();
  const actionClientAction = vi.fn((fn) => fn);
  const state = {
    actionInputSchema: undefined,
  };

  return {
    warn,
    state,
    actionClientInputSchema: vi.fn((schema) => {
      state.actionInputSchema = schema;
      return {
        action: actionClientAction,
      };
    }),
    checkAuthorizationUpdated: vi.fn(),
    getOrganizationIdFromWorkspaceId: vi.fn(),
    getTemplateById: vi.fn(),
    getTranslate: vi.fn(),
    getWorkspace: vi.fn(),
    replacePresetPlaceholders: vi.fn(),
    buildV3SurveyCreatePayloadFromTemplate: vi.fn(),
    prepareV3TrustedTemplateSurveyCreateInput: vi.fn(),
    createV3SurveyFromTrustedTemplate: vi.fn(),
    capturePostHogEvent: vi.fn(),
  };
});

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      warn: mocks.warn,
    })),
  },
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: mocks.actionClientInputSchema,
  },
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_eventName, _objectType, fn) => fn),
}));

vi.mock("@/lib/constants", () => ({
  DEFAULT_LOCALE: "en-US",
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: mocks.checkAuthorizationUpdated,
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
}));

vi.mock("@/app/lib/templates", () => ({
  CUSTOM_SURVEY_TEMPLATE_ID: "custom",
  getTemplateById: mocks.getTemplateById,
}));

vi.mock("@/lingodotdev/server", () => ({
  getTranslate: mocks.getTranslate,
}));

vi.mock("@/lib/workspace/service", () => ({
  getWorkspace: mocks.getWorkspace,
}));

vi.mock("@/lib/utils/templates", () => ({
  replacePresetPlaceholders: mocks.replacePresetPlaceholders,
}));

vi.mock("./lib/template-to-v3", () => ({
  buildV3SurveyCreatePayloadFromTemplate: mocks.buildV3SurveyCreatePayloadFromTemplate,
}));

vi.mock("@/app/api/v3/surveys/prepare", () => ({
  prepareV3TrustedTemplateSurveyCreateInput: mocks.prepareV3TrustedTemplateSurveyCreateInput,
}));

vi.mock("@/app/api/v3/surveys/create", () => ({
  createV3SurveyFromTrustedTemplate: mocks.createV3SurveyFromTrustedTemplate,
}));

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: mocks.capturePostHogEvent,
}));

const workspaceId = "clxx1234567890123456789012";
const organizationId = "org_1";
const t = vi.fn((key: string) => key);
const user = {
  id: "user_1",
  email: "user@example.com",
  name: "User",
  locale: "de-DE",
};
const workspace = {
  id: workspaceId,
  name: "Acme",
};
const regeneratedTemplate = {
  id: "cart-abandonment",
  preset: {
    name: "Regenerated template survey",
  },
};
const templateWithPlaceholders = {
  ...regeneratedTemplate,
  preset: {
    name: "Acme regenerated template survey",
  },
};
const defaultPreset = {
  name: "New Survey",
  welcomeCard: { enabled: false },
  hiddenFields: { enabled: true, fieldIds: [] },
  blocks: [],
  endings: [],
};
const xmTemplate = {
  id: "nps",
  name: "XM NPS",
  description: "Measure customer loyalty",
  preset: {
    ...defaultPreset,
    name: "XM NPS",
    blocks: [{ id: "block_1", name: "Block 1", elements: [] }],
    endings: [{ id: "ending_1", type: "endScreen" }],
  },
};
const payload = {
  workspaceId,
  name: "Acme regenerated template survey",
};
const preparedDocument = {
  ...payload,
  type: "app",
};
const createdSurvey = {
  id: "survey_1",
  questions: [],
};

describe("createSurveyAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue(organizationId);
    mocks.checkAuthorizationUpdated.mockResolvedValue(undefined);
    mocks.getTranslate.mockResolvedValue(t);
    mocks.getTemplateById.mockReturnValue(regeneratedTemplate);
    mocks.getWorkspace.mockResolvedValue(workspace);
    mocks.replacePresetPlaceholders.mockReturnValue(templateWithPlaceholders);
    mocks.buildV3SurveyCreatePayloadFromTemplate.mockReturnValue(payload);
    mocks.prepareV3TrustedTemplateSurveyCreateInput.mockReturnValue({
      ok: true,
      document: preparedDocument,
    });
    mocks.createV3SurveyFromTrustedTemplate.mockResolvedValue(createdSurvey);
  });

  test("regenerates the selected template by id and creates through the trusted v3 path", async () => {
    const ctx = { user, auditLoggingCtx: {} };

    const result = await createSurveyAction({
      ctx,
      parsedInput: {
        workspaceId,
        templateId: "cart-abandonment",
        surveyType: "app",
      },
    } as any);

    expect(mocks.checkAuthorizationUpdated).toHaveBeenCalledWith({
      userId: user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          minPermission: "readWrite",
          workspaceId,
        },
      ],
    });
    expect(mocks.getTranslate).toHaveBeenCalledWith("de-DE");
    expect(mocks.getTemplateById).toHaveBeenCalledWith("cart-abandonment", t);
    expect(mocks.replacePresetPlaceholders).toHaveBeenCalledWith(regeneratedTemplate, workspace);
    expect(mocks.buildV3SurveyCreatePayloadFromTemplate).toHaveBeenCalledWith({
      template: templateWithPlaceholders,
      workspaceId,
      surveyType: "app",
      defaultLanguage: "de-DE",
    });
    expect(mocks.prepareV3TrustedTemplateSurveyCreateInput).toHaveBeenCalledWith(payload);
    expect(mocks.createV3SurveyFromTrustedTemplate).toHaveBeenCalledWith(preparedDocument, {
      user,
      expires: "",
    });
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      user.id,
      "survey_created",
      expect.objectContaining({
        created_from: "template",
        survey_id: createdSurvey.id,
      }),
      { organizationId, workspaceId }
    );
    expect(ctx.auditLoggingCtx).toMatchObject({
      organizationId,
      surveyId: createdSurvey.id,
      newObject: createdSurvey,
    });
    expect(result).toEqual(createdSurvey);
  });

  test("rejects arbitrary client survey payloads at the action input boundary", () => {
    const schema = mocks.state.actionInputSchema;

    const result = schema.safeParse({
      workspaceId,
      templateId: "cart-abandonment",
      surveyType: "app",
      surveyBody: { name: "Client supplied payload must be rejected" },
    });

    expect(result.success).toBe(false);
  });

  test("tracks scratch template creation as blank", async () => {
    await createSurveyAction({
      ctx: { user, auditLoggingCtx: {} },
      parsedInput: {
        workspaceId,
        templateId: "custom",
        surveyType: "link",
      },
    } as any);

    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      user.id,
      "survey_created",
      expect.objectContaining({
        created_from: "blank",
      }),
      { organizationId, workspaceId }
    );
  });

  test("regenerates XM templates from the trusted catalog without accepting a client survey body", async () => {
    mocks.getTemplateById.mockReturnValue(xmTemplate);

    await createSurveyAction({
      ctx: { user, auditLoggingCtx: {} },
      parsedInput: {
        workspaceId,
        templateId: "nps",
        surveyType: "link",
      },
    } as any);

    expect(mocks.getTemplateById).toHaveBeenCalledWith("nps", t);
    expect(mocks.replacePresetPlaceholders).toHaveBeenCalledWith(xmTemplate, workspace);
  });

  test("returns a clear error for invalid regenerated v3 payloads and logs only safe context", async () => {
    mocks.prepareV3TrustedTemplateSurveyCreateInput.mockReturnValue({
      ok: false,
      validation: {
        invalidParams: [
          {
            name: "blocks.0.elements.0.headline",
            reason: "Missing translation for de-DE",
            code: "missing_translation",
          },
        ],
      },
    });

    await expect(
      createSurveyAction({
        ctx: { user, auditLoggingCtx: {} },
        parsedInput: {
          workspaceId,
          templateId: "cart-abandonment",
          surveyType: "app",
        },
      } as any)
    ).rejects.toThrow(
      new InvalidInputError(
        "Invalid template survey document: blocks.0.elements.0.headline: Missing translation for de-DE"
      )
    );

    expect(mocks.warn).toHaveBeenCalledWith(
      {
        workspaceId,
        templateId: "cart-abandonment",
        invalidParams: ["blocks.0.elements.0.headline"],
      },
      "Template generated an invalid v3 survey document"
    );
    expect(mocks.createV3SurveyFromTrustedTemplate).not.toHaveBeenCalled();
  });
});
