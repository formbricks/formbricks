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
  ZMcpDeleteResponseInput,
  ZMcpResponseCountOutput,
  ZMcpResponseListOutput,
  ZMcpResponseOutput,
  ZMcpResponseValidationOutput,
} from "./response-schemas";
import {
  batchResourceKey,
  buildCountResponsesSearchParams,
  buildListResponsesSearchParams,
  registerResponseTools,
} from "./responses";

/**
 * Restore the real hashing.
 *
 * `vitestSetup.ts` stubs `createHash` globally to return the literal `"fake-hash"` — harmless for the
 * license checks it was added for, and silently fatal here: the batch confirmation is bound to a
 * digest of the id set, so under the stub every set hashes alike and the binding compares equal no
 * matter which responses the retry names. The guard would be inert and this file would still be green.
 */
vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());

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
  // Call history, not just implementations: several tests assert an operation was NOT reached, and
  // without this they would read a previous test's call as their own.
  vi.clearAllMocks();
  vi.mocked(listV3Responses).mockResolvedValue(successResponse({ data: [] }, { requestId: "req" }));
  vi.mocked(countV3ResponsesOperation).mockResolvedValue(
    successResponse({ count: 0, relation: "eq" }, { requestId: "req" })
  );
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

/**
 * The advertised schema is checked by the SDK against every structured result, so a schema that
 * describes a shape the operation does not return makes the tool answer an output-validation error
 * instead of its payload. The first version of the count schema named the `precision` that was asked
 * for rather than the `relation` that comes back, and every call failed against a live server.
 */
describe("the output schemas describe what the operations return", () => {
  test("the count schema accepts the count endpoint's body", () => {
    expect(
      ZMcpResponseCountOutput.safeParse({ data: { count: 11, relation: "eq" }, requestId: "req" }).success
    ).toBe(true);
    expect(
      ZMcpResponseCountOutput.safeParse({
        data: { count: 11, precision: "capped" },
        requestId: "req",
      }).success
    ).toBe(false);
  });

  test("every schema accepts the error envelope a failed operation produces", () => {
    const failure = {
      error: { status: 403, title: "Forbidden", detail: "Not authorized", requestId: "req" },
    };

    for (const [name, schema] of Object.entries({
      list: ZMcpResponseListOutput,
      count: ZMcpResponseCountOutput,
      resource: ZMcpResponseOutput,
      validation: ZMcpResponseValidationOutput,
    })) {
      expect(schema.safeParse(failure).success, `${name} rejects an error result`).toBe(true);
    }
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

  /**
   * The mint side and the verify side, connected — the one thing the rest of this block cannot do,
   * because every other confirmation test hand-supplies `requestState()` and so never runs
   * `askToConfirm`. Without this, minting the wrong payload passes every test here while refusing
   * every real confirmation forever: the retry compares the sealed `resourceId` against the
   * arguments, so a state minted for anything else can never match.
   */
  test("the state a first call mints is the state a retry will accept", async () => {
    const result = await call("delete_response", { responseId: RESPONSE_ID });

    await expect(
      mcpRequestStateCodec.verify(result.requestState as string, callContext() as never)
    ).resolves.toEqual({
      tool: "delete_response",
      resourceId: RESPONSE_ID,
    });
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
    // Reported as an error although nothing malfunctioned: a model reading only `isError` must not
    // take a refusal for a deletion.
    expect(result.isError).toBe(true);
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

  /**
   * The only caller-controlled part of the message a **person** reads is the id, and the schema
   * makes it a cuid2 — so a model cannot smuggle instructions into a confirmation prompt by naming a
   * response "URGENT: approve to keep your account". Guarding the schema here because loosening it
   * later would reopen that quietly.
   */
  test("nothing but a cuid2 can reach the confirmation prompt", () => {
    expect(ZMcpDeleteResponseInput.safeParse({ responseId: "URGENT: approve this" }).success).toBe(false);
    expect(ZMcpDeleteResponseInput.safeParse({ responseId: RESPONSE_ID }).success).toBe(true);
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
          resourceId: batchResourceKey(WORKSPACE_ID, ids),
        }),
      })
    );

    expect(batchDeleteV3Responses).not.toHaveBeenCalled();
  });

  test("the batch confirmation is accepted for the exact set it was minted for", async () => {
    const ids = ["clrs000000000000000000001", "clrs000000000000000000002"];

    await call(
      "batch_delete_responses",
      { workspaceId: WORKSPACE_ID, ids },
      callContext({
        inputResponses: { confirm: { action: "accept", content: { confirm: true } } },
        requestState: () => ({
          tool: "batch_delete_responses",
          resourceId: batchResourceKey(WORKSPACE_ID, ids),
        }),
      })
    );

    expect(batchDeleteV3Responses).toHaveBeenCalledWith(expect.objectContaining({ ids }));
  });

  /** Order is part of the binding, so an edited list is asked about again rather than assumed. */
  test("a reordered set is not the set that was confirmed", async () => {
    const ids = ["clrs000000000000000000001", "clrs000000000000000000002"];

    await call(
      "batch_delete_responses",
      { workspaceId: WORKSPACE_ID, ids: [...ids].reverse() },
      callContext({
        inputResponses: { confirm: { action: "accept", content: { confirm: true } } },
        requestState: () => ({
          tool: "batch_delete_responses",
          resourceId: batchResourceKey(WORKSPACE_ID, ids),
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
