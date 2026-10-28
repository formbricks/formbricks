import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TV3DocumentAdapter } from "@/app/api/v3/documents/lib/envelope";
import { getDocumentAdapter } from "@/app/api/v3/documents/lib/registry";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import { registerDocumentTools } from "./documents";

vi.mock("@/app/api/v3/documents/lib/registry", () => ({ getDocumentAdapter: vi.fn() }));

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

const id = "kj4a98xxat96iws9zmbrgj3a";
const updatedAt = "2026-10-28T12:00:00.000Z";
const envelope = {
  kind: "survey",
  schemaVersion: 1,
  id,
  workspaceId: "ws1",
  updatedAt,
  document: { name: "S" },
};

type TToolResult = { isError?: boolean; structuredContent: { data?: unknown; error?: unknown } };
type TToolHandler = (input: Record<string, unknown>, extra: unknown) => Promise<TToolResult>;

function createToolServer() {
  const tools = new Map<string, { config: Record<string, unknown>; handler: TToolHandler }>();
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: TToolHandler) => {
      tools.set(name, { config, handler });
    }),
  };
  registerDocumentTools(server as unknown as Parameters<typeof registerDocumentTools>[0]);
  return { tools };
}

const adapters = {
  survey: { kind: "survey", targetType: "survey", pull: vi.fn(), push: vi.fn() },
  creative: { kind: "creative", targetType: "creative", pull: vi.fn(), push: vi.fn() },
  workflow: { kind: "workflow", targetType: "workflow", pull: vi.fn(), push: vi.fn() },
} satisfies Record<string, TV3DocumentAdapter>;

const pushInput = (kind: keyof typeof adapters, overrides: Record<string, unknown> = {}) => ({
  kind,
  id,
  schemaVersion: 1,
  expectedUpdatedAt: updatedAt,
  document: { name: "S" },
  ...overrides,
});

describe("document tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDocumentAdapter).mockImplementation((kind) => adapters[kind]);
    vi.mocked(buildV3AuditLog).mockReturnValue({} as ReturnType<typeof buildV3AuditLog>);
  });

  test("registers exactly pull_document and push_document", () => {
    const { tools } = createToolServer();
    expect([...tools.keys()].sort()).toEqual(["pull_document", "push_document"]);
    expect(tools.get("pull_document")!.config.annotations).toMatchObject({ readOnlyHint: true });
    expect(tools.get("push_document")!.config.annotations).toMatchObject({ destructiveHint: true });
  });

  test("pull returns the adapter's envelope for the kind it was asked for", async () => {
    const { tools } = createToolServer();
    adapters.workflow.pull.mockResolvedValue(
      successResponse({ ...envelope, kind: "workflow" }, { requestId: "req_tool" })
    );

    const result = await tools
      .get("pull_document")!
      .handler({ kind: "workflow", id }, { http: { authInfo: authInfoFor(["workflows:read"]) } });

    expect(adapters.workflow.pull).toHaveBeenCalledWith(
      expect.objectContaining({ id, authentication: session, instance: "/api/mcp" })
    );
    expect(adapters.survey.pull).not.toHaveBeenCalled();
    expect(result.structuredContent.data).toMatchObject({ kind: "workflow" });
  });

  test("pull needs the kind's own read scope, not just any read scope", async () => {
    const { tools } = createToolServer();
    const cases: Array<[keyof typeof adapters, string[]]> = [
      ["survey", ["workflows:read"]],
      ["creative", ["workflows:read"]],
      ["workflow", ["surveys:read"]],
    ];

    for (const [kind, scopes] of cases) {
      const result = await tools
        .get("pull_document")!
        .handler({ kind, id }, { http: { authInfo: authInfoFor(scopes) } });
      expect(result.isError, kind).toBe(true);
      expect(result.structuredContent.error, kind).toMatchObject({ status: 403 });
      expect(adapters[kind].pull, kind).not.toHaveBeenCalled();
    }
  });

  test("creatives ride on the survey scopes", async () => {
    const { tools } = createToolServer();
    adapters.creative.pull.mockResolvedValue(
      successResponse({ ...envelope, kind: "creative" }, { requestId: "req_tool" })
    );

    const result = await tools
      .get("pull_document")!
      .handler({ kind: "creative", id }, { http: { authInfo: authInfoFor(["surveys:read"]) } });

    expect(result.isError).toBeUndefined();
  });

  test("push needs the kind's own write scope, audits the refusal against that kind, and never reaches the adapter", async () => {
    const { tools } = createToolServer();

    const result = await tools
      .get("push_document")!
      .handler(pushInput("workflow"), { http: { authInfo: authInfoFor(["surveys:write"]) } });

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403 });
    expect(adapters.workflow.push).not.toHaveBeenCalled();
    expect(buildV3AuditLog).toHaveBeenCalledWith(session, "updated", "workflow", expect.any(String));
    expect(queueV3AuditLog).toHaveBeenCalledTimes(1);
  });

  test("a push is refused with only a read scope", async () => {
    const { tools } = createToolServer();

    const result = await tools
      .get("push_document")!
      .handler(pushInput("survey"), { http: { authInfo: authInfoFor(["surveys:read", "workflows:read"]) } });

    expect(result.isError).toBe(true);
    expect(adapters.survey.push).not.toHaveBeenCalled();
  });

  test("a real push passes the stale-check handle and an audit log, and queues the audit", async () => {
    const { tools } = createToolServer();
    adapters.survey.push.mockResolvedValue(
      successResponse(
        { envelope, dryRun: false, changes: [{ path: "name", change: "changed" }] },
        { requestId: "req_tool" }
      )
    );

    const result = await tools
      .get("push_document")!
      .handler(pushInput("survey"), { http: { authInfo: authInfoFor(["surveys:write"]) } });

    expect(adapters.survey.push).toHaveBeenCalledWith(
      expect.objectContaining({
        id,
        expectedUpdatedAt: updatedAt,
        dryRun: false,
        confirmDestructive: false,
        authentication: session,
        auditLog: expect.anything(),
      })
    );
    expect(buildV3AuditLog).toHaveBeenCalledWith(session, "updated", "survey", expect.any(String));
    expect(queueV3AuditLog).toHaveBeenCalled();
    expect(result.structuredContent.data).toMatchObject({ dryRun: false });
  });

  test("a dry run is not audited as an update and carries no audit log", async () => {
    const { tools } = createToolServer();
    adapters.creative.push.mockResolvedValue(
      successResponse(
        { envelope: { ...envelope, kind: "creative" }, dryRun: true, changes: [] },
        { requestId: "req_tool" }
      )
    );

    await tools.get("push_document")!.handler(pushInput("creative", { dryRun: true }), {
      http: { authInfo: authInfoFor(["surveys:write"]) },
    });

    expect(adapters.creative.push).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
    expect(vi.mocked(adapters.creative.push).mock.calls[0][0]).not.toHaveProperty("auditLog");
    expect(queueV3AuditLog).not.toHaveBeenCalled();
  });

  test("relays an adapter refusal unchanged", async () => {
    const { tools } = createToolServer();
    adapters.survey.push.mockResolvedValue(problemForbidden("req_tool", "You are not authorized"));

    const result = await tools
      .get("push_document")!
      .handler(pushInput("survey"), { http: { authInfo: authInfoFor(["surveys:write"]) } });

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403 });
  });
});
