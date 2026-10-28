import { beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import {
  problemForbidden,
  problemServiceUnavailable,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import { buildWorkflowApiContext, workflowsHandlers } from "@/app/api/v3/workflows/lib/context";
import { ZMcpShowWorkflowOutput } from "./output-schema";
import { registerWorkflowApp } from "./register";
import { SHOW_WORKFLOW_RECENT_RUNS_LIMIT, ZMcpShowWorkflowInput } from "./show-workflow";

vi.mock("@formbricks/mcp-views", () => ({ getViewHtml: vi.fn(async () => "<!doctype html><html></html>") }));

vi.mock("@/app/api/v3/workflows/lib/context", () => ({
  buildWorkflowApiContext: vi.fn(() => ({ __ctx: true })),
  workflowsHandlers: { get: vi.fn(), listRuns: vi.fn() },
}));

vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn() })) },
}));

const WORKSPACE_ID = "clxx1234567890123456789012";
const WORKFLOW_ID = "wf1234567890123456789012ab";
const RUN_ID = "run234567890123456789012ab";
const SURVEY_ID = "sv1234567890123456789012ab";
const NOW = "2026-06-09T12:00:00.000Z";

const authentication = { type: "apiKey", apiKeyId: "key_1", organizationId: "org_1" };
const authInfoFor = (scopes: string[]) => ({
  token: "key_1",
  clientId: "key_1",
  scopes,
  extra: { formbricksAuthentication: authentication, requestId: "req_tool" },
});

const workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: "Thank respondents",
  description: null,
  status: "enabled",
  triggerType: "response.completed",
  surveyId: SURVEY_ID,
  createdBy: null,
  creator: null,
  createdAt: NOW,
  updatedAt: NOW,
  lastRun: null,
  runCount: 1,
  definition: {
    schemaVersion: 1,
    trigger: {
      id: "trigger",
      type: "trigger",
      triggerType: "response.completed",
      config: { surveyId: SURVEY_ID, endingCardIds: [] },
    },
    nodes: [
      {
        id: "send-email",
        type: "action",
        actionType: "send_email",
        config: {
          to: "team@example.com",
          from: "noreply@example.com",
          replyTo: [],
          subject: "Thanks",
          body: "<p>Thanks</p>",
          attachResponseData: false,
        },
      },
    ],
    edges: [{ id: "e1", source: "trigger", target: "send-email" }],
    entryNodeId: "trigger",
  },
};

const run = {
  id: RUN_ID,
  workflowId: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  workflowVersionId: null,
  status: "completed",
  isDryRun: false,
  triggerType: "response.completed",
  surveyId: SURVEY_ID,
  responseId: null,
  error: null,
  attempt: 0,
  createdAt: NOW,
  updatedAt: NOW,
  startedAt: NOW,
  finishedAt: NOW,
  workflowName: "Thank respondents",
};

type TToolHandler = (
  input: unknown,
  extra: unknown
) => Promise<{
  isError?: boolean;
  content: { type: string; text: string }[];
  structuredContent: Record<string, unknown>;
}>;

function createServer() {
  const tools = new Map<string, { config: Record<string, unknown>; handler: TToolHandler }>();
  const resources = new Map<
    string,
    { uri: string; config: Record<string, unknown>; read: () => Promise<unknown> }
  >();
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: TToolHandler) => {
      tools.set(name, { config, handler });
    }),
    registerResource: vi.fn(
      (name: string, uri: string, config: Record<string, unknown>, read: () => Promise<unknown>) => {
        resources.set(name, { uri, config, read });
      }
    ),
  };
  registerWorkflowApp(server as unknown as Parameters<typeof registerWorkflowApp>[0]);
  return { server, tools, resources };
}

const callShowWorkflow = (scopes = ["workflows:read"]) => {
  const { tools } = createServer();
  return tools
    .get("show_workflow")!
    .handler({ workflowId: WORKFLOW_ID }, { http: { authInfo: authInfoFor(scopes) } });
};

describe("registerWorkflowApp", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(buildWorkflowApiContext).mockReturnValue({ __ctx: true } as never);
  });

  test("registers the view resource without declaring any CSP domain", async () => {
    const { resources } = createServer();
    const resource = resources.get("Workflow")!;

    expect(resource.uri).toBe("ui://formbricks/workflow.html");
    expect(resource.config).toMatchObject({ mimeType: "text/html;profile=mcp-app" });
    const read = (await resource.read()) as { contents: { mimeType: string; _meta?: unknown }[] };
    expect(read.contents[0].mimeType).toBe("text/html;profile=mcp-app");
    // The view only talks to its host, so the spec's default (no network) CSP must apply.
    expect(read.contents[0]._meta).toBeUndefined();
  });

  test("registers show_workflow as a read-only tool linked to the view", () => {
    const { tools } = createServer();
    const config = tools.get("show_workflow")!.config;

    expect(config).toMatchObject({
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      _meta: {
        ui: { resourceUri: "ui://formbricks/workflow.html" },
        "openai/outputTemplate": "ui://formbricks/workflow.html",
      },
    });
    // The model must be able to call it: no `visibility: ["app"]`.
    expect((config._meta as { ui: Record<string, unknown> }).ui.visibility).toBeUndefined();
  });

  test("advertises an output schema that converts to JSON Schema", () => {
    expect(() => z.toJSONSchema(ZMcpShowWorkflowOutput, { io: "output" })).not.toThrow();
  });

  test("refuses a caller without workflows:read and reads nothing", async () => {
    const result = await callShowWorkflow(["workflows:write"]);

    expect(result.isError).toBe(true);
    expect(workflowsHandlers.get).not.toHaveBeenCalled();
    expect(workflowsHandlers.listRuns).not.toHaveBeenCalled();
  });

  test("reads the workflow once, then one bounded page of its runs in the workflow's workspace", async () => {
    vi.mocked(workflowsHandlers.get).mockResolvedValue(successResponse(workflow, { requestId: "req_tool" }));
    vi.mocked(workflowsHandlers.listRuns).mockResolvedValue(
      successListResponse([run], { limit: 10, nextCursor: null }, { requestId: "req_tool" })
    );

    const result = await callShowWorkflow();

    expect(workflowsHandlers.get).toHaveBeenCalledTimes(1);
    expect(workflowsHandlers.get).toHaveBeenCalledWith({
      ctx: { __ctx: true },
      params: { workflowId: WORKFLOW_ID },
    });
    expect(workflowsHandlers.listRuns).toHaveBeenCalledTimes(1);
    const params = new URL(vi.mocked(workflowsHandlers.listRuns).mock.calls[0][0].req.url).searchParams;
    // The workspace comes from the workflow the get authorized, never from the input.
    expect(params.get("workspaceId")).toBe(WORKSPACE_ID);
    expect(params.get("workflowId")).toBe(WORKFLOW_ID);
    expect(params.get("limit")).toBe(String(SHOW_WORKFLOW_RECENT_RUNS_LIMIT));

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      workflow: { id: WORKFLOW_ID, name: "Thank respondents" },
      recentRuns: [{ id: RUN_ID, status: "completed" }],
      requestId: "req_tool",
    });
    expect(ZMcpShowWorkflowOutput.safeParse(result.structuredContent).success).toBe(true);
    expect(result.content[0].text).toBe(
      `Workflow ${WORKFLOW_ID} is enabled, runs when a survey response is completed, 1 step, last run completed at ${NOW}.`
    );
  });

  test("says so in the text when the workflow has never run", async () => {
    vi.mocked(workflowsHandlers.get).mockResolvedValue(
      successResponse({ ...workflow, status: "draft", triggerType: null }, { requestId: "req_tool" })
    );
    vi.mocked(workflowsHandlers.listRuns).mockResolvedValue(
      successListResponse([], { limit: 10, nextCursor: null }, { requestId: "req_tool" })
    );

    const result = await callShowWorkflow();

    expect(result.content[0].text).toBe(
      `Workflow ${WORKFLOW_ID} is draft, has no trigger yet, 1 step, no runs yet.`
    );
  });

  test("relays a refused workflow read and never lists runs", async () => {
    vi.mocked(workflowsHandlers.get).mockResolvedValue(
      problemForbidden("req_forbidden", "You are not authorized to access this resource", "/api/mcp")
    );

    const result = await callShowWorkflow();

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403, requestId: "req_forbidden" });
    expect(workflowsHandlers.listRuns).not.toHaveBeenCalled();
  });

  test("still shows the workflow when its runs cannot be listed", async () => {
    vi.mocked(workflowsHandlers.get).mockResolvedValue(successResponse(workflow, { requestId: "req_tool" }));
    vi.mocked(workflowsHandlers.listRuns).mockResolvedValue(
      problemServiceUnavailable("req_runs", "The runs store is unavailable.", "/api/mcp")
    );

    const result = await callShowWorkflow();

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      workflow: { id: WORKFLOW_ID },
      recentRuns: [],
      recentRunsError: "The runs store is unavailable.",
    });
    expect(ZMcpShowWorkflowOutput.safeParse(result.structuredContent).success).toBe(true);
    expect(result.content[0].text).toContain("Recent runs unavailable: The runs store is unavailable.");
  });

  test("answers with an error rather than a half-read workflow when the body is not a workflow", async () => {
    vi.mocked(workflowsHandlers.get).mockResolvedValue(
      successResponse({ id: WORKFLOW_ID }, { requestId: "req_tool" })
    );

    const result = await callShowWorkflow();

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 500 });
    expect(workflowsHandlers.listRuns).not.toHaveBeenCalled();
  });
});

describe("ZMcpShowWorkflowInput", () => {
  test("takes a workflow id and nothing else", () => {
    expect(ZMcpShowWorkflowInput.safeParse({ workflowId: WORKFLOW_ID }).success).toBe(true);
    expect(
      ZMcpShowWorkflowInput.safeParse({ workflowId: WORKFLOW_ID, workspaceId: WORKSPACE_ID }).success
    ).toBe(false);
    expect(ZMcpShowWorkflowInput.safeParse({ workflowId: "not an id" }).success).toBe(false);
    expect(ZMcpShowWorkflowInput.safeParse({}).success).toBe(false);
  });
});
