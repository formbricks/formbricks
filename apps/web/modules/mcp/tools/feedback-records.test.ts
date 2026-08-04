import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiKeyPermission } from "@formbricks/database/prisma";
import {
  countV3FeedbackRecords,
  createV3FeedbackRecord,
  createV3FeedbackRecords,
  deleteV3FeedbackRecord,
  findSimilarV3FeedbackRecords,
  getV3FeedbackRecord,
  listV3FeedbackDatasets,
  listV3FeedbackRecords,
  searchV3FeedbackRecords,
  updateV3FeedbackRecord,
} from "@/app/api/v3/feedbackRecords/lib/operations";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { MCP_AUDIT_API_URL } from "@/modules/mcp/constants";
import {
  noContentResponse,
  problemBadRequest,
  problemForbidden,
  successListResponse,
  successResponse,
} from "@/app/api/v3/lib/response";
import { registerFeedbackRecordTools } from "./feedback-records";

vi.mock("@/app/api/v3/feedbackRecords/lib/operations", () => ({
  countV3FeedbackRecords: vi.fn(),
  createV3FeedbackRecord: vi.fn(),
  createV3FeedbackRecords: vi.fn(),
  deleteV3FeedbackRecord: vi.fn(),
  findSimilarV3FeedbackRecords: vi.fn(),
  getV3FeedbackRecord: vi.fn(),
  listV3FeedbackDatasets: vi.fn(),
  listV3FeedbackRecords: vi.fn(),
  searchV3FeedbackRecords: vi.fn(),
  updateV3FeedbackRecord: vi.fn(),
}));

vi.mock("@/app/api/v3/lib/audit", () => ({
  buildV3AuditLog: vi.fn(),
  queueV3AuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })) },
}));

const recordId = "019fa338-f494-7384-b34e-01739783d280";

const workspaceId = "clxx1234567890123456789012";
const directoryId = "clfd1234567890123456789012";

const apiKeyAuth = {
  type: "apiKey" as const,
  apiKeyId: "key_1",
  organizationId: "org_1",
  organizationAccess: { accessControl: { read: true, write: true } },
  workspacePermissions: [{ workspaceId, workspaceName: "Workspace", permission: ApiKeyPermission.write }],
};

const authInfo = {
  token: "key_1",
  clientId: "key_1",
  scopes: ["feedbackRecords:read", "feedbackRecords:write"],
  extra: { formbricksAuthentication: apiKeyAuth, requestId: "req_tool" },
};

const readOnlyAuthInfo = { ...authInfo, scopes: ["feedbackRecords:read"] };
const noFeedbackScopeAuthInfo = { ...authInfo, scopes: ["surveys:read", "surveys:write"] };

function createToolServer() {
  const tools = new Map<
    string,
    { config: Record<string, unknown>; handler: (input: any, extra: any) => Promise<any> }
  >();
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: any) => {
      tools.set(name, { config, handler });
    }),
  };
  registerFeedbackRecordTools(server as any);
  return { server, tools };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registerFeedbackRecordTools", () => {
  test("registers the ten feedback-record tools in order", () => {
    const { tools } = createToolServer();
    expect(Array.from(tools.keys())).toEqual([
      "list_feedback_datasets",
      "list_feedback_records",
      "count_feedback_records",
      "get_feedback_record",
      "create_feedback_record",
      "create_feedback_records",
      "update_feedback_record",
      "delete_feedback_record",
      "search_feedback_records",
      "find_similar_feedback_records",
    ]);
  });

  test("marks read tools read-only and create as a non-idempotent write", () => {
    const { tools } = createToolServer();
    expect(tools.get("list_feedback_records")!.config.annotations).toMatchObject({
      readOnlyHint: true,
      idempotentHint: true,
    });
    expect(tools.get("create_feedback_record")!.config.annotations).toMatchObject({
      readOnlyHint: false,
      idempotentHint: false,
    });
  });

  // The destructive hint is what lets a client warn (or ask) before an irreversible call, so it is pinned:
  // delete is the only tool here that removes data, and the searches must not be mistaken for writes.
  test("marks update destructive too, matching patch_survey", () => {
    const { tools } = createToolServer();
    expect(tools.get("update_feedback_record")!.config.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    });
  });

  test("marks delete destructive, and both searches as read-only", () => {
    const { tools } = createToolServer();
    expect(tools.get("delete_feedback_record")!.config.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    });
    for (const name of ["search_feedback_records", "find_similar_feedback_records"]) {
      expect(tools.get(name)!.config.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      });
    }
  });
});

describe("list_feedback_datasets", () => {
  test("delegates to listV3FeedbackDatasets and returns structured content", async () => {
    vi.mocked(listV3FeedbackDatasets).mockResolvedValue(
      successListResponse(
        [{ id: directoryId, name: "Support" }],
        { nextCursor: null, totalCount: 1 },
        {
          requestId: "req_tool",
        }
      )
    );
    const { tools } = createToolServer();

    const result = await tools.get("list_feedback_datasets")!.handler({ workspaceId }, { authInfo });

    expect(listV3FeedbackDatasets).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, authentication: apiKeyAuth, instance: "/api/mcp" })
    );
    expect(result.structuredContent.data).toEqual([{ id: directoryId, name: "Support" }]);
  });
});

describe("list_feedback_records", () => {
  test("passes filters through to listV3FeedbackRecords", async () => {
    vi.mocked(listV3FeedbackRecords).mockResolvedValue(
      successListResponse([], { limit: 25, nextCursor: null }, { requestId: "req_tool" })
    );
    const { tools } = createToolServer();

    await tools
      .get("list_feedback_records")!
      .handler(
        { workspaceId, datasetId: directoryId, limit: 25, source_type: "survey", field_type: "text" },
        { authInfo }
      );

    expect(listV3FeedbackRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        datasetId: directoryId,
        limit: 25,
        source_type: "survey",
        field_type: "text",
      })
    );
  });

  test("returns an insufficient-scope error and skips the op without the read scope", async () => {
    const { tools } = createToolServer();

    const result = await tools
      .get("list_feedback_records")!
      .handler({ workspaceId }, { authInfo: noFeedbackScopeAuthInfo });

    expect(result.isError).toBe(true);
    expect(listV3FeedbackRecords).not.toHaveBeenCalled();
  });
});

describe("get_feedback_record", () => {
  test("delegates to getV3FeedbackRecord with the record id", async () => {
    vi.mocked(getV3FeedbackRecord).mockResolvedValue(
      successResponse({ id: "rec-1" }, { requestId: "req_tool" })
    );
    const { tools } = createToolServer();

    await tools
      .get("get_feedback_record")!
      .handler({ workspaceId, feedbackRecordId: recordId }, { authInfo });

    expect(getV3FeedbackRecord).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, feedbackRecordId: recordId })
    );
  });
});

describe("create_feedback_record", () => {
  const body = {
    workspaceId,
    source_type: "call_notes",
    field_id: "note",
    field_type: "text",
    value_text: "hi",
  };

  test("delegates with body, builds and queues the audit log, and marks success", async () => {
    const auditLog = { status: "attempted" } as any;
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog);
    vi.mocked(createV3FeedbackRecord).mockResolvedValue(
      successResponse({ id: "rec-1" }, { requestId: "req_tool", status: 201 })
    );
    const { tools } = createToolServer();

    await tools.get("create_feedback_record")!.handler(body, { authInfo });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "created", "feedbackRecord", MCP_AUDIT_API_URL);
    expect(createV3FeedbackRecord).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, body, authentication: apiKeyAuth })
    );
    expect(auditLog.status).toBe("success");
    expect(queueV3AuditLog).toHaveBeenCalled();
  });

  test("requires the write scope", async () => {
    const { tools } = createToolServer();

    const result = await tools.get("create_feedback_record")!.handler(body, { authInfo: readOnlyAuthInfo });

    expect(result.isError).toBe(true);
    expect(createV3FeedbackRecord).not.toHaveBeenCalled();
  });

  // The invariant is "a failed mutation is never silently unaudited" — including when the operation throws
  // rather than returning a problem response. Without this the catch branch is unguarded.
  test("still queues a failure audit event when the operation throws, and rethrows", async () => {
    const auditLog = { status: "failure" } as any;
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog);
    vi.mocked(createV3FeedbackRecord).mockRejectedValue(new Error("boom"));
    const { tools } = createToolServer();

    await expect(tools.get("create_feedback_record")!.handler(body, { authInfo })).rejects.toThrow("boom");

    expect(auditLog.eventId).toBe("req_tool");
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.anything());
  });

  // buildAuditLogBaseObject seeds status:"failure"; a failed create must keep that and carry an eventId
  // for correlation. The operations layer intentionally no longer sets eventId (this layer does), so this
  // is the only guard on that invariant.
  test("queues a failure audit event with an eventId when the create fails", async () => {
    const auditLog = { status: "failure" } as any;
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog);
    vi.mocked(createV3FeedbackRecord).mockResolvedValue(
      problemBadRequest("req_tool", "rejected", { instance: "/api/mcp" })
    );
    const { tools } = createToolServer();

    const result = await tools.get("create_feedback_record")!.handler(body, { authInfo });

    expect(result.isError).toBe(true);
    expect(auditLog.status).toBe("failure");
    expect(auditLog.eventId).toBe("req_tool");
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.anything());
  });
});

describe("delete_feedback_record", () => {
  const input = { workspaceId, feedbackRecordId: recordId, datasetId: directoryId };

  test("delegates to deleteV3FeedbackRecord and audits the deletion as a success", async () => {
    const auditLog = { status: "failure" } as any;
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog);
    vi.mocked(deleteV3FeedbackRecord).mockResolvedValue(noContentResponse({ requestId: "req_tool" }));
    const { tools } = createToolServer();

    const result = await tools.get("delete_feedback_record")!.handler(input, { authInfo });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "deleted", "feedbackRecord", MCP_AUDIT_API_URL);
    expect(deleteV3FeedbackRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        feedbackRecordId: recordId,
        datasetId: directoryId,
        authentication: apiKeyAuth,
        auditLog,
      })
    );
    expect(auditLog.status).toBe("success");
    expect(queueV3AuditLog).toHaveBeenCalled();
    // A 204 carries no body; the tool result must still read as a success, not an error.
    expect(result.isError).toBeUndefined();
  });

  // A read-only key must not be able to destroy data — the single most important guard on this tool.
  test("requires the write scope and never reaches the operation", async () => {
    const { tools } = createToolServer();

    const result = await tools.get("delete_feedback_record")!.handler(input, { authInfo: readOnlyAuthInfo });

    expect(result.isError).toBe(true);
    expect(deleteV3FeedbackRecord).not.toHaveBeenCalled();
  });

  test("queues a failure audit event with an eventId when the delete is refused", async () => {
    const auditLog = { status: "failure" } as any;
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog);
    vi.mocked(deleteV3FeedbackRecord).mockResolvedValue(
      problemForbidden("req_tool", "You are not authorized to access this feedback record", "/api/mcp")
    );
    const { tools } = createToolServer();

    const result = await tools.get("delete_feedback_record")!.handler(input, { authInfo });

    expect(result.isError).toBe(true);
    expect(auditLog.status).toBe("failure");
    expect(auditLog.eventId).toBe("req_tool");
    expect(queueV3AuditLog).toHaveBeenCalledWith(auditLog, "req_tool", expect.anything());
  });
});

describe("search_feedback_records", () => {
  test("passes the query and similarity params through", async () => {
    vi.mocked(searchV3FeedbackRecords).mockResolvedValue(
      successListResponse(
        [{ feedback_record_id: recordId, score: 0.82, field_label: "Q1", value_text: "slow checkout" }],
        { limit: 10, nextCursor: null, minScore: 0.5 },
        { requestId: "req_tool" }
      )
    );
    const { tools } = createToolServer();

    const result = await tools
      .get("search_feedback_records")!
      .handler({ workspaceId, query: "checkout is confusing", limit: 5, minScore: 0.6 }, { authInfo });

    expect(searchV3FeedbackRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        query: "checkout is confusing",
        limit: 5,
        minScore: 0.6,
        authentication: apiKeyAuth,
        instance: "/api/mcp",
      })
    );
    expect(result.structuredContent.data).toEqual([
      { feedback_record_id: recordId, score: 0.82, field_label: "Q1", value_text: "slow checkout" },
    ]);
  });

  test("requires the read scope", async () => {
    const { tools } = createToolServer();

    const result = await tools
      .get("search_feedback_records")!
      .handler({ workspaceId, query: "anything" }, { authInfo: noFeedbackScopeAuthInfo });

    expect(result.isError).toBe(true);
    expect(searchV3FeedbackRecords).not.toHaveBeenCalled();
  });
});

describe("find_similar_feedback_records", () => {
  test("delegates to findSimilarV3FeedbackRecords with the anchor record id", async () => {
    vi.mocked(findSimilarV3FeedbackRecords).mockResolvedValue(
      successListResponse([], { limit: 10, nextCursor: null, minScore: 0.5 }, { requestId: "req_tool" })
    );
    const { tools } = createToolServer();

    await tools
      .get("find_similar_feedback_records")!
      .handler({ workspaceId, feedbackRecordId: recordId, minScore: 0.9 }, { authInfo });

    expect(findSimilarV3FeedbackRecords).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, feedbackRecordId: recordId, minScore: 0.9 })
    );
  });

  test("requires the read scope", async () => {
    const { tools } = createToolServer();

    const result = await tools
      .get("find_similar_feedback_records")!
      .handler({ workspaceId, feedbackRecordId: recordId }, { authInfo: noFeedbackScopeAuthInfo });

    expect(result.isError).toBe(true);
    expect(findSimilarV3FeedbackRecords).not.toHaveBeenCalled();
  });
});

describe("count_feedback_records", () => {
  test("passes the filters through and returns the count", async () => {
    vi.mocked(countV3FeedbackRecords).mockResolvedValue(
      successResponse(
        { count: 7, dataset_id: directoryId, dataset_name: "Support" },
        { requestId: "req_tool" }
      )
    );
    const { tools } = createToolServer();

    const result = await tools
      .get("count_feedback_records")!
      .handler({ workspaceId, user_id: "user-1", field_type: "text" }, { authInfo });

    expect(countV3FeedbackRecords).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, user_id: "user-1", field_type: "text", instance: "/api/mcp" })
    );
    expect(result.structuredContent.data.count).toBe(7);
  });

  test("requires the read scope", async () => {
    const { tools } = createToolServer();

    const result = await tools
      .get("count_feedback_records")!
      .handler({ workspaceId }, { authInfo: noFeedbackScopeAuthInfo });

    expect(result.isError).toBe(true);
    expect(countV3FeedbackRecords).not.toHaveBeenCalled();
  });
});

describe("create_feedback_records", () => {
  const records = [
    { source_type: "call_notes", field_id: "note", field_type: "text", value_text: "one" },
    { source_type: "call_notes", field_id: "note", field_type: "text", value_text: "two" },
  ];
  const input = { workspaceId, records };

  test("requires the write scope", async () => {
    const { tools } = createToolServer();

    const result = await tools.get("create_feedback_records")!.handler(input, { authInfo: readOnlyAuthInfo });

    expect(result.isError).toBe(true);
    expect(createV3FeedbackRecords).not.toHaveBeenCalled();
  });

  // One creation is one audit event, so a batch of N creations must be N events — not one summary event
  // that loses which records were written.
  test("queues one success audit event per created record", async () => {
    const built: any[] = [];
    vi.mocked(buildV3AuditLog).mockImplementation(() => {
      const auditLog = { status: "failure" } as any;
      built.push(auditLog);
      return auditLog;
    });
    vi.mocked(createV3FeedbackRecords).mockImplementation(async ({ auditLogs }: any) => {
      // Stand in for the operation: it stamps only the records it actually created.
      auditLogs[0].targetId = "rec-1";
      return successListResponse([{ id: "rec-1" }], { created: 1, failed: 1 }, { requestId: "req_tool" });
    });
    const { tools } = createToolServer();

    await tools.get("create_feedback_records")!.handler(input, { authInfo });

    expect(built).toHaveLength(2);
    expect(queueV3AuditLog).toHaveBeenCalledTimes(1);
    expect(built[0].status).toBe("success");
    expect(built[1].status).toBe("failure");
  });

  test("still queues a failure event when the batch operation throws, and rethrows", async () => {
    const built: any[] = [];
    vi.mocked(buildV3AuditLog).mockImplementation(() => {
      const auditLog = { status: "failure" } as any;
      built.push(auditLog);
      return auditLog;
    });
    vi.mocked(createV3FeedbackRecords).mockRejectedValue(new Error("boom"));
    const { tools } = createToolServer();

    await expect(tools.get("create_feedback_records")!.handler(input, { authInfo })).rejects.toThrow("boom");

    expect(queueV3AuditLog).toHaveBeenCalledTimes(1);
    expect(built[0].eventId).toBe("req_tool");
  });

  test("queues a single failure event when nothing was created", async () => {
    const built: any[] = [];
    vi.mocked(buildV3AuditLog).mockImplementation(() => {
      const auditLog = { status: "failure" } as any;
      built.push(auditLog);
      return auditLog;
    });
    vi.mocked(createV3FeedbackRecords).mockResolvedValue(
      problemBadRequest("req_tool", "rejected", { instance: "/api/mcp" })
    );
    const { tools } = createToolServer();

    const result = await tools.get("create_feedback_records")!.handler(input, { authInfo });

    expect(result.isError).toBe(true);
    expect(queueV3AuditLog).toHaveBeenCalledTimes(1);
    expect(built[0].eventId).toBe("req_tool");
  });
});

describe("update_feedback_record", () => {
  const input = { workspaceId, feedbackRecordId: recordId, value_text: "corrected" };

  test("delegates with the whole input as the body and audits as an update", async () => {
    const auditLog = { status: "failure" } as any;
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog);
    vi.mocked(updateV3FeedbackRecord).mockResolvedValue(
      successResponse({ id: recordId, value_text: "corrected" }, { requestId: "req_tool" })
    );
    const { tools } = createToolServer();

    await tools.get("update_feedback_record")!.handler(input, { authInfo });

    expect(buildV3AuditLog).toHaveBeenCalledWith(apiKeyAuth, "updated", "feedbackRecord", MCP_AUDIT_API_URL);
    expect(updateV3FeedbackRecord).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, feedbackRecordId: recordId, body: input, auditLog })
    );
    expect(auditLog.status).toBe("success");
  });

  test("requires the write scope", async () => {
    const { tools } = createToolServer();

    const result = await tools.get("update_feedback_record")!.handler(input, { authInfo: readOnlyAuthInfo });

    expect(result.isError).toBe(true);
    expect(updateV3FeedbackRecord).not.toHaveBeenCalled();
  });
});
