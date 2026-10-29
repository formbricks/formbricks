import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DELETE } from "./route";

const { mockDelete, mockAuthenticateRequest, mockGetSession } = vi.hoisted(() => ({
  mockDelete: vi.fn(),
  mockAuthenticateRequest: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("../../../lib/invite-management", () => ({ deleteV3OrganizationInvite: mockDelete }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: mockAuthenticateRequest }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({ action, targetType })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })) },
}));

const ORGANIZATION_ID = "clorg11111111111111111111";
const INVITE_ID = "b4f1c0de-0000-4000-8000-000000000001";

const remove = (query = "", inviteId = INVITE_ID) =>
  DELETE(
    new NextRequest(`http://localhost/api/v3/organizations/${ORGANIZATION_ID}/invites/${inviteId}${query}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ organizationId: ORGANIZATION_ID, inviteId }) }
  );

describe("DELETE /api/v3/organizations/{organizationId}/invites/{inviteId}", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDelete.mockResolvedValue(Response.json({ data: { status: "preview" } }, { status: 200 }));
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
  });

  test("reads confirm from the query: only the string true confirms, audited as an invite delete", async () => {
    await remove("?confirm=true");
    await remove();

    expect(mockDelete.mock.calls.map(([params]) => params.confirm)).toEqual([true, false]);
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORGANIZATION_ID,
        inviteId: INVITE_ID,
        auditLog: expect.objectContaining({ action: "deleted", targetType: "invite" }),
      })
    );
  });

  test("an invite id that is not a UUID is a 400 before the operation runs", async () => {
    expect((await remove("", "clinvite111111111111111111")).status).toBe(400);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  test("refuses a caller with no session, and never consults an API key", async () => {
    mockGetSession.mockResolvedValue(null);

    expect((await remove("?confirm=true")).status).toBe(401);
    expect(mockAuthenticateRequest).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
