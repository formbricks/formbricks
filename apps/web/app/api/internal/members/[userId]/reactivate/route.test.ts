import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  isEnabled: vi.fn(),
  reactivate: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsDataRetentionEnabled: mocks.isEnabled }));
vi.mock("@/modules/ee/data-retention/lib/reactivate-service", () => ({
  reactivateRetentionMember: mocks.reactivate,
}));
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
const ACTOR_ID = "cluser1111111111111111111";
const MEMBER_ID = "cluser2222222222222222222";
const REACTIVATED_AT = new Date("2030-06-01T00:00:00.000Z");

const reactivate = (userId = MEMBER_ID, query = `organizationId=${ORG_ID}`) =>
  POST(
    new NextRequest(`http://localhost/api/internal/members/${userId}/reactivate?${query}`, {
      method: "POST",
      headers: { "x-request-id": "req_1" },
    }),
    { params: Promise.resolve({ userId }) } as never
  );

const snapshot = async (response: Response) => ({
  status: response.status,
  headers: Object.fromEntries([...response.headers.entries()].sort()),
  body: await response.text(),
});

describe("POST /api/internal/members/{userId}/reactivate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: ACTOR_ID } });
    mocks.can.mockResolvedValue(true);
    mocks.isEnabled.mockResolvedValue(true);
    mocks.reactivate.mockResolvedValue({ status: "reactivated", reactivatedAt: REACTIVATED_AT });
    mocks.queueAuditEvent.mockResolvedValue(undefined);
  });

  test("reactivates a member of the organisation and audits it", async () => {
    const response = await reactivate();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ userId: MEMBER_ID, isActive: true });
    expect(mocks.can).toHaveBeenCalledWith(expect.anything(), "organization.manage_access", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mocks.reactivate).toHaveBeenCalledWith({ userId: MEMBER_ID, organizationId: ORG_ID });
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "reactivated",
        targetType: "user",
        targetId: MEMBER_ID,
        organizationId: ORG_ID,
        status: "success",
        oldObject: { isActive: false },
        newObject: { isActive: true, reactivatedAt: REACTIVATED_AT.toISOString() },
      })
    );
  });

  test("answers a non-member, a missing user and an organisation the caller can't manage alike", async () => {
    mocks.reactivate.mockResolvedValueOnce({ status: "not_member" });
    const notMember = await snapshot(await reactivate());

    mocks.can.mockResolvedValueOnce(false);
    const forbidden = await snapshot(await reactivate());

    expect(notMember.status).toBe(403);
    expect(forbidden).toStrictEqual(notMember);
  });

  test("checks the caller before touching the member", async () => {
    mocks.can.mockResolvedValueOnce(false);
    expect((await reactivate()).status).toBe(403);

    mocks.isEnabled.mockResolvedValueOnce(false);
    expect((await reactivate()).status).toBe(403);

    expect(mocks.reactivate).not.toHaveBeenCalled();
  });

  test("returns 422 for a member of another organisation too, audited as a failure", async () => {
    mocks.reactivate.mockResolvedValueOnce({ status: "in_other_organizations" });

    const response = await reactivate();

    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("member_in_other_organizations");
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "reactivated", targetId: MEMBER_ID, status: "failure" })
    );
  });

  test("answers an already active member without an audit event", async () => {
    mocks.reactivate.mockResolvedValueOnce({ status: "already_active" });

    expect((await reactivate()).status).toBe(200);
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test.each([
    ["not an id", `organizationId=${ORG_ID}`],
    [MEMBER_ID, ""],
    [MEMBER_ID, `organizationId=${ORG_ID}&force=1`],
  ])("returns 400 on a bad user id or query (%s, %s)", async (userId, query) => {
    expect((await reactivate(userId, query)).status).toBe(400);
    expect(mocks.reactivate).not.toHaveBeenCalled();
  });
});
