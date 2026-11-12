import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiKeyPermission } from "@formbricks/database/prisma";
import { successResponse } from "@/app/api/v3/lib/response";
import { listV3Tags, mergeV3Tags, renameV3Tag } from "@/app/api/v3/tags/lib/operations";
import { ZMcpTagListOutput } from "./tag-output-schemas";
import { ZMcpMergeTagsInput, ZMcpUpdateTagInput } from "./tag-schemas";
import { registerTagTools } from "./tags";

vi.mock("@/app/api/v3/tags/lib/operations", () => ({
  listV3Tags: vi.fn(),
  renameV3Tag: vi.fn(),
  mergeV3Tags: vi.fn(),
  deleteV3Tag: vi.fn(),
}));
vi.mock("@/app/api/v3/lib/audit", () => ({
  buildV3AuditLog: vi.fn(() => ({})),
  queueV3AuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })) },
}));

const WORKSPACE_ID = "clws000000000000000000001";
const TAG_ID = "cltg000000000000000000001";
const OTHER_TAG_ID = "cltg000000000000000000002";

const TAG = {
  id: TAG_ID,
  name: "churn",
  workspaceId: WORKSPACE_ID,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  count: 3,
};

/** An OAuth connection: a signed-in user, with a grant that gives Tags at Write. */
const oauthAuthInfo = (scopes: string[]) => ({
  token: "tok",
  clientId: "client_1",
  scopes,
  extra: {
    formbricksAuthentication: { user: { id: "user_1" }, expires: "2099-01-01" },
    authMethod: "oauth",
    grant: { access: "all", permissions: { tags: "write", responses: "write" } },
    requestId: "req_tool",
  },
});

const apiKeyAuthInfo = {
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
    authMethod: "apiKey",
    requestId: "req_tool",
  },
};

type TRegisteredTool = {
  config: Record<string, unknown>;
  handler: (input: unknown, ctx: unknown) => Promise<Record<string, unknown>>;
};

function createToolServer() {
  const tools = new Map<string, TRegisteredTool>();
  const server = {
    registerTool: vi.fn((name: string, config: Record<string, unknown>, handler: never) => {
      tools.set(name, { config, handler });
    }),
  };
  registerTagTools(server as never);
  return tools;
}

const call = async (
  name: string,
  input: unknown,
  authInfo: unknown = oauthAuthInfo(["responses:read", "responses:write"])
) => {
  const tool = createToolServer().get(name);
  if (!tool) throw new Error(`${name} is not registered`);
  return await tool.handler(input, { http: { authInfo }, mcpReq: { method: "tools/call" } });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listV3Tags).mockResolvedValue(successResponse([TAG], { requestId: "req" }));
  vi.mocked(renameV3Tag).mockResolvedValue(
    successResponse({ ...TAG, name: "churned" }, { requestId: "req" })
  );
  vi.mocked(mergeV3Tags).mockResolvedValue(successResponse({ id: OTHER_TAG_ID }, { requestId: "req" }));
});

describe("the registered surface", () => {
  /** No delete tool: deleting a tag is a hard delete, and merge is the one allowed exception. */
  test("lists, edits and merges tags, and never deletes one", () => {
    expect([...createToolServer().keys()].sort()).toEqual(["list_tags", "merge_tags", "update_tag"]);
  });

  test("every tool advertises the shape of its result", () => {
    for (const [name, tool] of createToolServer()) {
      expect(tool.config.outputSchema, `${name} has no outputSchema`).toBeDefined();
    }
  });

  /** Merging removes the source tag, so a client should ask before running it. */
  test("merge is annotated destructive", () => {
    expect(createToolServer().get("merge_tags")?.config.annotations).toMatchObject({
      destructiveHint: true,
    });
  });

  /**
   * The workspace is resolved from the tag inside the operation, so a caller cannot pair someone
   * else's tag with a workspace it holds. The tools must not take one.
   */
  test("the edit and merge tools take no workspace", () => {
    expect(
      ZMcpUpdateTagInput.safeParse({ tagId: TAG_ID, name: "x", workspaceId: WORKSPACE_ID }).success
    ).toBe(false);
    expect(
      ZMcpMergeTagsInput.safeParse({ tagId: TAG_ID, newTagId: OTHER_TAG_ID, workspaceId: WORKSPACE_ID })
        .success
    ).toBe(false);
  });
});

describe("the permission gate", () => {
  test("a Responses: Read token lists tags but cannot edit or merge them", async () => {
    const readOnly = oauthAuthInfo(["responses:read"]);

    expect((await call("list_tags", { workspaceId: WORKSPACE_ID }, readOnly)).isError).toBeFalsy();
    for (const [name, input] of [
      ["update_tag", { tagId: TAG_ID, name: "x" }],
      ["merge_tags", { tagId: TAG_ID, newTagId: OTHER_TAG_ID }],
    ] as const) {
      expect((await call(name, input, readOnly)).isError, `${name} answered a read-only token`).toBe(true);
    }

    expect(renameV3Tag).not.toHaveBeenCalled();
    expect(mergeV3Tags).not.toHaveBeenCalled();
  });

  test("a surveys-scoped token reaches no tag tool", async () => {
    const surveysOnly = oauthAuthInfo(["surveys:read", "surveys:write"]);

    for (const name of createToolServer().keys()) {
      const result = await call(name, { workspaceId: WORKSPACE_ID, tagId: TAG_ID }, surveysOnly);
      expect(result.isError, `${name} answered a surveys-scoped token`).toBe(true);
    }
    expect(listV3Tags).not.toHaveBeenCalled();
  });

  /**
   * `/api/v3/tags` is session-only: tags were managed by signed-in users through server actions, and an
   * API key never could. The MCP tools keep that line, so an API key gets no tag access here either.
   */
  test("an API key reaches no tag operation", async () => {
    for (const [name, input] of [
      ["list_tags", { workspaceId: WORKSPACE_ID }],
      ["update_tag", { tagId: TAG_ID, name: "x" }],
      ["merge_tags", { tagId: TAG_ID, newTagId: OTHER_TAG_ID }],
    ] as const) {
      const result = await call(name, input, apiKeyAuthInfo);
      expect(result.isError, `${name} answered an API key`).toBe(true);
      expect(JSON.stringify(result.structuredContent)).toContain("403");
    }

    expect(listV3Tags).not.toHaveBeenCalled();
    expect(renameV3Tag).not.toHaveBeenCalled();
    expect(mergeV3Tags).not.toHaveBeenCalled();
  });
});

describe("the tools reach the operations", () => {
  test("list_tags passes the workspace and returns the tags with their counts", async () => {
    const result = await call("list_tags", { workspaceId: WORKSPACE_ID });

    expect(listV3Tags).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: WORKSPACE_ID, requestId: "req_tool", instance: "/api/mcp" })
    );
    expect(result.structuredContent).toMatchObject({ data: [TAG] });
    expect(ZMcpTagListOutput.safeParse(result.structuredContent).success).toBe(true);
  });

  test("update_tag renames by tag id", async () => {
    await call("update_tag", { tagId: TAG_ID, name: "churned" });

    expect(renameV3Tag).toHaveBeenCalledWith(
      expect.objectContaining({ tagId: TAG_ID, name: "churned", instance: "/api/mcp" })
    );
  });

  test("merge_tags moves the source tag onto the target", async () => {
    await call("merge_tags", { tagId: TAG_ID, newTagId: OTHER_TAG_ID });

    expect(mergeV3Tags).toHaveBeenCalledWith(
      expect.objectContaining({ tagId: TAG_ID, newTagId: OTHER_TAG_ID, instance: "/api/mcp" })
    );
  });
});
