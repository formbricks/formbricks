import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, ResourceNotFoundError, TooManyRequestsError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { TagError } from "@/modules/workspaces/settings/types/tag";
import { POST } from "./route";
import { TAG_NAME_MAX_LENGTH } from "./schemas";

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  getSession: vi.fn(),
  resolveWorkspace: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  createTag: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ assertCan: mocks.assertCan, can: vi.fn() }));
vi.mock("@/app/api/v3/lib/workspace-context", () => ({ resolveV3WorkspaceContext: mocks.resolveWorkspace }));
vi.mock("@/lib/tag/service", () => ({ createTag: mocks.createTag }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({
    action,
    targetType,
    status: "failure",
  })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const ORG_ID = "clorg11111111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";
const TAG_ID = "cltag11111111111111111111";
const DATE = new Date("2026-10-01T10:00:00.000Z");

const tag = { id: TAG_ID, name: "vip", workspaceId: WORKSPACE_ID, createdAt: DATE, updatedAt: DATE };

const create = (body: unknown, headers: Record<string, string> = SAME_ORIGIN_HEADERS) =>
  POST(
    new NextRequest("http://localhost/api/internal/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    {} as never
  );

const checkedActions = () => mocks.assertCan.mock.calls.map(([, action, resource]) => [action, resource]);

const operationLimits = () =>
  mocks.applyRateLimit.mock.calls
    .filter(([config]) => config.namespace !== rateLimitConfigs.api.v3.namespace)
    .map(([config, identifier]) => [config.namespace, identifier]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.assertCan.mockResolvedValue(undefined);
  mocks.resolveWorkspace.mockResolvedValue({ workspaceId: WORKSPACE_ID, organizationId: ORG_ID });
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.createTag.mockResolvedValue({ ok: true, data: tag });
});

describe("POST /api/internal/tags", () => {
  test("creates the tag for a caller who may write the workspace, and audits it", async () => {
    const response = await create({ workspaceId: WORKSPACE_ID, name: "vip" });

    expect(response.status).toBe(201);
    expect((await response.json()).data).toEqual({
      id: TAG_ID,
      name: "vip",
      workspaceId: WORKSPACE_ID,
      createdAt: DATE.toISOString(),
      updatedAt: DATE.toISOString(),
    });
    expect(checkedActions()).toEqual([["workspace.write", { type: "workspace", id: WORKSPACE_ID }]]);
    expect(operationLimits()).toEqual([[rateLimitConfigs.actions.stateMutation.namespace, WORKSPACE_ID]]);
    expect(mocks.createTag).toHaveBeenCalledWith(WORKSPACE_ID, "vip");
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "created",
        targetType: "tag",
        status: "success",
        organizationId: ORG_ID,
        targetId: TAG_ID,
        newObject: tag,
      })
    );
  });

  test("keeps the name as typed", async () => {
    await create({ workspaceId: WORKSPACE_ID, name: "  spaced  " });
    expect(mocks.createTag).toHaveBeenCalledWith(WORKSPACE_ID, "  spaced  ");
  });

  test("answers 409 with the service's reason for a name the workspace already has", async () => {
    mocks.createTag.mockResolvedValue({
      ok: false,
      error: { code: TagError.TAG_NAME_ALREADY_EXISTS, message: "Tag with this name already exists" },
    });

    const response = await create({ workspaceId: WORKSPACE_ID, name: "vip" });

    expect(response.status).toBe(409);
    expect((await response.json()).detail).toBe("Tag with this name already exists");
  });

  test("answers 500 without the database's message for any other failure", async () => {
    mocks.createTag.mockResolvedValue({
      ok: false,
      error: { code: TagError.UNEXPECTED_ERROR, message: "connection reset by peer" },
    });

    const response = await create({ workspaceId: WORKSPACE_ID, name: "vip" });

    expect(response.status).toBe(500);
    expect((await response.json()).detail).toBe("Unable to create tag");
  });

  test("answers the uniform 403 to a caller who may not write the workspace, before the budget", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));

    const response = await create({ workspaceId: WORKSPACE_ID, name: "vip" });

    expect(response.status).toBe(403);
    expect(operationLimits()).toEqual([]);
    expect(mocks.createTag).not.toHaveBeenCalled();
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "created", status: "failure" })
    );
  });

  test("answers the uniform 403 for a workspace that doesn't exist", async () => {
    mocks.resolveWorkspace.mockRejectedValue(new ResourceNotFoundError("workspace", WORKSPACE_ID));
    expect((await create({ workspaceId: WORKSPACE_ID, name: "vip" })).status).toBe(403);
    expect(mocks.createTag).not.toHaveBeenCalled();
  });

  test("answers 429 when the workspace's write budget is spent", async () => {
    mocks.applyRateLimit.mockImplementation(async (config: { namespace: string }) => {
      if (config.namespace === rateLimitConfigs.actions.stateMutation.namespace) {
        throw new TooManyRequestsError("Maximum number of requests reached. Please try again later.", 60);
      }
    });

    expect((await create({ workspaceId: WORKSPACE_ID, name: "vip" })).status).toBe(429);
    expect(mocks.createTag).not.toHaveBeenCalled();
  });

  test.each([
    ["a name past the cap", { workspaceId: WORKSPACE_ID, name: "a".repeat(TAG_NAME_MAX_LENGTH + 1) }],
    ["a name with a NUL character", { workspaceId: WORKSPACE_ID, name: "a\u0000b" }],
    ["no name", { workspaceId: WORKSPACE_ID }],
    ["a malformed workspace id", { workspaceId: "not-a-cuid", name: "vip" }],
    ["an unknown key", { workspaceId: WORKSPACE_ID, name: "vip", color: "red" }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await create(body)).status).toBe(400);
    expect(mocks.createTag).not.toHaveBeenCalled();
  });

  test("accepts a name at the cap", async () => {
    const name = "a".repeat(TAG_NAME_MAX_LENGTH);
    expect((await create({ workspaceId: WORKSPACE_ID, name })).status).toBe(201);
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await create({ workspaceId: WORKSPACE_ID, name: "vip" })).status).toBe(401);
  });

  test("refuses a cross-site request (CSRF)", async () => {
    const response = await create(
      { workspaceId: WORKSPACE_ID, name: "vip" },
      { "sec-fetch-site": "cross-site" }
    );
    expect(response.status).toBe(403);
    expect(mocks.createTag).not.toHaveBeenCalled();
  });
});
