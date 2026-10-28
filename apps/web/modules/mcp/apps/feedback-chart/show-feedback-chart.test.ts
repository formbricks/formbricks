import { beforeEach, describe, expect, test, vi } from "vitest";
import { queryV3Feedback } from "@/app/api/v3/feedback-queries/lib/operations";
import { problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import { ZMcpShowFeedbackChartOutput } from "./output-schema";
import { registerFeedbackChartApp } from "./register";
import { ZMcpShowFeedbackChartInput } from "./show-feedback-chart";

vi.mock("@/app/api/v3/feedback-queries/lib/operations", () => ({
  queryV3Feedback: vi.fn(),
  getV3FeedbackFieldCatalog: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn() })) },
}));

vi.mock("@formbricks/mcp-views", () => ({
  VIEW_NAMES: [],
  getViewHtml: vi.fn().mockResolvedValue("<!doctype html>"),
}));

const session = {
  user: { id: "user_1", email: "person@example.com", name: "Person" },
  expires: "2026-07-01T00:00:00.000Z",
};

const authInfoFor = (scopes: string[]) => ({
  token: "oauth:user_1:client_1",
  clientId: "client_1",
  scopes,
  extra: { formbricksAuthentication: session, requestId: "req_tool", authMethod: "oauth" },
});

const workspaceId = "tz4a98xxat96iws9zmbrgj3a";
const datasetId = "ds4a98xxat96iws9zmbrgj3aaa";
const query = { measures: ["FeedbackRecords.count"], dimensions: ["FeedbackRecords.sentiment"] };

type TToolResult = {
  isError?: boolean;
  content: { type: string; text: string }[];
  structuredContent: Record<string, unknown>;
};
type TToolHandler = (input: Record<string, unknown>, extra: unknown) => Promise<TToolResult>;
type TRegisteredResource = {
  name: string;
  uri: string;
  config: Record<string, unknown>;
  read: () => Promise<unknown>;
};

function createServer() {
  const tools = new Map<string, { config: Record<string, unknown>; handler: TToolHandler }>();
  const resources: TRegisteredResource[] = [];
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: TToolHandler) => {
      tools.set(name, { config, handler });
    }),
    registerResource: vi.fn(
      (name: string, uri: string, config: Record<string, unknown>, read: () => Promise<unknown>) => {
        resources.push({ name, uri, config, read });
      }
    ),
  };
  registerFeedbackChartApp(server as unknown as Parameters<typeof registerFeedbackChartApp>[0]);
  return { tools, resources };
}

const callTool = (input: object, scopes: string[] = ["feedbackRecords:read"]) => {
  const { tools } = createServer();
  return tools
    .get("show_feedback_chart")!
    .handler(input as Record<string, unknown>, { http: { authInfo: authInfoFor(scopes) } });
};

const operationData = {
  datasetId,
  datasetName: "Main",
  query: { ...query, limit: 100 },
  rows: [
    { "FeedbackRecords.sentiment": "positive", "FeedbackRecords.count": 7, stray: "dropped" },
    { "FeedbackRecords.sentiment": "negative", "FeedbackRecords.count": 3 },
  ],
};

describe("show_feedback_chart registration", () => {
  test("registers the tool read-only with the view linked through _meta.ui.resourceUri", () => {
    const { tools } = createServer();
    const { config } = tools.get("show_feedback_chart")!;

    expect(config.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    expect(config._meta).toMatchObject({
      ui: { resourceUri: "ui://formbricks/feedback-chart.html" },
      "ui/resourceUri": "ui://formbricks/feedback-chart.html",
      "openai/outputTemplate": "ui://formbricks/feedback-chart.html",
    });
    expect((config._meta as { ui: { visibility?: unknown } }).ui.visibility).toBeUndefined();
  });

  test("serves the view as an MCP App resource that declares no CSP domains", async () => {
    const { resources } = createServer();

    expect(resources).toHaveLength(1);
    expect(resources[0].uri).toBe("ui://formbricks/feedback-chart.html");
    expect(resources[0].config).toMatchObject({ mimeType: "text/html;profile=mcp-app" });
    const read = (await resources[0].read()) as { contents: { mimeType: string; _meta?: unknown }[] };
    expect(read.contents[0].mimeType).toBe("text/html;profile=mcp-app");
    expect(read.contents[0]._meta).toBeUndefined();
  });
});

describe("show_feedback_chart input", () => {
  test("is query_feedback's input plus an optional chart hint, and nothing else", () => {
    expect(ZMcpShowFeedbackChartInput.safeParse({ workspaceId, datasetId, query }).success).toBe(true);
    expect(
      ZMcpShowFeedbackChartInput.safeParse({
        workspaceId,
        query,
        chart: { type: "bar", x: "FeedbackRecords.sentiment", title: "Mood" },
      }).success
    ).toBe(true);
    expect(ZMcpShowFeedbackChartInput.safeParse({ workspaceId, query, tenantId: "x" }).success).toBe(false);
    expect(
      ZMcpShowFeedbackChartInput.safeParse({ workspaceId, query, chart: { type: "radar" } }).success
    ).toBe(false);
    expect(
      ZMcpShowFeedbackChartInput.safeParse({ workspaceId, query, chart: { color: "red" } }).success
    ).toBe(false);
  });

  test("applies the query's own schema: an unknown field is refused", () => {
    expect(
      ZMcpShowFeedbackChartInput.safeParse({ workspaceId, query: { measures: ["FeedbackRecords.nope"] } })
        .success
    ).toBe(false);
  });
});

describe("show_feedback_chart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("runs the query through the same operation with the caller's authentication and no chart hint", async () => {
    vi.mocked(queryV3Feedback).mockResolvedValue(successResponse(operationData, { requestId: "req_tool" }));

    await callTool({ workspaceId, datasetId, query, chart: { type: "pie" } });

    expect(queryV3Feedback).toHaveBeenCalledTimes(1);
    expect(queryV3Feedback).toHaveBeenCalledWith({
      workspaceId,
      datasetId,
      query,
      authentication: session,
      requestId: "req_tool",
      instance: "/api/mcp",
    });
  });

  test("answers a short text with the top rows for the model and structuredContent for the view", async () => {
    vi.mocked(queryV3Feedback).mockResolvedValue(successResponse(operationData, { requestId: "req_tool" }));

    const result = await callTool({ workspaceId, query });

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("shown to the user as a bar chart");
    expect(result.content[0].text).toContain("| positive | 7 |");
    expect(result.structuredContent).toMatchObject({
      datasetId,
      datasetName: "Main",
      query: { ...query, limit: 100 },
      chart: { type: "bar", x: "FeedbackRecords.sentiment", y: ["FeedbackRecords.count"] },
      truncated: false,
      requestId: "req_tool",
    });
    expect(result.structuredContent.columns).toEqual([
      { id: "FeedbackRecords.sentiment", label: "Sentiment", kind: "dimension" },
      { id: "FeedbackRecords.count", label: "Feedback Records", kind: "measure" },
    ]);
    expect(result.structuredContent.rows).toEqual([
      { "FeedbackRecords.sentiment": "positive", "FeedbackRecords.count": 7 },
      { "FeedbackRecords.sentiment": "negative", "FeedbackRecords.count": 3 },
    ]);
  });

  test("structuredContent satisfies the advertised output schema", async () => {
    vi.mocked(queryV3Feedback).mockResolvedValue(successResponse(operationData, { requestId: "req_tool" }));

    const result = await callTool({ workspaceId, query });

    expect(ZMcpShowFeedbackChartOutput.safeParse(result.structuredContent).success).toBe(true);
  });

  test("marks a result that reached the query's limit as truncated", async () => {
    vi.mocked(queryV3Feedback).mockResolvedValue(
      successResponse({ ...operationData, query: { ...query, limit: 2 } }, { requestId: "req_tool" })
    );

    const result = await callTool({ workspaceId, query: { ...query, limit: 2 } });

    expect(result.structuredContent.truncated).toBe(true);
    expect(result.content[0].text).toContain("row limit");
  });

  test("refuses a hint the query cannot draw before the analytics service is asked anything", async () => {
    const result = await callTool({
      workspaceId,
      query,
      chart: { type: "bar", y: "FeedbackRecords.npsScore" },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({
      status: 400,
      invalid_params: [{ name: "chart.y" }],
    });
    expect(queryV3Feedback).not.toHaveBeenCalled();
  });

  test("is refused with a scope other than feedbackRecords:read, without reaching the operation", async () => {
    for (const scopes of [["feedbackRecords:write"], ["surveys:read"], []]) {
      const result = await callTool({ workspaceId, query }, scopes);
      expect(result.isError, scopes.join()).toBe(true);
      expect(result.structuredContent.error).toMatchObject({ status: 403 });
    }
    expect(queryV3Feedback).not.toHaveBeenCalled();
  });

  test("relays an operation refusal, such as the licence gate, unchanged", async () => {
    vi.mocked(queryV3Feedback).mockResolvedValue(
      problemForbidden("req_tool", "Feedback analytics is not enabled for this organization.")
    );

    const result = await callTool({ workspaceId, query });

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({
      status: 403,
      detail: "Feedback analytics is not enabled for this organization.",
    });
  });

  test("answers an internal error rather than a half-built chart when the operation's body is malformed", async () => {
    vi.mocked(queryV3Feedback).mockResolvedValue(
      successResponse({ rows: "nope" }, { requestId: "req_tool" })
    );

    const result = await callTool({ workspaceId, query });

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 500 });
  });
});
