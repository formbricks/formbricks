import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TV3DocumentAdapter } from "@/app/api/v3/documents/lib/envelope";
import { problemDestructiveChange, problemStaleDocument } from "@/app/api/v3/documents/lib/envelope";
import { getDocumentAdapter } from "@/app/api/v3/documents/lib/registry";
import { buildV3AuditLog, queueV3AuditLog } from "@/app/api/v3/lib/audit";
import { problemNotFound, problemUnprocessableContent, successResponse } from "@/app/api/v3/lib/response";
import { registerDocumentReviewApp } from "./register";
import { ZMcpReviewDocumentChangeInput } from "./schemas";

vi.mock("@/app/api/v3/documents/lib/registry", () => ({ getDocumentAdapter: vi.fn() }));

vi.mock("@/app/api/v3/lib/audit", () => ({
  buildV3AuditLog: vi.fn(),
  queueV3AuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn() })) },
}));

vi.mock("@formbricks/mcp-views", () => ({ getViewHtml: vi.fn().mockResolvedValue("<html></html>") }));

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
const stored = { name: "Onboarding", blocks: [{ id: "b1" }, { id: "b2" }] };
const proposed = { name: "Onboarding", blocks: [{ id: "b1" }] };
const envelope = (document: Record<string, unknown>) => ({
  kind: "survey",
  schemaVersion: 1,
  id,
  workspaceId: "ws1",
  updatedAt,
  document,
});

type TToolResult = {
  isError?: boolean;
  content: Array<{ type: string; text: string }>;
  structuredContent: { data?: Record<string, unknown>; error?: Record<string, unknown> };
};
type TRegisteredTool = {
  config: Record<string, unknown>;
  handler: (input: Record<string, unknown>, extra: unknown) => Promise<TToolResult>;
};

function createServer() {
  const tools = new Map<string, TRegisteredTool>();
  const resources: Array<{ name: string; uri: string; config: Record<string, unknown> }> = [];
  const server = {
    registerTool: vi.fn(
      (name: string, config: Record<string, unknown>, handler: TRegisteredTool["handler"]) => {
        tools.set(name, { config, handler });
      }
    ),
    registerResource: vi.fn((name: string, uri: string, config: Record<string, unknown>) => {
      resources.push({ name, uri, config });
    }),
  };
  registerDocumentReviewApp(server as unknown as Parameters<typeof registerDocumentReviewApp>[0]);
  return { tools, resources, server };
}

const adapters = {
  survey: { kind: "survey", targetType: "survey", pull: vi.fn(), push: vi.fn() },
  creative: { kind: "creative", targetType: "creative", pull: vi.fn(), push: vi.fn() },
  workflow: { kind: "workflow", targetType: "workflow", pull: vi.fn(), push: vi.fn() },
} satisfies Record<string, TV3DocumentAdapter>;

const input = (kind: keyof typeof adapters = "survey", overrides: Record<string, unknown> = {}) => ({
  kind,
  id,
  schemaVersion: 1,
  expectedUpdatedAt: updatedAt,
  document: proposed,
  ...overrides,
});

const bothScopes = authInfoFor(["surveys:read", "surveys:write", "workflows:read", "workflows:write"]);
const call = (tool: TRegisteredTool, args: Record<string, unknown>, authInfo = bothScopes) =>
  tool.handler(args, { http: { authInfo } });

describe("review_document_change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDocumentAdapter).mockImplementation((kind) => adapters[kind]);
    adapters.survey.pull.mockResolvedValue(successResponse(envelope(stored)));
  });

  test("registers the view resource and exactly one tool that links to it", () => {
    const { tools, resources } = createServer();

    expect([...tools.keys()]).toEqual(["review_document_change"]);
    expect(resources).toHaveLength(1);
    expect(resources[0].uri).toBe("ui://formbricks/document-review.html");
    expect(tools.get("review_document_change")!.config._meta).toMatchObject({
      ui: { resourceUri: "ui://formbricks/document-review.html" },
      "openai/outputTemplate": "ui://formbricks/document-review.html",
    });
    expect(tools.get("review_document_change")!.config.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
    });
  });

  test("takes push_document's arguments, without dryRun or confirmDestructive", () => {
    expect(ZMcpReviewDocumentChangeInput.safeParse(input()).success).toBe(true);
    expect(ZMcpReviewDocumentChangeInput.safeParse(input("survey", { dryRun: true })).success).toBe(false);
    expect(
      ZMcpReviewDocumentChangeInput.safeParse(input("survey", { confirmDestructive: true })).success
    ).toBe(false);
    expect(
      ZMcpReviewDocumentChangeInput.safeParse(input("survey", { expectedUpdatedAt: "yesterday" })).success
    ).toBe(false);
  });

  test("is registered behind the same any-of write gate as push_document", async () => {
    const { tools } = createServer();

    // A token with only a read scope never passes the registration gate, so nothing is read.
    const result = await call(tools.get("review_document_change")!, input(), authInfoFor(["surveys:read"]));

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 403 });
    expect(adapters.survey.pull).not.toHaveBeenCalled();
  });

  test("each kind needs its own write and read scope, and nothing is read without them", async () => {
    const { tools } = createServer();
    const cases: Array<[keyof typeof adapters, string[]]> = [
      ["survey", ["workflows:read", "workflows:write"]],
      ["creative", ["workflows:read", "workflows:write"]],
      ["workflow", ["surveys:read", "surveys:write"]],
      ["survey", ["surveys:write"]],
      ["workflow", ["workflows:write"]],
    ];

    for (const [kind, scopes] of cases) {
      const result = await call(tools.get("review_document_change")!, input(kind), authInfoFor(scopes));
      expect(result.isError, `${kind} with ${scopes}`).toBe(true);
      expect(result.structuredContent.error).toMatchObject({ status: 403 });
      expect(adapters[kind].pull).not.toHaveBeenCalled();
      expect(adapters[kind].push).not.toHaveBeenCalled();
    }
  });

  test("a creative is reviewed on the survey scopes", async () => {
    const { tools } = createServer();
    adapters.creative.pull.mockResolvedValue(successResponse({ ...envelope(stored), kind: "creative" }));
    adapters.creative.push.mockResolvedValue(
      successResponse({ envelope: { ...envelope(proposed), kind: "creative" }, dryRun: true, changes: [] })
    );

    const result = await call(
      tools.get("review_document_change")!,
      input("creative"),
      authInfoFor(["surveys:read", "surveys:write"])
    );

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent.data).toMatchObject({ kind: "creative", status: "valid" });
  });

  test("a valid change returns a diff for the view and a short text for the model, and writes nothing", async () => {
    const { tools } = createServer();
    adapters.survey.push.mockResolvedValue(
      successResponse({
        envelope: envelope(proposed),
        dryRun: true,
        changes: [{ path: "blocks[b2]", change: "removed" }],
      })
    );

    const result = await call(tools.get("review_document_change")!, input());

    expect(adapters.survey.pull).toHaveBeenCalledWith(
      expect.objectContaining({ id, authentication: session, instance: "/api/mcp" })
    );
    expect(adapters.survey.push).toHaveBeenCalledTimes(1);
    expect(adapters.survey.push).toHaveBeenCalledWith(
      expect.objectContaining({
        id,
        expectedUpdatedAt: updatedAt,
        document: proposed,
        dryRun: true,
        confirmDestructive: false,
      })
    );
    expect(vi.mocked(adapters.survey.push).mock.calls[0][0]).not.toHaveProperty("auditLog");
    expect(buildV3AuditLog).not.toHaveBeenCalled();
    expect(queueV3AuditLog).not.toHaveBeenCalled();

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent.data).toMatchObject({
      kind: "survey",
      id,
      name: "Onboarding",
      status: "valid",
      updatedAt,
      summary: { total: 1, removed: 1, destructive: 0 },
      changes: [{ path: "blocks[b2]", kind: "removed" }],
    });
    expect(result.structuredContent).toMatchObject({ requestId: "req_tool" });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toContain("1 change");
    expect(result.content[0].text).toContain("do not call push_document until they approve");
  });

  test("a push that would remove data is reviewed twice as a dry run, never as a write", async () => {
    const { tools } = createServer();
    adapters.survey.push
      .mockResolvedValueOnce(
        problemDestructiveChange("req_tool", [{ type: "blocks_removed", ids: ["b2"], responseCount: 14 }])
      )
      .mockResolvedValueOnce(successResponse({ envelope: envelope(proposed), dryRun: true, changes: [] }));

    const result = await call(tools.get("review_document_change")!, input());

    expect(adapters.survey.push).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(adapters.survey.push).mock.calls.map(([params]) => [params.dryRun, params.confirmDestructive])
    ).toEqual([
      [true, false],
      [true, true],
    ]);
    expect(queueV3AuditLog).not.toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent.data).toMatchObject({
      status: "destructive",
      destructive: [{ type: "blocks_removed", ids: ["b2"], responseCount: 14 }],
      changes: [{ path: "blocks[b2]", kind: "removed", destructive: true }],
    });
    expect(result.content[0].text).toContain("removes data: 1 question block");
  });

  test("still reviews when the second dry run fails", async () => {
    const { tools } = createServer();
    adapters.survey.push
      .mockResolvedValueOnce(
        problemDestructiveChange("req_tool", [{ type: "blocks_removed", ids: ["b2"], responseCount: 2 }])
      )
      .mockResolvedValueOnce(problemNotFound("req_tool", "Survey", id));

    const result = await call(tools.get("review_document_change")!, input());

    expect(result.structuredContent.data).toMatchObject({ status: "destructive" });
  });

  test("a stale push is a finding of the review, with the pull-again instruction", async () => {
    const { tools } = createServer();
    adapters.survey.push.mockResolvedValue(
      problemStaleDocument("req_tool", updatedAt, "2026-10-28T13:00:00.000Z")
    );

    const result = await call(tools.get("review_document_change")!, input());

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent.data).toMatchObject({ status: "stale" });
    expect(result.content[0].text).toContain("Call pull_document again");
  });

  test("an invalid document is a finding of the review, with its problems", async () => {
    const { tools } = createServer();
    adapters.survey.push.mockResolvedValue(
      problemUnprocessableContent("req_tool", "Survey document failed validation", {
        invalid_params: [{ name: "blocks.0.elements.0", reason: "Required" }],
      })
    );

    const result = await call(tools.get("review_document_change")!, input());

    expect(result.structuredContent.data).toMatchObject({
      status: "invalid",
      issues: [{ name: "blocks.0.elements.0", reason: "Required" }],
      changes: [],
    });
  });

  test("a document that cannot be found is the tool's error, and nothing is pushed", async () => {
    const { tools } = createServer();
    adapters.survey.pull.mockResolvedValue(problemNotFound("req_tool", "Survey", id));

    const result = await call(tools.get("review_document_change")!, input());

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 404 });
    expect(adapters.survey.push).not.toHaveBeenCalled();
  });

  test("an unauthorised push is the tool's error", async () => {
    const { tools } = createServer();
    adapters.survey.push.mockResolvedValue(problemNotFound("req_tool", "Survey", id));

    const result = await call(tools.get("review_document_change")!, input());

    expect(result.isError).toBe(true);
    expect(result.structuredContent.error).toMatchObject({ status: 404 });
  });

  test("the view resource carries no CSP: it needs no network", async () => {
    const { server } = createServer();
    const read = vi.mocked(server.registerResource).mock.calls[0][3] as () => Promise<{
      contents: Array<{ mimeType: string; _meta?: unknown }>;
    }>;
    const { contents } = await read();

    expect(contents[0].mimeType).toBe("text/html;profile=mcp-app");
    expect(contents[0]._meta).toBeUndefined();
  });
});
