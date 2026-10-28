import { beforeEach, describe, expect, test, vi } from "vitest";
import { getV3FeedbackFieldCatalog, queryV3Feedback } from "@/app/api/v3/feedback-queries/lib/operations";
import { problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import { registerFeedbackQueryTools } from "./feedback-queries";
import { ZMcpGetFeedbackFieldCatalogInput, ZMcpQueryFeedbackInput } from "./feedback-query-schemas";

vi.mock("@/app/api/v3/feedback-queries/lib/operations", () => ({
  queryV3Feedback: vi.fn(),
  getV3FeedbackFieldCatalog: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn() })) },
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
const query = { measures: ["FeedbackRecords.npsScore"], dimensions: ["FeedbackRecords.sentiment"] };

type TToolResult = {
  isError?: boolean;
  structuredContent: { data?: unknown; error?: unknown };
};
type TToolHandler = (input: Record<string, unknown>, extra: unknown) => Promise<TToolResult>;

function createToolServer() {
  const tools = new Map<string, { config: Record<string, unknown>; handler: TToolHandler }>();
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: TToolHandler) => {
      tools.set(name, { config, handler });
    }),
  };
  registerFeedbackQueryTools(server as unknown as Parameters<typeof registerFeedbackQueryTools>[0]);
  return { tools };
}

const call = (
  tools: ReturnType<typeof createToolServer>["tools"],
  name: string,
  input: object,
  scopes: string[]
) => tools.get(name)!.handler(input as Record<string, unknown>, { http: { authInfo: authInfoFor(scopes) } });

describe("registerFeedbackQueryTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("registers exactly the two feedback query tools, both read-only", () => {
    const { tools } = createToolServer();

    expect([...tools.keys()].sort()).toEqual(["get_feedback_field_catalog", "query_feedback"]);
    for (const { config } of tools.values()) {
      expect(config.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    }
  });

  test("query_feedback calls the operation with the caller's authentication and the query as sent", async () => {
    const { tools } = createToolServer();
    const data = {
      datasetId,
      datasetName: "Main",
      query: { ...query, limit: 100 },
      rows: [{ "FeedbackRecords.npsScore": 31 }],
    };
    vi.mocked(queryV3Feedback).mockResolvedValue(successResponse(data, { requestId: "req_tool" }));

    const result = await call(tools, "query_feedback", { workspaceId, datasetId, query }, [
      "feedbackRecords:read",
    ]);

    expect(queryV3Feedback).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        datasetId,
        query,
        authentication: session,
        instance: "/api/mcp",
      })
    );
    expect(result.structuredContent.data).toEqual(data);
  });

  test("get_feedback_field_catalog calls the operation for the workspace", async () => {
    const { tools } = createToolServer();
    vi.mocked(getV3FeedbackFieldCatalog).mockResolvedValue(
      successResponse({ measures: [], dimensions: [] }, { requestId: "req_tool" })
    );

    const result = await call(tools, "get_feedback_field_catalog", { workspaceId }, ["feedbackRecords:read"]);

    expect(getV3FeedbackFieldCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, authentication: session, instance: "/api/mcp" })
    );
    expect(result.isError).toBeFalsy();
  });

  test("both tools are refused with only the write scope or an unrelated one, without reaching the operation", async () => {
    const { tools } = createToolServer();
    const inputs: Record<string, object> = {
      query_feedback: { workspaceId, query },
      get_feedback_field_catalog: { workspaceId },
    };

    for (const scopes of [["feedbackRecords:write"], ["surveys:read"]]) {
      for (const [name, input] of Object.entries(inputs)) {
        const result = await call(tools, name, input, scopes);
        expect(result.isError, `${name} with ${scopes.join()}`).toBe(true);
        expect(result.structuredContent.error, name).toMatchObject({ status: 403 });
      }
    }

    expect(queryV3Feedback).not.toHaveBeenCalled();
    expect(getV3FeedbackFieldCatalog).not.toHaveBeenCalled();
  });

  test("relays an operation refusal, such as the licence gate, unchanged", async () => {
    const { tools } = createToolServer();
    vi.mocked(queryV3Feedback).mockResolvedValue(
      problemForbidden("req_tool", "Feedback analytics is not enabled for this organization.")
    );

    const result = await call(tools, "query_feedback", { workspaceId, query }, ["feedbackRecords:read"]);

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403 });
  });
});

describe("feedback query input schemas", () => {
  test("accept a well-formed query", () => {
    expect(ZMcpQueryFeedbackInput.safeParse({ workspaceId, datasetId, query }).success).toBe(true);
    expect(ZMcpGetFeedbackFieldCatalogInput.safeParse({ workspaceId }).success).toBe(true);
  });

  test("refuse a tenant or any undeclared key at the top level and inside the query", () => {
    expect(ZMcpQueryFeedbackInput.safeParse({ workspaceId, query, tenantId: "x" }).success).toBe(false);
    expect(ZMcpQueryFeedbackInput.safeParse({ workspaceId, query, tenant_id: "x" }).success).toBe(false);
    expect(ZMcpQueryFeedbackInput.safeParse({ workspaceId, query: { ...query, offset: 5 } }).success).toBe(
      false
    );
    expect(ZMcpGetFeedbackFieldCatalogInput.safeParse({ workspaceId, extra: 1 }).success).toBe(false);
  });

  test("refuse a field outside the catalog and an over-limit query", () => {
    expect(
      ZMcpQueryFeedbackInput.safeParse({ workspaceId, query: { measures: ["FeedbackRecords.tenantId"] } })
        .success
    ).toBe(false);
    expect(
      ZMcpQueryFeedbackInput.safeParse({ workspaceId, query: { ...query, limit: 100000 } }).success
    ).toBe(false);
  });
});
