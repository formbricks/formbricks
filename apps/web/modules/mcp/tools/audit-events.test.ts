import { beforeEach, describe, expect, test, vi } from "vitest";
import { listV3AuditEventsFromInput } from "@/app/api/v3/audit-events/lib/operations";
import { problemForbidden, successListResponse } from "@/app/api/v3/lib/response";
import { ZMcpListAuditEventsInput } from "./audit-event-schemas";
import { registerAuditEventTools } from "./audit-events";

vi.mock("@/app/api/v3/audit-events/lib/operations", () => ({ listV3AuditEventsFromInput: vi.fn() }));

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

const organizationId = "tz4a98xxat96iws9zmbrgj3a";

type TToolResult = {
  isError?: boolean;
  structuredContent: { data?: unknown; meta?: unknown; error?: { status: number } };
};
type TToolHandler = (input: Record<string, unknown>, extra: unknown) => Promise<TToolResult>;

function createToolServer() {
  const tools = new Map<string, { config: Record<string, unknown>; handler: TToolHandler }>();
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: TToolHandler) => {
      tools.set(name, { config, handler });
    }),
  };
  registerAuditEventTools(server as unknown as Parameters<typeof registerAuditEventTools>[0]);
  return { tools };
}

describe("registerAuditEventTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("registers exactly one tool, and it only reads", () => {
    const { tools } = createToolServer();

    expect([...tools.keys()]).toEqual(["list_audit_events"]);
    expect(tools.get("list_audit_events")!.config.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
    });
  });

  test("is refused to a token holding every scope except audit:read, and never reaches the operation", async () => {
    const { tools } = createToolServer();

    const result = await tools.get("list_audit_events")!.handler(
      { organizationId },
      {
        authInfo: authInfoFor([
          "surveys:read",
          "surveys:write",
          "workflows:read",
          "feedbackRecords:read",
          "responses:read",
          "contacts:read",
          "webhooks:read",
        ]),
      }
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error?.status).toBe(403);
    expect(listV3AuditEventsFromInput).not.toHaveBeenCalled();
  });

  test("with audit:read calls the operation with the caller's authentication and the tool input", async () => {
    vi.mocked(listV3AuditEventsFromInput).mockResolvedValue(
      successListResponse([], { limit: 20, nextCursor: null })
    );
    const { tools } = createToolServer();
    const input = { organizationId, limit: 5, status: "failure" };

    const result = await tools.get("list_audit_events")!.handler(input, {
      authInfo: authInfoFor(["audit:read"]),
    });

    expect(listV3AuditEventsFromInput).toHaveBeenCalledWith(
      expect.objectContaining({ input, authentication: session, requestId: "req_tool" })
    );
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.meta).toEqual({ limit: 20, nextCursor: null });
  });

  test("passes the operation's refusal through as a tool error", async () => {
    vi.mocked(listV3AuditEventsFromInput).mockResolvedValue(problemForbidden("req_tool"));
    const { tools } = createToolServer();

    const result = await tools
      .get("list_audit_events")!
      .handler({ organizationId }, { authInfo: authInfoFor(["audit:read"]) });

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error?.status).toBe(403);
  });
});

describe("ZMcpListAuditEventsInput", () => {
  test("applies the page defaults", () => {
    expect(ZMcpListAuditEventsInput.parse({ organizationId })).toEqual({ organizationId, limit: 20 });
  });

  test.each([{ limit: 0 }, { limit: 101 }, { limit: 1.5 }])("bounds the page size: %o", (extra) => {
    expect(ZMcpListAuditEventsInput.safeParse({ organizationId, ...extra }).success).toBe(false);
  });

  test.each([{ offset: 5 }, { skip: 5 }, { workspaceId: organizationId }])(
    "rejects an argument it does not declare: %o",
    (extra) => {
      expect(ZMcpListAuditEventsInput.safeParse({ organizationId, ...extra }).success).toBe(false);
    }
  );

  test("rejects a filter value outside the audit vocabulary", () => {
    expect(ZMcpListAuditEventsInput.safeParse({ organizationId, action: "exploded" }).success).toBe(false);
    expect(ZMcpListAuditEventsInput.safeParse({ organizationId, targetType: "spaceship" }).success).toBe(
      false
    );
  });
});
