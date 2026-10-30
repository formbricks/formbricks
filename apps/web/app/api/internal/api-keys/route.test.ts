import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  assertCanGrant: vi.fn(),
  capture: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/modules/organization/settings/api-keys/lib/api-key", () => ({
  getApiKeysWithEnvironmentPermissions: mocks.list,
  createApiKey: mocks.create,
  updateApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
}));
vi.mock("@/modules/organization/settings/api-keys/lib/organization-access", () => ({
  assertCanGrantOrganizationAccess: mocks.assertCanGrant,
}));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: mocks.capture }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromApiKeyId: vi.fn() }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
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

const ORG_ID = "clorg11111111111111111111";
const USER_ID = "cluser1111111111111111111";
const KEY_ID = "clkey11111111111111111111";
const WORKSPACE_ID = "clws111111111111111111111";
const CREATED_AT = new Date("2026-10-01T10:00:00.000Z");
const ORG_ACCESS = { accessControl: { read: false, write: false } };

const storedKey = {
  id: KEY_ID,
  label: "CI",
  createdAt: CREATED_AT,
  organizationAccess: ORG_ACCESS,
  apiKeyWorkspaces: [{ workspaceId: WORKSPACE_ID, permission: "write" }],
};

const listRequest = (query = `organizationId=${ORG_ID}`) =>
  GET(new NextRequest(`http://localhost/api/internal/api-keys?${query}`), {} as never);

const createRequest = (body: unknown, headers: Record<string, string> = SAME_ORIGIN_HEADERS) =>
  POST(
    new NextRequest(`http://localhost/api/internal/api-keys?organizationId=${ORG_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    {} as never
  );

const validBody = {
  label: "CI",
  workspacePermissions: [{ workspaceId: WORKSPACE_ID, permission: "write" }],
  organizationAccess: ORG_ACCESS,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.list.mockResolvedValue([storedKey]);
  mocks.assertCanGrant.mockResolvedValue(undefined);
  mocks.create.mockResolvedValue({ ...storedKey, actualKey: "fbk_secret" });
});

describe("GET /api/internal/api-keys", () => {
  test("lists the organization's keys without their secrets, dates as ISO strings", async () => {
    const response = await listRequest();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.json()).toEqual({
      data: [
        {
          id: KEY_ID,
          label: "CI",
          createdAt: CREATED_AT.toISOString(),
          organizationAccess: ORG_ACCESS,
          apiKeyWorkspaces: [{ workspaceId: WORKSPACE_ID, permission: "write" }],
        },
      ],
    });
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "organization.manage_api_keys", {
      type: "organization",
      id: ORG_ID,
    });
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await listRequest()).status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  test("answers 403 to a member who can't manage API keys, before reading any key", async () => {
    mocks.can.mockResolvedValue(false);
    const response = await listRequest();

    expect(response.status).toBe(403);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  test("answers 400 for a malformed organization id or an unknown parameter", async () => {
    expect((await listRequest("organizationId=nope!")).status).toBe(400);
    expect((await listRequest(`organizationId=${ORG_ID}&extra=1`)).status).toBe(400);
    expect(mocks.list).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/api-keys", () => {
  test("mints a key, returns its plaintext once with a Location, and audits the request without secrets", async () => {
    const response = await createRequest(validBody);

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/internal/api-keys/${KEY_ID}`);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    const { data } = await response.json();
    expect(data).toEqual({
      id: KEY_ID,
      label: "CI",
      createdAt: CREATED_AT.toISOString(),
      organizationAccess: ORG_ACCESS,
      apiKeyWorkspaces: [{ workspaceId: WORKSPACE_ID, permission: "write" }],
      apiKey: "fbk_secret",
    });
    expect(mocks.create).toHaveBeenCalledWith(ORG_ID, USER_ID, validBody);
    expect(mocks.capture).toHaveBeenCalledWith(
      USER_ID,
      "api_key_created",
      { api_key_id: KEY_ID },
      { organizationId: ORG_ID }
    );
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "created",
        targetType: "apiKey",
        status: "success",
        organizationId: ORG_ID,
        targetId: KEY_ID,
        newObject: validBody,
      })
    );
    expect(JSON.stringify(mocks.queueAuditEvent.mock.calls)).not.toContain("fbk_secret");
  });

  test("refuses a cross-site request before doing anything (CSRF)", async () => {
    const response = await createRequest(validBody, { "sec-fetch-site": "same-site" });

    expect(response.status).toBe(403);
    expect(mocks.can).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  test("answers 403 to a member who can't manage API keys, and mints nothing", async () => {
    mocks.can.mockResolvedValue(false);
    const response = await createRequest(validBody);

    expect(response.status).toBe(403);
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "organization.manage_api_keys", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failure", organizationId: ORG_ID })
    );
  });

  test("answers 403 when the caller's role can't grant user management access (ENG-3075)", async () => {
    mocks.assertCanGrant.mockRejectedValue(new OperationNotAllowedError("User management is not allowed"));
    const body = { ...validBody, organizationAccess: { accessControl: { read: true, write: true } } };

    const response = await createRequest(body);

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe(
      "Your role can't grant user management access to an API key."
    );
    expect(mocks.assertCanGrant).toHaveBeenCalledWith(USER_ID, ORG_ID, body.organizationAccess);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  test("answers 422 for a workspace outside the organization (ENG-1749)", async () => {
    mocks.create.mockRejectedValue(
      new OperationNotAllowedError("Workspace x does not belong to organization y")
    );

    const response = await createRequest(validBody);

    expect(response.status).toBe(422);
    const problem = await response.json();
    expect(problem.invalid_params).toEqual([
      { name: "workspacePermissions", reason: "Every workspace must belong to the organization." },
    ]);
    // The internal message names the organization id; it must not reach the caller.
    expect(JSON.stringify(problem)).not.toContain("does not belong to organization");
  });

  test.each([
    ["a blank label", { ...validBody, label: "   " }],
    ["a label over 255 characters", { ...validBody, label: "x".repeat(256) }],
    [
      "the same workspace twice",
      {
        ...validBody,
        workspacePermissions: [
          { workspaceId: WORKSPACE_ID, permission: "read" },
          { workspaceId: WORKSPACE_ID, permission: "write" },
        ],
      },
    ],
    [
      "an unknown permission",
      { ...validBody, workspacePermissions: [{ workspaceId: WORKSPACE_ID, permission: "root" }] },
    ],
    ["an unknown field", { ...validBody, extra: true }],
    ["no organization access", { label: "CI" }],
  ])("answers 400 for %s, and mints nothing", async (_label, body) => {
    const response = await createRequest(body);

    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await createRequest(validBody)).status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
