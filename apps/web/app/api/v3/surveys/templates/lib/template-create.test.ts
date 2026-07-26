import { beforeEach, describe, expect, test, vi } from "vitest";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { CUSTOM_SURVEY_TEMPLATE_ID } from "@/app/lib/templates";
import { XM_TEMPLATE_IDS } from "@/app/lib/xm-template-ids";
import { getWorkspace } from "@/lib/workspace/service";
import { getTranslate } from "@/lingodotdev/server";
import { createV3SurveyResponse } from "../../lib/operations";
import { createTrustedTemplateSurveyResponse } from "./template-create";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

vi.mock("@/app/api/v3/lib/auth", () => ({
  requireV3WorkspaceAccess: vi.fn(),
}));

vi.mock("@/lib/workspace/service", () => ({
  getWorkspace: vi.fn(),
}));

vi.mock("@/lingodotdev/server", () => ({
  getTranslate: vi.fn(),
}));

vi.mock("../../lib/operations", () => ({
  createV3SurveyResponse: vi.fn(),
}));

const workspaceId = "clxx1234567890123456789012";
const authResult = { workspaceId, organizationId: "org_1" };
const authentication = {
  user: { id: "user_1", email: "user@example.com", name: "User" },
  expires: "2026-05-01",
} as any;
const requestId = "req_123";
const instance = "/api/v3/surveys/templates";
const workspace = {
  id: workspaceId,
  name: "Acme",
} as any;
const t = vi.fn((key: string) => key) as any;

describe("createTrustedTemplateSurveyResponse", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    t.mockImplementation((key: string) => key);
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(authResult);
    vi.mocked(getWorkspace).mockResolvedValue(workspace);
    vi.mocked(getTranslate).mockResolvedValue(t);
    vi.mocked(createV3SurveyResponse).mockResolvedValue(
      Response.json({ data: { id: "survey_1" } }, { status: 201 })
    );
  });

  test("creates catalog templates through the trusted v3 create path", async () => {
    const response = await createTrustedTemplateSurveyResponse({
      body: {
        workspaceId,
        templateId: "product-market-fit-superhuman",
        source: "catalog",
        surveyType: "app",
        defaultLanguage: "en-US",
      },
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(201);
    expect(createV3SurveyResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        authentication,
        requestId,
        instance,
        authResult,
        createdFrom: "template",
        body: expect.objectContaining({
          workspaceId,
          type: "app",
          defaultLanguage: "en-US",
          name: "templates.product_market_fit_superhuman",
        }),
        createOptions: {
          skipExternalUrlPermissionCheck: true,
          surveyCreateInputOverrides: undefined,
        },
      })
    );
  });

  test("applies a configured, translatable workspace default language to the new survey and its copy", async () => {
    vi.mocked(getWorkspace).mockResolvedValue({
      ...workspace,
      defaultLanguageCode: "de-DE",
      languages: [{ code: "de-DE" }],
    } as any);

    await createTrustedTemplateSurveyResponse({
      body: {
        workspaceId,
        templateId: "product-market-fit-superhuman",
        source: "catalog",
        surveyType: "app",
        defaultLanguage: "en-US",
      },
      authentication,
      requestId,
      instance,
    });

    // Copy is authored in the workspace default (German), and the survey default language is German too.
    expect(getTranslate).toHaveBeenCalledWith("de-DE");
    expect(createV3SurveyResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ defaultLanguage: "de-DE" }),
      })
    );
  });

  test("sets a non-UI-locale workspace default as the survey default but keeps the copy in the creator's locale", async () => {
    vi.mocked(getWorkspace).mockResolvedValue({
      ...workspace,
      defaultLanguageCode: "it-IT",
      languages: [{ code: "it-IT" }],
    } as any);

    await createTrustedTemplateSurveyResponse({
      body: {
        workspaceId,
        templateId: "product-market-fit-superhuman",
        source: "catalog",
        surveyType: "app",
        defaultLanguage: "en-US",
      },
      authentication,
      requestId,
      instance,
    });

    // No Italian UI translations ship, so the copy stays English while the survey default becomes Italian.
    expect(getTranslate).toHaveBeenCalledWith("en-US");
    expect(createV3SurveyResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ defaultLanguage: "it-IT" }),
      })
    );
  });

  test("creates blank custom templates with created_from blank", async () => {
    await createTrustedTemplateSurveyResponse({
      body: {
        workspaceId,
        templateId: CUSTOM_SURVEY_TEMPLATE_ID,
        source: "custom",
        surveyType: "link",
        defaultLanguage: "en-US",
      },
      authentication,
      requestId,
      instance,
    });

    expect(createV3SurveyResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        createdFrom: "blank",
        body: expect.objectContaining({
          name: "templates.custom_survey_name",
          type: "link",
        }),
      })
    );
  });

  test("creates XM templates from the normal catalog with xm-template attribution", async () => {
    await createTrustedTemplateSurveyResponse({
      body: {
        workspaceId,
        templateId: XM_TEMPLATE_IDS[0],
        source: "xm",
        surveyType: "link",
        defaultLanguage: "en-US",
      },
      authentication,
      requestId,
      instance,
    });

    expect(createV3SurveyResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        createdFrom: "xm-template",
        body: expect.objectContaining({
          name: "templates.nps_survey_name",
          type: "link",
        }),
        createOptions: {
          skipExternalUrlPermissionCheck: true,
          surveyCreateInputOverrides: undefined,
        },
      })
    );
  });

  test("returns bad request when the generated v3 survey document is invalid", async () => {
    const response = await createTrustedTemplateSurveyResponse({
      body: {
        workspaceId,
        templateId: "product-market-fit-superhuman",
        source: "catalog",
        surveyType: "invalid" as any,
        defaultLanguage: "en-US",
      },
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(400);
    expect(createV3SurveyResponse).not.toHaveBeenCalled();
  });

  test("rejects unknown template/source combinations", async () => {
    const response = await createTrustedTemplateSurveyResponse({
      body: {
        workspaceId,
        templateId: CUSTOM_SURVEY_TEMPLATE_ID,
        source: "catalog",
        surveyType: "link",
        defaultLanguage: "en-US",
      },
      authentication,
      requestId,
      instance,
    });

    expect(response.status).toBe(400);
    expect(createV3SurveyResponse).not.toHaveBeenCalled();
  });
});
