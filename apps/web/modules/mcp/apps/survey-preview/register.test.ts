import { beforeEach, describe, expect, test, vi } from "vitest";
import { problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import { getV3Survey } from "@/app/api/v3/surveys/lib/operations";
import { loadSurveyPreviewMeta } from "./load-preview-meta";
import { registerSurveyPreviewApp } from "./register";

vi.mock("@/app/api/v3/surveys/lib/operations", () => ({ getV3Survey: vi.fn() }));
vi.mock("./load-preview-meta", () => ({ loadSurveyPreviewMeta: vi.fn() }));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  WEBAPP_URL: "https://app.example.com",
}));
vi.mock("@/lib/getPublicUrl", () => ({ getPublicDomain: () => "https://surveys.example.com" }));
vi.mock("@formbricks/mcp-views", () => ({ getViewHtml: vi.fn().mockResolvedValue("<!doctype html>") }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn() })) },
}));

const SURVEY_ID = "clxx1234567890123456789012";

const authInfo = (scopes: string[]) => ({
  token: "oauth:user_1:client_1",
  clientId: "client_1",
  scopes,
  extra: {
    formbricksAuthentication: {
      user: { id: "user_1", email: "person@example.com", name: "Person" },
      expires: "2026-07-01T00:00:00.000Z",
    },
    requestId: "req_tool",
    authMethod: "oauth",
  },
});

const survey = {
  id: SURVEY_ID,
  workspaceId: "clworkspace1",
  name: "Feedback",
  type: "link",
  status: "inProgress",
  updatedAt: "2026-10-27T16:40:12.000Z",
  defaultLanguage: "en-US",
  languages: [{ code: "en-US", default: true, enabled: true }],
  blocks: [
    { name: "One", elements: [{ type: "openText", required: true, headline: { "en-US": "Why?" } }] },
  ],
  endings: [],
};

const previewMeta = { appUrl: "https://surveys.example.com", rendererUrl: "x", surveyUrl: null };

function setup() {
  const tools = new Map<string, { config: Record<string, any>; handler: (input: any, extra: any) => Promise<any> }>();
  const resources: { uri: string; read: () => Promise<any> }[] = [];
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, any>, handler: any) => {
      tools.set(name, { config, handler });
    }),
    registerResource: vi.fn((_title: string, uri: string, _config: unknown, read: () => Promise<any>) => {
      resources.push({ uri, read });
    }),
  };
  registerSurveyPreviewApp(server as any);
  return { tools, resources };
}

describe("show_survey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadSurveyPreviewMeta).mockResolvedValue(previewMeta as never);
  });

  test("is registered as a read-only tool that links the survey-preview view", () => {
    const { tools } = setup();
    const { config } = tools.get("show_survey")!;

    expect(config.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, idempotentHint: true });
    expect(config._meta).toEqual({
      ui: { resourceUri: "ui://formbricks/survey-preview.html" },
      "ui/resourceUri": "ui://formbricks/survey-preview.html",
      "openai/outputTemplate": "ui://formbricks/survey-preview.html",
    });
    expect(Object.keys(config.inputSchema.shape)).toEqual(["surveyId", "lang"]);
    expect(config.outputSchema).toBeDefined();
  });

  test("serves the view with a CSP of the instance origins only", async () => {
    const { resources } = setup();
    const resource = resources.find((entry) => entry.uri === "ui://formbricks/survey-preview.html")!;
    const { contents } = await resource.read();

    expect(contents[0]).toMatchObject({
      mimeType: "text/html;profile=mcp-app",
      _meta: {
        ui: {
          csp: {
            resourceDomains: ["https://surveys.example.com", "https://app.example.com"],
            connectDomains: ["https://surveys.example.com"],
          },
        },
      },
    });
  });

  test("refuses a token without surveys:read before touching any survey", async () => {
    const { tools } = setup();
    const result = await tools
      .get("show_survey")!
      .handler({ surveyId: SURVEY_ID }, { http: { authInfo: authInfo(["surveys:write"]) } });

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403, code: "forbidden" });
    expect(getV3Survey).not.toHaveBeenCalled();
    expect(loadSurveyPreviewMeta).not.toHaveBeenCalled();
  });

  test("reads the survey through the v3 get operation, then adds the summary and the view-only data", async () => {
    const { tools } = setup();
    vi.mocked(getV3Survey).mockResolvedValue(successResponse(survey, { requestId: "req_tool" }));

    const result = await tools
      .get("show_survey")!
      .handler({ surveyId: SURVEY_ID, lang: ["en-US"] }, { http: { authInfo: authInfo(["surveys:read"]) } });

    expect(getV3Survey).toHaveBeenCalledWith(
      expect.objectContaining({ surveyId: SURVEY_ID, lang: ["en-US"], requestId: "req_tool", instance: "/api/mcp" })
    );
    expect(loadSurveyPreviewMeta).toHaveBeenCalledWith({
      surveyId: SURVEY_ID,
      expectedWorkspaceId: "clworkspace1",
      requestId: "req_tool",
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ data: survey, requestId: "req_tool" });
    expect(result._meta).toEqual({ formbricks: previewMeta });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toContain('Showing the survey "Feedback"');
    expect(result.content[0].text).toContain("1. [openText, required] Why?");
  });

  test("keeps the survey when the preview data cannot be built", async () => {
    const { tools } = setup();
    vi.mocked(getV3Survey).mockResolvedValue(successResponse(survey, { requestId: "req_tool" }));
    vi.mocked(loadSurveyPreviewMeta).mockResolvedValue(null);

    const result = await tools
      .get("show_survey")!
      .handler({ surveyId: SURVEY_ID }, { http: { authInfo: authInfo(["surveys:read"]) } });

    expect(result.structuredContent.data).toEqual(survey);
    expect(result).not.toHaveProperty("_meta");
  });

  test("passes the operation's refusal through and loads nothing else", async () => {
    const { tools } = setup();
    vi.mocked(getV3Survey).mockResolvedValue(
      problemForbidden("req_tool", "You are not authorized to access this resource", "/api/mcp")
    );

    const result = await tools
      .get("show_survey")!
      .handler({ surveyId: SURVEY_ID }, { http: { authInfo: authInfo(["surveys:read"]) } });

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403 });
    expect(result).not.toHaveProperty("_meta");
    expect(loadSurveyPreviewMeta).not.toHaveBeenCalled();
  });
});
