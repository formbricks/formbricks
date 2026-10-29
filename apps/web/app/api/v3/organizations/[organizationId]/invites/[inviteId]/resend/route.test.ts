import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "./route";

const { mockResend, mockAuthenticateRequest, mockGetSession } = vi.hoisted(() => ({
  mockResend: vi.fn(),
  mockAuthenticateRequest: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("../../../../lib/invite-management", () => ({ resendV3OrganizationInvite: mockResend }));
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

const post = (inviteId = INVITE_ID) =>
  POST(
    new NextRequest(`http://localhost/api/v3/organizations/${ORGANIZATION_ID}/invites/${inviteId}/resend`, {
      method: "POST",
    }),
    { params: Promise.resolve({ organizationId: ORGANIZATION_ID, inviteId }) }
  );

describe("POST /api/v3/organizations/{organizationId}/invites/{inviteId}/resend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResend.mockResolvedValue(Response.json({ data: { status: "resent" } }, { status: 200 }));
    mockGetSession.mockResolvedValue({ user: { id: "user_1" } });
  });

  test("hands the ids to the operation, audited as an invite update", async () => {
    const response = await post();

    expect(response.status).toBe(200);
    expect(mockResend).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORGANIZATION_ID,
        inviteId: INVITE_ID,
        auditLog: expect.objectContaining({ action: "updated", targetType: "invite" }),
      })
    );
  });

  test("an invite id that is not a UUID is a 400 before the operation runs", async () => {
    expect((await post("nope")).status).toBe(400);
    expect(mockResend).not.toHaveBeenCalled();
  });

  test("refuses a caller with no session, and never consults an API key", async () => {
    mockGetSession.mockResolvedValue(null);

    expect((await post()).status).toBe(401);
    expect(mockAuthenticateRequest).not.toHaveBeenCalled();
    expect(mockResend).not.toHaveBeenCalled();
  });
});
