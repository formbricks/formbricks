import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiKeyPermission } from "@formbricks/database/prisma";
import { noContentResponse, successResponse } from "@/app/api/v3/lib/response";
import {
  batchDeleteV3Responses,
  countV3ResponsesOperation,
  createV3ResponseFromRawInput,
  deleteV3Response,
  getV3Response,
  listV3Responses,
  updateV3ResponseFromRawInput,
} from "@/app/api/v3/responses/lib/operations";
import { validateV3ResponseFromRawInput } from "@/app/api/v3/responses/lib/validate-operations";
import { mcpRequestStateCodec } from "../request-state";
import {
  buildCountResponsesSearchParams,
  buildListResponsesSearchParams,
  registerResponseTools,
} from "./responses";

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

const WORKSPACE_ID = "clws000000000000000000001";
const RESPONSE_ID = "clrs000000000000000000001";

const authInfo = {
  token: "key_1",
  clientId: "key_1",
  scopes: ["responses:read", "responses:write"],
  extra: {
    formbricksAuthentication: {
      type: "apiKey" as const,
      apiKeyId: "key_1",
      organizationId: "org_1",
      organizationAccess: { accessControl: { read: true, write: true } },
      workspacePermissions: [
        { workspaceId: WORKSPACE_ID, workspaceName: "W", permission: ApiKeyPermission.manage },
      ],
    },
    requestId: "req_tool",
  },
};

type TRegisteredTool = {
  config: Record<string, unknown>;
  scopes: unknown;
  handler: (input: unknown, ctx: unknown) => Promise<Record<string, unknown>>;
};

function createToolServer() {
  const tools = new Map<string, TRegisteredTool>();
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: never) => {
      tools.set(name, { config, scopes: undefined, handler });
    }),
  };

  registerResponseTools(server as never);

  return tools;
}

/** A `tools/call` context: the verified auth plus the multi-round-trip fields the SDK would add. */
const callContext = (over: Record<string, unknown> = {}) => ({
  http: { authInfo },
  mcpReq: { method: "tools/call", ...over },
});

const call = async (name: string, input: unknown, ctx = callContext()) => {
  const tool = createToolServer().get(name);
  if (!tool) throw new Error(`${name} is not registered`);
  return await tool.handler(input, ctx);
};

beforeEach(() => {
  vi.mocked(listV3Responses).mockResolvedValue(successResponse({ data: [] }, { requestId: "req" }));
  vi.mocked(countV3ResponsesOperation).mockResolvedValue(successResponse({ count: 0 }, { requestId: "req" }));
  vi.mocked(getV3Response).mockResolvedValue(successResponse({ data: {} }, { requestId: "req" }));
  vi.mocked(createV3ResponseFromRawInput).mockResolvedValue(
    successResponse({ data: {} }, { requestId: "req" })
  );
  vi.mocked(updateV3ResponseFromRawInput).mockResolvedValue(
    successResponse({ data: {} }, { requestId: "req" })
  );
  vi.mocked(validateV3ResponseFromRawInput).mockResolvedValue(
    successResponse({ data: { valid: true } }, { requestId: "req" })
  );
  vi.mocked(deleteV3Response).mockResolvedValue(noContentResponse({ requestId: "req" }));
  vi.mocked(batchDeleteV3Responses).mockResolvedValue(
    successResponse({ data: { deleted: 2 } }, { requestId: "req" })
  );
});

/**
 * The tool set is the API's operation set. A tool with no operation behind it is a second surface to
 * document and keep in step; an operation with no tool is a capability an agent cannot reach.
 */
describe("the registered surface", () => {
  test("is exactly one tool per v3 response operation", () => {
    expect([...createToolServer().keys()].sort()).toEqual(
      [
        "batch_delete_responses",
        "count_responses",
        "create_response",
        "delete_response",
        "get_response",
        "list_responses",
        "update_response",
        "validate_response",
      ].sort()
    );
  });

  test("every tool advertises the shape of its result", () => {
    for (const [name, tool] of createToolServer()) {
      expect(tool.config.outputSchema, `${name} has no outputSchema`).toBeDefined();
    }
  });

  /** A model that counts feedback records to answer "how many responses" undercounts silently. */
  test("the two tools that can be confused with feedback records say so in full", () => {
    const tools = createToolServer();

    for (const name of ["list_responses", "count_responses"]) {
      expect(tools.get(name)?.config.description).toContain("undercounts");
    }

    for (const [name, tool] of tools) {
      expect(String(tool.config.description), `${name} omits the boundary`).toMatch(/feedback record/i);
    }
  });

  test("every destructive tool is annotated as destructive", () => {
    const tools = createToolServer();

    for (const name of ["delete_response", "batch_delete_responses", "update_response"]) {
      expect(tools.get(name)?.config.annotations).toMatchObject({ destructiveHint: true });
    }
  });
});

/**
 * The gate is structural — `registerScopedTool` runs it before the handler — so these prove the
 * scope each tool declares rather than that a gate exists at all.
 */
describe("the scope gate", () => {
  const withScopes = (scopes: string[]) =>
    ({ http: { authInfo: { ...authInfo, scopes } }, mcpReq: { method: "tools/call" } }) as never;

  test("a survey-scoped token reaches no response tool", async () => {
    for (const name of createToolServer().keys()) {
      const result = await call(
        name,
        { responseId: RESPONSE_ID },
        withScopes(["surveys:read", "surveys:write"])
      );
      expect(result.isError, `${name} answered a surveys-scoped token`).toBe(true);
    }

    expect(listV3Responses).not.toHaveBeenCalled();
    expect(deleteV3Response).not.toHaveBeenCalled();
  });

  test("a read-only token reads but cannot write, validate or delete", async () => {
    const readOnly = withScopes(["responses:read"]);

    await call("list_responses", { workspaceId: WORKSPACE_ID, limit: 20 }, readOnly);
    expect(listV3Responses).toHaveBeenCalled();

    for (const name of [
      "create_response",
      "update_response",
      "validate_response",
      "delete_response",
      "batch_delete_responses",
    ]) {
      const result = await call(name, { responseId: RESPONSE_ID, confirm: true }, readOnly);
      expect(result.isError, `${name} answered a read-only token`).toBe(true);
    }

    expect(createV3ResponseFromRawInput).not.toHaveBeenCalled();
    expect(updateV3ResponseFromRawInput).not.toHaveBeenCalled();
    expect(validateV3ResponseFromRawInput).not.toHaveBeenCalled();
    expect(deleteV3Response).not.toHaveBeenCalled();
    expect(batchDeleteV3Responses).not.toHaveBeenCalled();
  });
});

describe("query building", () => {
  test("list filters reach the v3 query in its bracket spelling", () => {
    const params = buildListResponsesSearchParams({
      workspaceId: WORKSPACE_ID,
      surveyId: "clsv000000000000000000001",
      limit: 50,
      cursor: "cursor_1",
      includeTotalCount: true,
      sortBy: "createdAt",
      createdAtGte: "2026-09-01T00:00:00.000Z",
      finished: false,
      language: ["de-DE", "en-US"],
    } as never);

    expect(params.get("workspaceId")).toBe(WORKSPACE_ID);
    expect(params.get("limit")).toBe("50");
    expect(params.get("cursor")).toBe("cursor_1");
    expect(params.get("includeTotalCount")).toBe("true");
    expect(params.get("sortBy")).toBe("createdAt");
    expect(params.get("filter[createdAt][gte]")).toBe("2026-09-01T00:00:00.000Z");
    expect(params.get("filter[finished][eq]")).toBe("false");
    expect(params.getAll("filter[language][in]")).toEqual(["de-DE", "en-US"]);
  });

  /** The count is only meaningful if it counts the same rows the list would return. */
  test("the count carries the same filters and none of the paging", () => {
    const filters = {
      workspaceId: WORKSPACE_ID,
      surveyId: "clsv000000000000000000001",
      createdAtLte: "2026-09-30T00:00:00.000Z",
      finished: true,
      language: ["de-DE"],
    };

    const list = buildListResponsesSearchParams({ ...filters, limit: 20 } as never);
    const count = buildCountResponsesSearchParams({ ...filters, precision: "exact" } as never);

    for (const key of [
      "workspaceId",
      "surveyId",
      "filter[createdAt][lte]",
      "filter[finished][eq]",
      "filter[language][in]",
    ]) {
      expect(count.getAll(key), key).toEqual(list.getAll(key));
    }

    expect(count.get("precision")).toBe("exact");
    expect(count.has("limit")).toBe(false);
    expect(count.has("cursor")).toBe(false);
  });

  test("an absent filter is absent from the query rather than sent empty", () => {
    const params = buildListResponsesSearchParams({ workspaceId: WORKSPACE_ID, limit: 20 } as never);

    expect(params.has("surveyId")).toBe(false);
    expect(params.has("filter[finished][eq]")).toBe(false);
    expect(params.has("includeTotalCount")).toBe(false);
  });
});

describe("delete confirmation", () => {
  test("a first call asks instead of deleting", async () => {
    const result = await call("delete_response", { responseId: RESPONSE_ID });

    expect(deleteV3Response).not.toHaveBeenCalled();
    expect(result.resultType).toBe("input_required");
    expect(result.requestState).toEqual(expect.any(String));
  });

  test("an in-band confirmation deletes without asking", async () => {
    const result = await call("delete_response", { responseId: RESPONSE_ID, confirm: true });

    expect(deleteV3Response).toHaveBeenCalledWith(expect.objectContaining({ responseId: RESPONSE_ID }));
    expect(result.resultType).toBeUndefined();
  });

  test("a declined prompt deletes nothing and is not reported as a failure", async () => {
    const result = await call(
      "delete_response",
      { responseId: RESPONSE_ID },
      callContext({
        inputResponses: { confirm: { action: "decline" } },
        requestState: () => ({ tool: "delete_response", resourceId: RESPONSE_ID }),
      })
    );

    expect(deleteV3Response).not.toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
    expect(JSON.stringify(result.structuredContent)).toContain("not confirmed");
  });

  /**
   * The state and the arguments both come back through the client, so a confirmation about one
   * response must not authorize the deletion of another.
   */
  test("a confirmation minted for another response is refused", async () => {
    const result = await call(
      "delete_response",
      { responseId: RESPONSE_ID },
      callContext({
        inputResponses: { confirm: { action: "accept", content: { confirm: true } } },
        requestState: () => ({ tool: "delete_response", resourceId: "clrsffffffffffffffffffff" }),
      })
    );

    expect(deleteV3Response).not.toHaveBeenCalled();
    expect(JSON.stringify(result.structuredContent)).toContain("did not match");
  });

  test("a confirmation minted for the other delete tool is refused", async () => {
    const result = await call(
      "delete_response",
      { responseId: RESPONSE_ID },
      callContext({
        inputResponses: { confirm: { action: "accept", content: { confirm: true } } },
        requestState: () => ({ tool: "batch_delete_responses", resourceId: RESPONSE_ID }),
      })
    );

    expect(deleteV3Response).not.toHaveBeenCalled();
    expect(JSON.stringify(result.structuredContent)).toContain("did not match");
  });

  test("an accepted confirmation for this response deletes it", async () => {
    await call(
      "delete_response",
      { responseId: RESPONSE_ID },
      callContext({
        inputResponses: { confirm: { action: "accept", content: { confirm: true } } },
        requestState: () => ({ tool: "delete_response", resourceId: RESPONSE_ID }),
      })
    );

    expect(deleteV3Response).toHaveBeenCalledWith(expect.objectContaining({ responseId: RESPONSE_ID }));
  });

  /** A confirmation for two ids must not carry over to a third. */
  test("the batch confirmation is bound to the exact id set", async () => {
    const ids = ["clrs000000000000000000001", "clrs000000000000000000002"];

    await call(
      "batch_delete_responses",
      { workspaceId: WORKSPACE_ID, ids: [...ids, "clrs000000000000000000003"] },
      callContext({
        inputResponses: { confirm: { action: "accept", content: { confirm: true } } },
        requestState: () => ({
          tool: "batch_delete_responses",
          resourceId: `${WORKSPACE_ID}:${ids.join(",")}`,
        }),
      })
    );

    expect(batchDeleteV3Responses).not.toHaveBeenCalled();
  });

  test("the batch tool deletes the whole set once confirmed", async () => {
    const ids = ["clrs000000000000000000001", "clrs000000000000000000002"];

    await call("batch_delete_responses", { workspaceId: WORKSPACE_ID, ids, confirm: true });

    expect(batchDeleteV3Responses).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: WORKSPACE_ID, ids })
    );
  });
});

/**
 * The seal is what makes the `resourceId` comparison meaningful: without it a client could author
 * any state it liked. Verified through the codec itself rather than asserted structurally.
 */
describe("the confirmation state is sealed", () => {
  const codecContext = { http: { authInfo }, mcpReq: { method: "tools/call" } } as never;

  test("a minted state round-trips for the same caller", async () => {
    const minted = await mcpRequestStateCodec.mint(
      { tool: "delete_response", resourceId: RESPONSE_ID },
      codecContext
    );

    await expect(mcpRequestStateCodec.verify(minted, codecContext)).resolves.toEqual({
      tool: "delete_response",
      resourceId: RESPONSE_ID,
    });
  });

  test("a state another caller minted is rejected", async () => {
    const minted = await mcpRequestStateCodec.mint(
      { tool: "delete_response", resourceId: RESPONSE_ID },
      codecContext
    );

    const otherCaller = {
      http: { authInfo: { ...authInfo, token: "key_2" } },
      mcpReq: { method: "tools/call" },
    } as never;

    await expect(mcpRequestStateCodec.verify(minted, otherCaller)).rejects.toThrow();
  });

  test("a tampered state is rejected", async () => {
    const minted = await mcpRequestStateCodec.mint(
      { tool: "delete_response", resourceId: RESPONSE_ID },
      codecContext
    );
    const [version, body, mac] = minted.split(".");
    const forged = [
      version,
      Buffer.from(
        JSON.stringify({ p: { tool: "delete_response", resourceId: "clrsffffffffffffffffffff" } })
      ).toString("base64url"),
      mac,
    ].join(".");

    expect(forged).not.toBe(minted);
    expect(body).toEqual(expect.any(String));
    await expect(mcpRequestStateCodec.verify(forged, codecContext)).rejects.toThrow();
  });
});

describe("the tools reach the operations", () => {
  test("reads pass the derived request id and the MCP instance through", async () => {
    await call("get_response", { responseId: RESPONSE_ID });

    expect(getV3Response).toHaveBeenCalledWith(
      expect.objectContaining({
        responseId: RESPONSE_ID,
        requestId: "req_tool",
        instance: "/api/mcp",
      })
    );
  });

  test("create and update hand the operation the raw document", async () => {
    await call("create_response", { data: { surveyId: "clsv000000000000000000001" } });
    expect(createV3ResponseFromRawInput).toHaveBeenCalledWith(
      expect.objectContaining({ body: { surveyId: "clsv000000000000000000001" } })
    );

    await call("update_response", { responseId: RESPONSE_ID, data: { finished: true } });
    expect(updateV3ResponseFromRawInput).toHaveBeenCalledWith(
      expect.objectContaining({ responseId: RESPONSE_ID, body: { finished: true } })
    );
  });

  test("validate passes the whole discriminated envelope", async () => {
    await call("validate_response", { operation: "create", data: { surveyId: "s" } });

    expect(validateV3ResponseFromRawInput).toHaveBeenCalledWith(
      expect.objectContaining({ body: { operation: "create", data: { surveyId: "s" } } })
    );
  });
});
