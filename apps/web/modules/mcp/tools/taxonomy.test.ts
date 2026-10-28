import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { noContentResponse, problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import { getV3EnrichmentStatus } from "@/app/api/v3/unify-feedback/enrichment-status/lib/operations";
import {
  getV3TaxonomyNodeRecordCounts,
  getV3TaxonomyNodeRecords,
  getV3TaxonomyRun,
  getV3TaxonomyState,
  listV3TaxonomyFields,
  removeV3TaxonomyNode,
  renameV3TaxonomyNode,
  triggerV3TaxonomyRun,
} from "@/app/api/v3/unify-feedback/taxonomy/lib/operations";
import { registerTaxonomyTools } from "./taxonomy";
import {
  ZMcpGetTaxonomyStateInput,
  ZMcpListTaxonomyNodeRecordsInput,
  ZMcpStartTaxonomyRunInput,
} from "./taxonomy-schemas";

vi.mock("@/app/api/v3/unify-feedback/taxonomy/lib/operations", () => ({
  listV3TaxonomyFields: vi.fn(),
  getV3TaxonomyState: vi.fn(),
  getV3TaxonomyRun: vi.fn(),
  getV3TaxonomyNodeRecordCounts: vi.fn(),
  getV3TaxonomyNodeRecords: vi.fn(),
  triggerV3TaxonomyRun: vi.fn(),
  renameV3TaxonomyNode: vi.fn(),
  removeV3TaxonomyNode: vi.fn(),
}));

vi.mock("@/app/api/v3/unify-feedback/enrichment-status/lib/operations", () => ({
  getV3EnrichmentStatus: vi.fn(),
}));

vi.mock("@/app/api/v3/lib/audit", () => ({
  buildV3AuditLog: vi.fn(),
  queueV3AuditLog: vi.fn().mockResolvedValue(undefined),
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

const readAuthInfo = authInfoFor(["feedbackRecords:read"]);
const writeAuthInfo = authInfoFor(["feedbackRecords:write"]);

const workspaceId = "tz4a98xxat96iws9zmbrgj3a";
const directoryId = "kj4a98xxat96iws9zmbrgj3a";
const runId = "0b8f6c2e-3f9a-4f6e-9a55-6d1a1d7c1f10";
const nodeId = "7d2f1c9a-4b6e-4c1f-8a30-2f5d9e3b7a41";

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
  registerTaxonomyTools(server as unknown as Parameters<typeof registerTaxonomyTools>[0]);
  return { tools };
}

const base = { workspaceId, directoryId };

/** Every tool with the smallest input that passes its schema, and the operation it must reach. */
const READ_TOOLS: Record<string, { input: Record<string, unknown>; operation: ReturnType<typeof vi.fn> }> = {
  list_taxonomy_fields: { input: base, operation: vi.mocked(listV3TaxonomyFields) },
  get_taxonomy_state: {
    input: { ...base, scopeType: "directory" },
    operation: vi.mocked(getV3TaxonomyState),
  },
  get_taxonomy_run: { input: { ...base, runId }, operation: vi.mocked(getV3TaxonomyRun) },
  get_taxonomy_record_counts: {
    input: { ...base, runId },
    operation: vi.mocked(getV3TaxonomyNodeRecordCounts),
  },
  list_taxonomy_node_records: { input: { ...base, nodeId }, operation: vi.mocked(getV3TaxonomyNodeRecords) },
  get_enrichment_status: { input: { workspaceId }, operation: vi.mocked(getV3EnrichmentStatus) },
};

const WRITE_TOOLS: Record<string, { input: Record<string, unknown>; operation: ReturnType<typeof vi.fn> }> = {
  start_taxonomy_run: {
    input: { ...base, scopeType: "directory" },
    operation: vi.mocked(triggerV3TaxonomyRun),
  },
  rename_taxonomy_node: {
    input: { ...base, nodeId, label: "Pricing" },
    operation: vi.mocked(renameV3TaxonomyNode),
  },
  remove_taxonomy_node: { input: { ...base, nodeId }, operation: vi.mocked(removeV3TaxonomyNode) },
};

describe("registerTaxonomyTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildV3AuditLog).mockReturnValue(undefined);
  });

  test("registers exactly the nine taxonomy tools", () => {
    const { tools } = createToolServer();
    expect([...tools.keys()].sort()).toEqual(
      [...Object.keys(READ_TOOLS), ...Object.keys(WRITE_TOOLS)].sort()
    );
  });

  test("marks the reads read-only and only the removal destructive", () => {
    const { tools } = createToolServer();
    for (const name of Object.keys(READ_TOOLS)) {
      expect(tools.get(name)!.config.annotations, name).toMatchObject({ readOnlyHint: true });
    }
    expect(tools.get("rename_taxonomy_node")!.config.annotations).toMatchObject({ destructiveHint: false });
    expect(tools.get("remove_taxonomy_node")!.config.annotations).toMatchObject({ destructiveHint: true });
  });

  test("every read tool reaches its operation with the caller's authentication", async () => {
    const { tools } = createToolServer();

    for (const [name, { input, operation }] of Object.entries(READ_TOOLS)) {
      operation.mockResolvedValue(successResponse({ ok: name }, { requestId: "req_tool" }));
      const result = await tools.get(name)!.handler(input, { http: { authInfo: readAuthInfo } });

      expect(operation, name).toHaveBeenCalledWith(
        expect.objectContaining({ ...input, authentication: session, instance: "/api/mcp" })
      );
      expect(result.structuredContent.data, name).toEqual({ ok: name });
    }
  });

  test("every write tool is refused with only a read scope, without reaching its operation", async () => {
    const { tools } = createToolServer();

    for (const [name, { input, operation }] of Object.entries(WRITE_TOOLS)) {
      const result = await tools.get(name)!.handler(input, { http: { authInfo: readAuthInfo } });
      expect(result.isError, name).toBe(true);
      expect(result.structuredContent.error, name).toMatchObject({ status: 403 });
      expect(operation, name).not.toHaveBeenCalled();
    }
  });

  test("every read tool is refused with only a write scope, without reaching its operation", async () => {
    const { tools } = createToolServer();

    for (const [name, { input, operation }] of Object.entries(READ_TOOLS)) {
      const result = await tools.get(name)!.handler(input, { http: { authInfo: writeAuthInfo } });
      expect(result.isError, name).toBe(true);
      expect(result.structuredContent.error, name).toMatchObject({ status: 403 });
      expect(operation, name).not.toHaveBeenCalled();
    }
  });

  test("a refused write is recorded as a failed audit event", async () => {
    const { tools } = createToolServer();
    vi.mocked(buildV3AuditLog).mockReturnValue({} as ReturnType<typeof buildV3AuditLog>);

    await tools
      .get("remove_taxonomy_node")!
      .handler({ ...base, nodeId }, { http: { authInfo: readAuthInfo } });

    expect(buildV3AuditLog).toHaveBeenCalledWith(session, "deleted", "feedbackDirectory", expect.any(String));
    expect(queueV3AuditLog).toHaveBeenCalled();
  });

  test("start_taxonomy_run passes an audit log to the operation and queues it", async () => {
    const { tools } = createToolServer();
    vi.mocked(triggerV3TaxonomyRun).mockResolvedValue(
      successResponse({ run: { id: runId }, inProgress: false }, { requestId: "req_tool" })
    );

    const result = await tools
      .get("start_taxonomy_run")!
      .handler({ ...base, scopeType: "directory" }, { http: { authInfo: writeAuthInfo } });

    expect(triggerV3TaxonomyRun).toHaveBeenCalledWith(
      expect.objectContaining({ ...base, scopeType: "directory", authentication: session })
    );
    expect(buildV3AuditLog).toHaveBeenCalledWith(session, "created", "feedbackDirectory", expect.any(String));
    expect(queueV3AuditLog).toHaveBeenCalled();
    expect(result.structuredContent.data).toEqual({ run: { id: runId }, inProgress: false });
  });

  test("remove_taxonomy_node answers an acknowledgement for the operation's 204", async () => {
    const { tools } = createToolServer();
    vi.mocked(removeV3TaxonomyNode).mockResolvedValue(noContentResponse({ requestId: "req_tool" }));

    const result = await tools
      .get("remove_taxonomy_node")!
      .handler({ ...base, nodeId }, { http: { authInfo: writeAuthInfo } });

    expect(result.isError).toBeFalsy();
    expect(removeV3TaxonomyNode).toHaveBeenCalledWith(expect.objectContaining({ ...base, nodeId }));
  });

  test("relays an operation refusal unchanged", async () => {
    const { tools } = createToolServer();
    vi.mocked(renameV3TaxonomyNode).mockResolvedValue(problemForbidden("req_tool", "Not allowed"));

    const result = await tools
      .get("rename_taxonomy_node")!
      .handler({ ...base, nodeId, label: "Pricing" }, { http: { authInfo: writeAuthInfo } });

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403, detail: "Not allowed" });
  });
});

describe("taxonomy input schemas", () => {
  test("a field scope without its field is refused, a directory scope without one is not", () => {
    expect(ZMcpGetTaxonomyStateInput.safeParse({ ...base }).success).toBe(false);
    expect(
      ZMcpGetTaxonomyStateInput.safeParse({ ...base, sourceType: "survey", fieldId: "q1" }).success
    ).toBe(true);
    expect(ZMcpStartTaxonomyRunInput.safeParse({ ...base, scopeType: "directory" }).success).toBe(true);
  });

  test("the empty string is a valid source id: it is the no-source bucket", () => {
    expect(
      ZMcpStartTaxonomyRunInput.safeParse({ ...base, sourceType: "csv", sourceId: "", fieldId: "q1" }).success
    ).toBe(true);
  });

  test("an undeclared key, such as a tenant id, is rejected instead of dropped", () => {
    expect(
      ZMcpStartTaxonomyRunInput.safeParse({ ...base, scopeType: "directory", tenant_id: "x" }).success
    ).toBe(false);
  });

  test("node records default to a small page and cap at 50", () => {
    expect(ZMcpListTaxonomyNodeRecordsInput.parse({ ...base, nodeId }).limit).toBe(20);
    expect(ZMcpListTaxonomyNodeRecordsInput.safeParse({ ...base, nodeId, limit: 51 }).success).toBe(false);
  });
});
