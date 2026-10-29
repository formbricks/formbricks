import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "./route";

const { mockInvite, mockAuthenticateRequest, mockGetSession } = vi.hoisted(() => ({
  mockInvite: vi.fn(),
  mockAuthenticateRequest: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("../../lib/operations", () => ({ inviteV3OrganizationMember: mockInvite }));
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

const post = (body: unknown, id = ORGANIZATION_ID) =>
  POST(
    new NextRequest(`http://localhost/api/v3/organizations/${id}/invites`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ organizationId: id }) }
  );

describe("POST /api/v3/organizations/{organizationId}/invites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvite.mockResolvedValue(Response.json({ data: { status: "preview" } }, { status: 200 }));
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
  });

  /**
   * `confirm` is enforced by the operation, so the route must pass the body through untouched: a route
   * that stripped or defaulted it would decide on the operation's behalf.
   */
  test("hands the body, `confirm` included, to the operation, audited as an invite create", async () => {
    const body = { email: "ada@example.com", name: "Ada", role: "member", confirm: true };

    const response = await post(body);

    expect(response.status).toBe(200);
    expect(mockInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORGANIZATION_ID,
        body,
        authentication: { user: { id: "user_1" } },
        auditLog: expect.objectContaining({ action: "created", targetType: "invite" }),
      })
    );
  });

  test("rejects a malformed organization id with 400 before the operation runs", async () => {
    const response = await post({ email: "ada@example.com", name: "Ada", role: "member" }, "not an id");

    expect(response.status).toBe(400);
    expect(mockInvite).not.toHaveBeenCalled();
  });

  test("refuses a caller with no session, and never consults an API key", async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await post({ email: "ada@example.com", name: "Ada", role: "member" });

    expect(response.status).toBe(401);
    expect(mockAuthenticateRequest).not.toHaveBeenCalled();
    expect(mockInvite).not.toHaveBeenCalled();
  });
});
