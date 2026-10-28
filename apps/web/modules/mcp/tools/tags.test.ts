import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import { deleteV3Tag, listV3Tags, mergeV3Tags, renameV3Tag } from "@/app/api/v3/tags/lib/operations";
import { ZMcpMergeTagsInput, ZMcpRenameTagInput } from "./tag-schemas";
import { registerTagTools } from "./tags";

vi.mock("@/app/api/v3/tags/lib/operations", () => ({
  listV3Tags: vi.fn(),
  renameV3Tag: vi.fn(),
  deleteV3Tag: vi.fn(),
  mergeV3Tags: vi.fn(),
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

const readAuthInfo = authInfoFor(["surveys:read"]);
const writeAuthInfo = authInfoFor(["surveys:write"]);

const workspaceId = "tz4a98xxat96iws9zmbrgj3a";
const tagId = "kj4a98xxat96iws9zmbrgj3a";
const otherTagId = "bq7m4qr9w2ft6bx1hs8dvn3c";

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
  registerTagTools(server as unknown as Parameters<typeof registerTagTools>[0]);
  return { tools };
}

describe("registerTagTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildV3AuditLog).mockReturnValue(undefined);
  });

  test("registers exactly the four tag tools", () => {
    const { tools } = createToolServer();
    expect([...tools.keys()].sort()).toEqual(["delete_tag", "list_tags", "merge_tags", "rename_tag"]);
  });

  test("marks only the reads as read-only and the removals as destructive", () => {
    const { tools } = createToolServer();
    expect(tools.get("list_tags")!.config.annotations).toMatchObject({ readOnlyHint: true });
    expect(tools.get("rename_tag")!.config.annotations).toMatchObject({ destructiveHint: false });
    expect(tools.get("delete_tag")!.config.annotations).toMatchObject({ destructiveHint: true });
    expect(tools.get("merge_tags")!.config.annotations).toMatchObject({ destructiveHint: true });
  });

  test("list_tags calls the v3 operation with the caller's authentication", async () => {
    const { tools } = createToolServer();
    const tag = { id: tagId, name: "Bug", workspaceId, createdAt: "a", updatedAt: "b", count: 3 };
    vi.mocked(listV3Tags).mockResolvedValue(successResponse([tag], { requestId: "req_tool" }));

    const result = await tools
      .get("list_tags")!
      .handler({ workspaceId }, { http: { authInfo: readAuthInfo } });

    expect(listV3Tags).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, authentication: session, instance: "/api/mcp" })
    );
    expect(result.structuredContent.data).toEqual([tag]);
  });

  test("every mutation is refused with only a read scope, without reaching the operation", async () => {
    const { tools } = createToolServer();
    const inputs: Record<string, Record<string, unknown>> = {
      rename_tag: { tagId, name: "New" },
      delete_tag: { tagId },
      merge_tags: { tagId, newTagId: otherTagId },
    };

    for (const [name, input] of Object.entries(inputs)) {
      const result = await tools.get(name)!.handler(input, { http: { authInfo: readAuthInfo } });
      expect(result.isError, name).toBe(true);
      expect(result.structuredContent.error, name).toMatchObject({ status: 403 });
    }

    expect(renameV3Tag).not.toHaveBeenCalled();
    expect(deleteV3Tag).not.toHaveBeenCalled();
    expect(mergeV3Tags).not.toHaveBeenCalled();
  });

  test("list_tags is refused with only a write scope", async () => {
    const { tools } = createToolServer();
    const result = await tools
      .get("list_tags")!
      .handler({ workspaceId }, { http: { authInfo: writeAuthInfo } });
    expect(result.isError).toBe(true);
    expect(listV3Tags).not.toHaveBeenCalled();
  });

  test("merge_tags passes both ids and an audit log to the operation, and queues the audit", async () => {
    const { tools } = createToolServer();
    vi.mocked(mergeV3Tags).mockResolvedValue(successResponse({ id: otherTagId }, { requestId: "req_tool" }));

    const result = await tools
      .get("merge_tags")!
      .handler({ tagId, newTagId: otherTagId }, { http: { authInfo: writeAuthInfo } });

    expect(mergeV3Tags).toHaveBeenCalledWith(
      expect.objectContaining({ tagId, newTagId: otherTagId, authentication: session })
    );
    expect(buildV3AuditLog).toHaveBeenCalledWith(session, "merged", "tag", expect.any(String));
    expect(queueV3AuditLog).toHaveBeenCalled();
    expect(result.structuredContent.data).toEqual({ id: otherTagId });
  });

  test("relays an operation refusal unchanged", async () => {
    const { tools } = createToolServer();
    vi.mocked(deleteV3Tag).mockResolvedValue(problemForbidden("req_tool", "You are not authorized"));

    const result = await tools.get("delete_tag")!.handler({ tagId }, { http: { authInfo: writeAuthInfo } });

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403 });
  });
});

describe("tag input schemas", () => {
  test("accept a well-formed input, so the refusals below are about the keys and name", () => {
    expect(ZMcpRenameTagInput.safeParse({ tagId, name: "New" }).success).toBe(true);
    expect(ZMcpMergeTagsInput.safeParse({ tagId, newTagId: otherTagId }).success).toBe(true);
  });

  test("reject an undeclared key instead of dropping it", () => {
    expect(ZMcpRenameTagInput.safeParse({ tagId, name: "New", nme: "typo" }).success).toBe(false);
    expect(ZMcpMergeTagsInput.safeParse({ tagId, newTagId: otherTagId, extra: 1 }).success).toBe(false);
  });

  test("a blank rename is refused", () => {
    expect(ZMcpRenameTagInput.safeParse({ tagId, name: "   " }).success).toBe(false);
  });
});
