import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import {
  createV3Webhook,
  deleteV3Webhook,
  getV3Webhook,
  listV3Webhooks,
  testV3Webhook,
  updateV3Webhook,
} from "@/app/api/v3/webhooks/lib/operations";
import { ZMcpCreateWebhookInput, ZMcpListWebhooksInput, ZMcpUpdateWebhookInput } from "./webhook-schemas";
import { registerWebhookTools } from "./webhooks";

vi.mock("@/app/api/v3/webhooks/lib/operations", () => ({
  listV3Webhooks: vi.fn(),
  getV3Webhook: vi.fn(),
  createV3Webhook: vi.fn(),
  updateV3Webhook: vi.fn(),
  deleteV3Webhook: vi.fn(),
  testV3Webhook: vi.fn(),
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

const readAuthInfo = authInfoFor(["webhooks:read"]);
const writeAuthInfo = authInfoFor(["webhooks:write"]);
// A webhook delivers response data, so creating or retargeting one also takes the right to read responses.
const deliveryWriteAuthInfo = authInfoFor(["webhooks:write", "responses:read"]);
// Scopes of another family never open a webhook tool.
const surveysAuthInfo = authInfoFor(["surveys:read", "surveys:write"]);

const workspaceId = "tz4a98xxat96iws9zmbrgj3a";
const webhookId = "kj4a98xxat96iws9zmbrgj3a";
const surveyId = "bq7m4qr9w2ft6bx1hs8dvn3c";

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
  registerWebhookTools(server as unknown as Parameters<typeof registerWebhookTools>[0]);
  return { tools };
}

const webhook = {
  id: webhookId,
  workspaceId,
  name: null,
  url: "https://hooks.example.com/x",
  source: "user",
  triggers: ["responseFinished"],
  surveyIds: [],
  createdAt: "a",
  updatedAt: "b",
};

const inputs: Record<string, Record<string, unknown>> = {
  list_webhooks: { workspaceId },
  get_webhook: { webhookId },
  create_webhook: { workspaceId, url: "https://hooks.example.com/x", triggers: ["responseFinished"] },
  update_webhook: { webhookId, name: "New" },
  delete_webhook: { webhookId },
  test_webhook: { webhookId },
};
const readTools = ["list_webhooks", "get_webhook"];
const writeTools = ["create_webhook", "update_webhook", "delete_webhook", "test_webhook"];
const operations = [
  listV3Webhooks,
  getV3Webhook,
  createV3Webhook,
  updateV3Webhook,
  deleteV3Webhook,
  testV3Webhook,
];

describe("registerWebhookTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildV3AuditLog).mockReturnValue(undefined);
  });

  test("registers exactly the six webhook tools", () => {
    const { tools } = createToolServer();
    expect([...tools.keys()].sort()).toEqual([
      "create_webhook",
      "delete_webhook",
      "get_webhook",
      "list_webhooks",
      "test_webhook",
      "update_webhook",
    ]);
  });

  test("marks only the reads as read-only and the removals and replacements as destructive", () => {
    const { tools } = createToolServer();
    for (const name of readTools) {
      expect(tools.get(name)!.config.annotations, name).toMatchObject({ readOnlyHint: true });
    }
    for (const name of writeTools) {
      expect(tools.get(name)!.config.annotations, name).toMatchObject({ readOnlyHint: false });
    }
    expect(tools.get("delete_webhook")!.config.annotations).toMatchObject({ destructiveHint: true });
    expect(tools.get("update_webhook")!.config.annotations).toMatchObject({ destructiveHint: true });
  });

  test("every write tool is refused with only a read scope, without reaching its operation", async () => {
    const { tools } = createToolServer();

    for (const name of writeTools) {
      const result = await tools.get(name)!.handler(inputs[name], { http: { authInfo: readAuthInfo } });
      expect(result.isError, name).toBe(true);
      expect(result.structuredContent.error, name).toMatchObject({ status: 403 });
    }

    for (const operation of operations) {
      expect(operation).not.toHaveBeenCalled();
    }
  });

  test("create_webhook and update_webhook are refused without responses:read, since a webhook delivers response data", async () => {
    const { tools } = createToolServer();

    for (const name of ["create_webhook", "update_webhook"]) {
      const result = await tools.get(name)!.handler(inputs[name], { http: { authInfo: writeAuthInfo } });
      expect(result.isError, name).toBe(true);
      expect(result.structuredContent.error, name).toMatchObject({ status: 403 });
    }

    expect(createV3Webhook).not.toHaveBeenCalled();
    expect(updateV3Webhook).not.toHaveBeenCalled();
  });

  test("every read tool is refused with only a write scope", async () => {
    const { tools } = createToolServer();

    for (const name of readTools) {
      const result = await tools.get(name)!.handler(inputs[name], { http: { authInfo: writeAuthInfo } });
      expect(result.isError, name).toBe(true);
    }

    expect(listV3Webhooks).not.toHaveBeenCalled();
    expect(getV3Webhook).not.toHaveBeenCalled();
  });

  test("no tool opens for another scope family", async () => {
    const { tools } = createToolServer();

    for (const [name, tool] of tools) {
      const result = await tool.handler(inputs[name], { http: { authInfo: surveysAuthInfo } });
      expect(result.isError, name).toBe(true);
    }

    for (const operation of operations) {
      expect(operation).not.toHaveBeenCalled();
    }
  });

  test("a refused write is audited as a failed attempt naming the webhook, never a created one", async () => {
    const { tools } = createToolServer();
    const auditLog = { status: "failure" } as NonNullable<ReturnType<typeof buildV3AuditLog>>;
    vi.mocked(buildV3AuditLog).mockReturnValue(auditLog);

    await tools.get("delete_webhook")!.handler({ webhookId }, { http: { authInfo: readAuthInfo } });
    expect(auditLog.targetId).toBe(webhookId);
    expect(queueV3AuditLog).toHaveBeenCalled();

    const refusedCreate = { status: "failure" } as NonNullable<ReturnType<typeof buildV3AuditLog>>;
    vi.mocked(buildV3AuditLog).mockReturnValue(refusedCreate);
    await tools.get("create_webhook")!.handler(inputs.create_webhook, { http: { authInfo: readAuthInfo } });
    expect(refusedCreate.targetId).toBeUndefined();
  });

  test("list_webhooks passes the workspace and the caller's authentication to the operation", async () => {
    const { tools } = createToolServer();
    vi.mocked(listV3Webhooks).mockResolvedValue(successResponse([webhook], { requestId: "req_tool" }));

    const result = await tools
      .get("list_webhooks")!
      .handler({ workspaceId, limit: 20 }, { http: { authInfo: readAuthInfo } });

    expect(listV3Webhooks).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, limit: 20, authentication: session, instance: "/api/mcp" })
    );
    expect(result.structuredContent.data).toEqual([webhook]);
  });

  test("create_webhook relays the secret the operation answers and queues the audit", async () => {
    const { tools } = createToolServer();
    vi.mocked(createV3Webhook).mockResolvedValue(
      successResponse({ ...webhook, secret: "whsec_once" }, { requestId: "req_tool" })
    );

    const result = await tools
      .get("create_webhook")!
      .handler(inputs.create_webhook, { http: { authInfo: deliveryWriteAuthInfo } });

    expect(createV3Webhook).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ workspaceId, url: "https://hooks.example.com/x" }),
        authentication: session,
      })
    );
    expect(buildV3AuditLog).toHaveBeenCalledWith(session, "created", "webhook", expect.any(String));
    expect(queueV3AuditLog).toHaveBeenCalled();
    expect(result.structuredContent.data).toMatchObject({ secret: "whsec_once" });
  });

  test("update_webhook sends the id apart from the fields to change", async () => {
    const { tools } = createToolServer();
    vi.mocked(updateV3Webhook).mockResolvedValue(successResponse(webhook, { requestId: "req_tool" }));

    await tools
      .get("update_webhook")!
      .handler({ webhookId, surveyIds: [surveyId] }, { http: { authInfo: deliveryWriteAuthInfo } });

    expect(updateV3Webhook).toHaveBeenCalledWith(
      expect.objectContaining({ webhookId, body: { surveyIds: [surveyId] } })
    );
    expect(buildV3AuditLog).toHaveBeenCalledWith(session, "updated", "webhook", expect.any(String));
  });

  test("relays an operation refusal unchanged", async () => {
    const { tools } = createToolServer();
    vi.mocked(deleteV3Webhook).mockResolvedValue(problemForbidden("req_tool", "You are not authorized"));

    const result = await tools
      .get("delete_webhook")!
      .handler({ webhookId }, { http: { authInfo: writeAuthInfo } });

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403 });
  });

  test("test_webhook takes only a webhook id, so it cannot be pointed at another address", () => {
    const { tools } = createToolServer();
    const schema = tools.get("test_webhook")!.config.inputSchema as {
      safeParse: (value: unknown) => { success: boolean };
    };
    expect(schema.safeParse({ webhookId, url: "http://127.0.0.1/" }).success).toBe(false);
  });
});

describe("webhook input schemas", () => {
  test("accept a well-formed input, so the refusals below are about the keys", () => {
    expect(ZMcpCreateWebhookInput.safeParse(inputs.create_webhook).success).toBe(true);
    expect(ZMcpUpdateWebhookInput.safeParse({ webhookId, name: null }).success).toBe(true);
    expect(ZMcpListWebhooksInput.safeParse({ workspaceId }).success).toBe(true);
  });

  test("reject an undeclared key instead of dropping it", () => {
    expect(ZMcpCreateWebhookInput.safeParse({ ...inputs.create_webhook, secret: "mine" }).success).toBe(
      false
    );
    expect(ZMcpUpdateWebhookInput.safeParse({ webhookId, workspaceId }).success).toBe(false);
    expect(ZMcpUpdateWebhookInput.safeParse({ webhookId, source: "zapier" }).success).toBe(false);
  });

  test("require a trigger on create and bound the survey list", () => {
    expect(ZMcpCreateWebhookInput.safeParse({ ...inputs.create_webhook, triggers: [] }).success).toBe(false);
    expect(
      ZMcpCreateWebhookInput.safeParse({
        ...inputs.create_webhook,
        surveyIds: Array.from({ length: 201 }, () => surveyId),
      }).success
    ).toBe(false);
  });
});
