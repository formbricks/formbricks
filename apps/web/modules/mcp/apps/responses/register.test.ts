import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiKeyPermission } from "@formbricks/database/prisma";
import { problemForbidden, successListResponse } from "@/app/api/v3/lib/response";
import { listV3Responses } from "@/app/api/v3/responses/lib/operations";
import { registerResponsesApp } from "./register";
import { ZMcpShowResponsesInput, ZMcpShowResponsesOutput, ZMcpShowResponsesViewMeta } from "./schemas";

vi.mock("@/app/api/v3/responses/lib/operations", () => ({
  batchDeleteV3Responses: vi.fn(),
  countV3ResponsesOperation: vi.fn(),
  createV3ResponseFromRawInput: vi.fn(),
  deleteV3Response: vi.fn(),
  getV3Response: vi.fn(),
  listV3Responses: vi.fn(),
  updateV3ResponseFromRawInput: vi.fn(),
}));
vi.mock("@/app/api/v3/responses/lib/validate-operations", () => ({
  validateV3ResponseFromRawInput: vi.fn(),
}));
vi.mock("@/app/api/v3/lib/audit", () => ({
  buildV3AuditLog: vi.fn(),
  queueV3AuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })) },
}));
vi.mock("@formbricks/mcp-views", () => ({
  VIEW_NAMES: [],
  getViewHtml: () => Promise.resolve("<html></html>"),
}));

const WORKSPACE_ID = "clws000000000000000000001";
const SURVEY_ID = "clsv000000000000000000001";

const authInfoFor = (scopes: string[]) => ({
  token: "key_1",
  clientId: "key_1",
  scopes,
  extra: {
    formbricksAuthentication: {
      type: "apiKey" as const,
      apiKeyId: "key_1",
      organizationId: "org_1",
      organizationAccess: { accessControl: { read: true, write: true } },
      workspacePermissions: [
        { workspaceId: WORKSPACE_ID, workspaceName: "W", permission: ApiKeyPermission.read },
      ],
    },
    requestId: "req_tool",
  },
});

type TRegisteredTool = {
  config: Record<string, unknown>;
  handler: (input: unknown, ctx: unknown) => Promise<TShowResult>;
};

type TShowResult = {
  isError?: boolean;
  content: { text: string }[];
  structuredContent: { rowCount?: number; error?: unknown } & Record<string, unknown>;
  _meta?: { formbricks?: { rows: { cells: Record<string, string> }[] } & Record<string, unknown> };
};

function register() {
  const tools = new Map<string, TRegisteredTool>();
  type TResourceRead = () => Promise<{ contents: Record<string, unknown>[] }>;
  const resources: { name: string; uri: string; config: Record<string, unknown>; read: TResourceRead }[] = [];
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: never) => {
      tools.set(name, { config, handler });
    }),
    registerResource: vi.fn(
      (name: string, uri: string, config: Record<string, unknown>, read: TResourceRead) => {
        resources.push({ name, uri, config, read });
      }
    ),
  };
  registerResponsesApp(server as never);
  return { tools, resources, server };
}

const listItem = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  surveyId: SURVEY_ID,
  surveyName: "Customer satisfaction",
  workspaceId: WORKSPACE_ID,
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-01T10:00:00.000Z",
  finished: true,
  endingId: null,
  language: "en",
  resolution: {
    labelPolicy: "currentSurveyDefinition",
    labelsLanguage: "en",
    surveyUpdatedAt: "2026-02-01T00:00:00.000Z",
  },
  answers: [
    {
      position: 1,
      elementId: "q1",
      elementType: "openText",
      elementLabel: "What did you like?",
      valueText: "RESPONDENT-FREE-TEXT",
    },
  ],
  embeddedData: [],
  unresolved: [],
  tags: [],
  ...over,
});

const call = async (input: unknown, scopes = ["responses:read"]) => {
  const { tools } = register();
  const tool = tools.get("show_responses");
  if (!tool) throw new Error("show_responses is not registered");
  return await tool.handler(input, { http: { authInfo: authInfoFor(scopes) } });
};

const input = { workspaceId: WORKSPACE_ID, surveyId: SURVEY_ID, limit: 20, sortBy: "-createdAt" };

describe("registerResponsesApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("registers the view with the spec's default CSP and exactly one tool", () => {
    const { tools, resources } = register();
    expect([...tools.keys()]).toEqual(["show_responses"]);
    expect(resources).toHaveLength(1);
    expect(resources[0]?.uri).toBe("ui://formbricks/responses.html");
    expect(resources[0]?.config.mimeType).toBe("text/html;profile=mcp-app");
  });

  test("the resource read declares no extra domains: the view makes no connection of its own", async () => {
    const { resources } = register();
    const { contents } = await resources[0]!.read();
    expect(contents[0]).not.toHaveProperty("_meta");
    expect(contents[0]?.text).toBe("<html></html>");
  });

  test("the tool links to the view and is a read-only, repeatable read", () => {
    const { tools } = register();
    const config = tools.get("show_responses")!.config;
    expect(config._meta).toMatchObject({
      ui: { resourceUri: "ui://formbricks/responses.html" },
      "ui/resourceUri": "ui://formbricks/responses.html",
      "openai/outputTemplate": "ui://formbricks/responses.html",
    });
    expect(config.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    });
  });
});

describe("show_responses input", () => {
  test("takes list_responses' filters, requires the survey and refuses paging and unknown keys", () => {
    expect(ZMcpShowResponsesInput.safeParse({ workspaceId: WORKSPACE_ID, surveyId: SURVEY_ID }).success).toBe(
      true
    );
    expect(ZMcpShowResponsesInput.safeParse({ workspaceId: WORKSPACE_ID }).success).toBe(false);
    expect(
      ZMcpShowResponsesInput.safeParse({
        workspaceId: WORKSPACE_ID,
        surveyId: SURVEY_ID,
        finished: false,
        createdAtGte: "2026-03-01T00:00:00.000Z",
        language: ["en"],
        sortBy: "createdAt",
        limit: 50,
      }).success
    ).toBe(true);
    expect(
      ZMcpShowResponsesInput.safeParse({ workspaceId: WORKSPACE_ID, surveyId: SURVEY_ID, limit: 51 }).success
    ).toBe(false);
    expect(
      ZMcpShowResponsesInput.safeParse({ workspaceId: WORKSPACE_ID, surveyId: SURVEY_ID, cursor: "x" })
        .success
    ).toBe(false);
    expect(
      ZMcpShowResponsesInput.safeParse({ workspaceId: WORKSPACE_ID, surveyId: SURVEY_ID, extra: 1 }).success
    ).toBe(false);
  });
});

describe("show_responses handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("lists through the same v3 operation as list_responses, with the caller's authentication and the total requested", async () => {
    vi.mocked(listV3Responses).mockResolvedValue(
      successListResponse([listItem("clrs000000000000000000001")], {
        limit: 20,
        nextCursor: null,
        totalCount: 1,
        totalCountRelation: "eq",
      })
    );

    await call({ ...input, finished: true, createdAtGte: "2026-03-01T00:00:00.000Z" });

    const [params] = vi.mocked(listV3Responses).mock.calls[0]!;
    expect(params.authentication).toMatchObject({ type: "apiKey", organizationId: "org_1" });
    expect(params.instance).toBe("/api/mcp");
    expect(params.searchParams.get("workspaceId")).toBe(WORKSPACE_ID);
    expect(params.searchParams.get("surveyId")).toBe(SURVEY_ID);
    expect(params.searchParams.get("includeTotalCount")).toBe("true");
    expect(params.searchParams.get("filter[finished][eq]")).toBe("true");
    expect(params.searchParams.get("filter[createdAt][gte]")).toBe("2026-03-01T00:00:00.000Z");
    expect(params.searchParams.has("cursor")).toBe(false);
  });

  test("answers a short summary for the model and keeps the answers in the view-only _meta", async () => {
    vi.mocked(listV3Responses).mockResolvedValue(
      successListResponse(
        [
          listItem("clrs000000000000000000001"),
          listItem("clrs000000000000000000002", { finished: false, surveyName: "HOSTILE-SURVEY-NAME" }),
        ],
        {
          limit: 20,
          nextCursor: "next-page",
          totalCount: 41,
          totalCountRelation: "eq",
        }
      )
    );

    const result = await call(input);

    expect(result.isError).toBeUndefined();
    const summary = result.content[0]!.text;
    expect(summary).toContain("Showing 2 of 41 responses");

    // What the model can read: counts and ids, never an answer, a label or a name.
    expect(result.structuredContent).toMatchObject({
      survey: { id: SURVEY_ID },
      rowCount: 2,
      columnCount: 1,
      nextCursor: "next-page",
      total: { count: 41, relation: "eq" },
      requestId: "req_tool",
    });
    const modelVisible = JSON.stringify({
      content: result.content,
      structuredContent: result.structuredContent,
    });
    for (const hidden of [
      "RESPONDENT-FREE-TEXT",
      "What did you like?",
      "Customer satisfaction",
      "HOSTILE-SURVEY-NAME",
    ]) {
      expect(modelVisible).not.toContain(hidden);
    }
    expect(ZMcpShowResponsesOutput.safeParse(result.structuredContent).success).toBe(true);

    // What only the view reads.
    const viewMeta = result._meta?.formbricks;
    expect(viewMeta?.rows).toHaveLength(2);
    expect(viewMeta?.rows[0]?.cells).toEqual({ q1: "RESPONDENT-FREE-TEXT" });
    expect(viewMeta).toMatchObject({
      survey: { name: "Customer satisfaction" },
      columns: [{ id: "q1", label: "What did you like?", type: "openText", position: 1 }],
    });
    expect(ZMcpShowResponsesViewMeta.safeParse(viewMeta).success).toBe(true);
  });

  test("an empty survey still answers a valid result", async () => {
    vi.mocked(listV3Responses).mockResolvedValue(
      successListResponse([], { limit: 20, nextCursor: null, totalCount: 0, totalCountRelation: "eq" })
    );
    const result = await call(input);
    expect(result.content[0]!.text).toContain("No responses match");
    expect(result.structuredContent.rowCount).toBe(0);
    expect(result._meta?.formbricks?.rows).toEqual([]);
    expect(ZMcpShowResponsesOutput.safeParse(result.structuredContent).success).toBe(true);
  });

  test("passes an operation refusal through unchanged, with no view data", async () => {
    vi.mocked(listV3Responses).mockResolvedValue(problemForbidden("req_tool"));
    const result = await call(input);
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403 });
    expect(result.structuredContent).not.toHaveProperty("rowCount");
    expect(result._meta).toBeUndefined();
  });

  test("is refused without the responses:read scope and never reaches the operation", async () => {
    const result = await call(input, ["surveys:read", "responses:write"]);
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403 });
    expect(listV3Responses).not.toHaveBeenCalled();
  });

  test("answers an error rather than a malformed view when the operation's body is not a list", async () => {
    vi.mocked(listV3Responses).mockResolvedValue(Response.json({ data: "nope", meta: {} }));
    const result = await call(input);
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 500 });
  });
});
