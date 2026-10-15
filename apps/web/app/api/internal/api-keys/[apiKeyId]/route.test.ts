import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { DELETE, PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  getOrganizationId: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/modules/organization/settings/api-keys/lib/api-key", () => ({
  getApiKeysWithEnvironmentPermissions: vi.fn(),
  createApiKey: vi.fn(),
  updateApiKey: mocks.update,
  deleteApiKey: mocks.remove,
}));
vi.mock("@/modules/organization/settings/api-keys/lib/organization-access", () => ({
  assertCanGrantOrganizationAccess: vi.fn(),
}));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromApiKeyId: mocks.getOrganizationId }));
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
const CREATED_AT = new Date("2026-10-01T10:00:00.000Z");
const ORG_ACCESS = { accessControl: { read: false, write: false } };

const url = (id = KEY_ID) => `http://localhost/api/internal/api-keys/${id}`;
const props = (id = KEY_ID) => ({ params: Promise.resolve({ apiKeyId: id }) });

const patch = (
  body: unknown,
  { id = KEY_ID, headers = SAME_ORIGIN_HEADERS as Record<string, string> } = {}
) =>
  PATCH(
    new NextRequest(url(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    props(id) as never
  );

const remove = ({ id = KEY_ID, headers = SAME_ORIGIN_HEADERS as Record<string, string> } = {}) =>
  DELETE(new NextRequest(url(id), { method: "DELETE", headers }), props(id) as never);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.getOrganizationId.mockResolvedValue(ORG_ID);
  mocks.update.mockResolvedValue({
    id: KEY_ID,
    label: "Renamed",
    createdAt: CREATED_AT,
    organizationAccess: ORG_ACCESS,
    apiKeyWorkspaces: [],
  });
  mocks.remove.mockResolvedValue({
    id: KEY_ID,
    label: "CI",
    createdAt: CREATED_AT,
    organizationAccess: ORG_ACCESS,
    hashedKey: "$2b$12$stored-bcrypt-hash",
    lookupHash: "stored-sha256",
  });
});

describe("PATCH /api/internal/api-keys/{apiKeyId}", () => {
  test("renames a key the caller may manage and returns it", async () => {
    const response = await patch({ label: "Renamed" });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      id: KEY_ID,
      label: "Renamed",
      createdAt: CREATED_AT.toISOString(),
      organizationAccess: ORG_ACCESS,
      apiKeyWorkspaces: [],
    });
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "apiKey.manage", {
      type: "apiKey",
      id: KEY_ID,
    });
    expect(mocks.update).toHaveBeenCalledWith(KEY_ID, { label: "Renamed" });
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "apiKey",
        status: "success",
        organizationId: ORG_ID,
        targetId: KEY_ID,
        newObject: { label: "Renamed" },
      })
    );
  });

  test("answers 403 for a key the caller can't manage, without touching it", async () => {
    mocks.can.mockResolvedValue(false);
    const response = await patch({ label: "Hijacked" });

    expect(response.status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.getOrganizationId).not.toHaveBeenCalled();
  });

  test("answers the same 403 for a key deleted between the check and the lookup", async () => {
    mocks.getOrganizationId.mockRejectedValue(new ResourceNotFoundError("apiKey", KEY_ID));
    mocks.can.mockResolvedValue(true);
    const vanished = await patch({ label: "Renamed" });

    mocks.can.mockResolvedValue(false);
    const forbidden = await patch({ label: "Renamed" });

    const withoutRequestId = async (response: Response) => {
      const { requestId: _requestId, ...rest } = await response.json();
      return rest;
    };
    expect(vanished.status).toBe(403);
    expect(await withoutRequestId(vanished)).toEqual(await withoutRequestId(forbidden));
    expect(mocks.update).not.toHaveBeenCalled();
  });

  test.each([
    ["a blank label", { label: " " }],
    ["no label", {}],
    [
      "a permission change, which a key can't have after creation",
      { label: "x", organizationAccess: ORG_ACCESS },
    ],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await patch(body)).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  test("answers 400 for a malformed key id", async () => {
    expect((await patch({ label: "x" }, { id: "not a cuid" })).status).toBe(400);
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await patch({ label: "x" }, { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/internal/api-keys/{apiKeyId}", () => {
  test("revokes the key with a 204 and audits what was removed, minus the stored hashes", async () => {
    const response = await remove();

    expect(response.status).toBe(204);
    expect(mocks.remove).toHaveBeenCalledWith(KEY_ID);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "deleted",
        status: "success",
        organizationId: ORG_ID,
        targetId: KEY_ID,
        oldObject: { id: KEY_ID, label: "CI", createdAt: CREATED_AT, organizationAccess: ORG_ACCESS },
      })
    );
    const audited = JSON.stringify(mocks.queueAuditEvent.mock.calls);
    expect(audited).not.toContain("stored-bcrypt-hash");
    expect(audited).not.toContain("stored-sha256");
  });

  test("answers 403 for a key the caller can't manage, and deletes nothing", async () => {
    mocks.can.mockResolvedValue(false);
    expect((await remove()).status).toBe(403);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  test("refuses a request with neither Sec-Fetch-Site nor Origin (CSRF, fail-safe)", async () => {
    expect((await remove({ headers: {} })).status).toBe(403);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await remove()).status).toBe(401);
  });
});
