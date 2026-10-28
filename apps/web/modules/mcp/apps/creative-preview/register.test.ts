import { beforeEach, describe, expect, test, vi } from "vitest";
import { getV3Creative } from "@/app/api/v3/creatives/lib/operations";
import { problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import { getActionClasses } from "@/lib/actionClass/service";
import { getWorkspace } from "@/lib/workspace/service";
import { compileCreativeCustomCss } from "@/modules/ee/creatives/lib/custom-css";
import { ZMcpCreativeOutput } from "../../tools/creative-output-schemas";
import {
  actionIds,
  creativeId,
  makeBanner,
  makeFeedbackButton,
  otherWorkspaceId,
  surveyId,
  workspaceId,
} from "./fixtures";
import { registerCreativePreviewApp } from "./register";

vi.mock("@/app/api/v3/creatives/lib/operations", () => ({ getV3Creative: vi.fn() }));
vi.mock("@/lib/workspace/service", () => ({ getWorkspace: vi.fn() }));
vi.mock("@/lib/actionClass/service", () => ({ getActionClasses: vi.fn() }));
vi.mock("@/modules/ee/creatives/lib/custom-css", () => ({
  compileCreativeCustomCss: vi.fn(),
  getCreativeCssRoot: vi.fn(),
}));
vi.mock("@/app/api/v3/lib/audit", () => ({
  buildV3AuditLog: vi.fn(),
  queueV3AuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@formbricks/mcp-views", () => ({
  getViewHtml: vi.fn().mockResolvedValue("<!doctype html><title>view</title>"),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { warn: vi.fn(), withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn() })) },
}));

const authInfoFor = (scopes: string[]) => ({
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

type TFormbricksMeta = {
  style: { element: unknown; button: unknown; customCss: unknown };
  styleIsExact: boolean;
  triggerNames: string[] | null;
};
type TToolConfig = {
  _meta?: unknown;
  annotations?: unknown;
  outputSchema?: unknown;
  inputSchema: { safeParse: (value: unknown) => { success: boolean } };
};
type TToolResult = {
  isError?: boolean;
  content: { type: string; text: string }[];
  structuredContent: Record<string, unknown>;
  _meta?: { formbricks?: TFormbricksMeta };
};
type TToolHandler = (input: unknown, extra: unknown) => Promise<TToolResult>;
type TResourceReader = () => Promise<{ contents: Record<string, unknown>[] }>;

function createServer() {
  const tools = new Map<string, { config: TToolConfig; handler: TToolHandler }>();
  const resources: { title: string; uri: string; config: Record<string, unknown>; read: TResourceReader }[] =
    [];
  const server = {
    registerTool: vi.fn((name: string, config: TToolConfig, handler: TToolHandler) => {
      tools.set(name, { config, handler });
    }),
    registerResource: vi.fn(
      (title: string, uri: string, config: Record<string, unknown>, read: TResourceReader) => {
        resources.push({ title, uri, config, read });
      }
    ),
  };
  registerCreativePreviewApp(server as unknown as Parameters<typeof registerCreativePreviewApp>[0]);
  return { tools, resources };
}

const call = (input: unknown = { creativeId }, scopes: string[] = ["surveys:read"]) =>
  createServer()
    .tools.get("show_creative")!
    .handler(input, { http: { authInfo: authInfoFor(scopes) } });

const respondWith = (creative: object) =>
  vi.mocked(getV3Creative).mockResolvedValue(successResponse(creative, { requestId: "req_op" }));

const workspace = (styling: Record<string, unknown>) =>
  ({ id: workspaceId, styling: { allowStyleOverwrite: false, ...styling } }) as unknown as Awaited<
    ReturnType<typeof getWorkspace>
  >;

describe("the creative preview view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWorkspace).mockResolvedValue(workspace({ buttonBgColor: { light: "#0f766e" } }));
    vi.mocked(getActionClasses).mockResolvedValue([]);
    vi.mocked(compileCreativeCustomCss).mockResolvedValue(null);
  });

  test("serves the view at ui://formbricks/creative-preview.html under the default CSP", async () => {
    const { resources } = createServer();

    expect(resources).toHaveLength(1);
    expect(resources[0].uri).toBe("ui://formbricks/creative-preview.html");
    expect(resources[0].config).toMatchObject({ mimeType: "text/html;profile=mcp-app" });

    const { contents } = await resources[0].read();
    expect(contents[0]).toMatchObject({
      uri: "ui://formbricks/creative-preview.html",
      mimeType: "text/html;profile=mcp-app",
    });
    // No `_meta.ui`: the host applies the default CSP, so the view can reach no domain.
    expect(contents[0]).not.toHaveProperty("_meta");
  });

  test("registers exactly show_creative, linked to the view and read-only", () => {
    const { tools } = createServer();

    expect([...tools.keys()]).toEqual(["show_creative"]);
    const { config } = tools.get("show_creative")!;
    expect(config._meta).toEqual({
      ui: { resourceUri: "ui://formbricks/creative-preview.html" },
      "ui/resourceUri": "ui://formbricks/creative-preview.html",
      "openai/outputTemplate": "ui://formbricks/creative-preview.html",
    });
    expect(config.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    // The same output as get_creative: the view reads the creative from `structuredContent.data`.
    expect(config.outputSchema).toBe(ZMcpCreativeOutput);
    expect(config.inputSchema.safeParse({ creativeId }).success).toBe(true);
    expect(config.inputSchema.safeParse({ creativeId, extra: true }).success).toBe(false);
  });
});

describe("show_creative", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWorkspace).mockResolvedValue(workspace({ buttonBgColor: { light: "#0f766e" } }));
    vi.mocked(getActionClasses).mockResolvedValue([]);
    vi.mocked(compileCreativeCustomCss).mockResolvedValue(null);
  });

  test("is refused without the surveys:read scope and reads nothing", async () => {
    const result = await call({ creativeId }, ["surveys:write"]);

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403 });
    expect(getV3Creative).not.toHaveBeenCalled();
    expect(getWorkspace).not.toHaveBeenCalled();
  });

  test("reads the creative through the v3 operation as the caller", async () => {
    respondWith(makeFeedbackButton());

    await call();

    expect(getV3Creative).toHaveBeenCalledTimes(1);
    expect(getV3Creative).toHaveBeenCalledWith(
      expect.objectContaining({
        creativeId,
        instance: "/api/mcp",
        authentication: expect.objectContaining({ user: expect.objectContaining({ id: "user_1" }) }),
      })
    );
  });

  test("answers with a text summary, the creative as get_creative returns it, and the resolved look", async () => {
    const creative = makeFeedbackButton();
    respondWith(creative);

    const result = await call();

    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([
      {
        type: "text",
        text: `Creative ${creative.id} (feedback button) is active. Shows on every page view. It opens survey ${surveyId} as a popup.`,
      },
    ]);
    expect(result.structuredContent).toEqual({ data: creative, requestId: "req_op" });
    expect(result._meta?.formbricks).toMatchObject({
      styleIsExact: true,
      triggerNames: null,
      // The survey button of this workspace's Look & Feel is what a feedback button starts from.
      style: { element: { light: { backgroundColor: "#0f766e" } }, button: null },
    });
  });

  test("a banner's look carries the survey button for its own button", async () => {
    respondWith(makeBanner());

    const result = await call();

    expect(result._meta?.formbricks?.style).toMatchObject({
      button: { light: { backgroundColor: "#0f766e" } },
    });
  });

  test("reads the workspace styling and action names only for the creative's own workspace", async () => {
    const creative = makeBanner({
      distribution: {
        showOn: "action",
        triggers: actionIds.map((actionClassId) => ({ actionClassId })),
        conditions: null,
        displayPercentage: null,
      },
    });
    respondWith(creative);
    vi.mocked(getActionClasses).mockResolvedValue([
      { id: actionIds[1], name: "Cart abandoned" },
      { id: "cla21234567890123456789012", name: "Not linked" },
      { id: actionIds[0], name: "Exit intent" },
    ] as unknown as Awaited<ReturnType<typeof getActionClasses>>);

    // The caller names no workspace at all: only the creative id.
    const result = await call({ creativeId });

    expect(getWorkspace).toHaveBeenCalledWith(workspaceId);
    expect(getWorkspace).not.toHaveBeenCalledWith(otherWorkspaceId);
    expect(getActionClasses).toHaveBeenCalledWith(workspaceId);
    expect(result._meta?.formbricks?.triggerNames).toEqual(["Exit intent", "Cart abandoned"]);
    expect(result.content[0].text).toContain("Shows when one of its 2 actions fires.");
    expect(result.content[0].text).not.toContain("Exit intent");
  });

  test("does not look up actions for a creative shown on page views", async () => {
    respondWith(makeBanner());

    await call();

    expect(getActionClasses).not.toHaveBeenCalled();
  });

  test("compiles the creative's own custom CSS only while its custom styles are on", async () => {
    const theme = (customStyles: boolean) => ({
      ...makeFeedbackButton().styling.theme,
      customStyles,
      customCss: { light: ".fb-creative-button{opacity:.5}", dark: null },
    });
    const compiled = { light: "@layer fb-survey{.fb-creative-button{opacity:.5!important}}" };
    vi.mocked(compileCreativeCustomCss).mockResolvedValue(compiled);

    respondWith(makeFeedbackButton({ styling: { ...makeFeedbackButton().styling, theme: theme(true) } }));
    const on = await call();
    expect(compileCreativeCustomCss).toHaveBeenCalledWith("feedbackButton", {
      light: ".fb-creative-button{opacity:.5}",
      dark: null,
    });
    expect(on._meta?.formbricks?.style.customCss).toEqual(compiled);

    vi.mocked(compileCreativeCustomCss).mockClear();
    respondWith(makeFeedbackButton({ styling: { ...makeFeedbackButton().styling, theme: theme(false) } }));
    const off = await call();
    expect(compileCreativeCustomCss).not.toHaveBeenCalled();
    expect(off._meta?.formbricks?.style.customCss).toBeNull();
  });

  test("still answers, with a neutral look flagged as approximate, when the workspace cannot be read", async () => {
    respondWith(makeBanner());
    vi.mocked(getWorkspace).mockRejectedValue(new Error("database down"));

    const result = await call();

    expect(result.isError).toBeUndefined();
    expect(result._meta?.formbricks?.styleIsExact).toBe(false);
    expect(result._meta?.formbricks?.style.element).toBeDefined();
  });

  test("still answers with action counts when the action names cannot be read", async () => {
    respondWith(
      makeBanner({
        distribution: {
          showOn: "action",
          triggers: [{ actionClassId: actionIds[0] }],
          conditions: null,
          displayPercentage: null,
        },
      })
    );
    vi.mocked(getActionClasses).mockRejectedValue(new Error("database down"));

    const result = await call();

    expect(result._meta?.formbricks?.triggerNames).toBeNull();
    expect(result.content[0].text).toContain("when its action fires");
  });

  test("relays a refusal from the operation untouched and reads nothing else", async () => {
    vi.mocked(getV3Creative).mockResolvedValue(
      problemForbidden("req_op", "You are not authorized to access this resource", "/api/mcp")
    );

    const result = await call();

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403 });
    expect(result._meta).toBeUndefined();
    expect(getWorkspace).not.toHaveBeenCalled();
    expect(getActionClasses).not.toHaveBeenCalled();
  });
});
