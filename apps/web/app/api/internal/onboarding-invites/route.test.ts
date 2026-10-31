import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, InvalidInputError, TooManyRequestsError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  checkSetupInviteAuthorization: vi.fn(),
  reserveInviteRateLimit: vi.fn(),
  settleInviteRateLimit: vi.fn(),
  inviteUser: vi.fn(),
  sendInviteMemberEmail: vi.fn(),
  queueAuditEvent: vi.fn(),
  constants: { INVITE_DISABLED: false },
}));

vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/lib/user/service", () => ({ getUser: mocks.getUser }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
  applyIPRateLimit: vi.fn(),
}));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  get INVITE_DISABLED() {
    return mocks.constants.INVITE_DISABLED;
  },
}));
vi.mock("@/modules/setup/organization/[organizationId]/invite/lib/authorization", () => ({
  checkSetupInviteAuthorization: mocks.checkSetupInviteAuthorization,
}));
vi.mock("@/modules/organization/settings/teams/lib/invite-rate-limit", () => ({
  reserveInviteRateLimit: mocks.reserveInviteRateLimit,
  settleInviteRateLimit: mocks.settleInviteRateLimit,
}));
vi.mock("@/modules/setup/organization/[organizationId]/invite/lib/invite", () => ({
  inviteUser: mocks.inviteUser,
}));
vi.mock("@/modules/email", () => ({ sendInviteMemberEmail: mocks.sendInviteMemberEmail }));
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
const INVITE_ID = "clinv11111111111111111111";
const BODY = { organizationId: ORG_ID, email: "invitee@example.com", name: "Invitee" };
const reservation = { organization: { key: "o" }, user: { key: "u" } };

const invite = (body: unknown = BODY, headers: Record<string, string> = SAME_ORIGIN_HEADERS) =>
  POST(
    new NextRequest("http://localhost/api/internal/onboarding-invites", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    {} as never
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.constants.INVITE_DISABLED = false;
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.getUser.mockResolvedValue({ id: USER_ID, name: "Inviter" });
  mocks.checkSetupInviteAuthorization.mockResolvedValue(undefined);
  mocks.reserveInviteRateLimit.mockResolvedValue(reservation);
  mocks.inviteUser.mockResolvedValue(INVITE_ID);
  mocks.sendInviteMemberEmail.mockResolvedValue(true);
});

describe("POST /api/internal/onboarding-invites", () => {
  test("invites an owner, emails them, settles one unit, and audits the invite", async () => {
    const response = await invite();

    expect(response.status).toBe(201);
    expect((await response.json()).data).toEqual({ id: INVITE_ID });
    expect(mocks.checkSetupInviteAuthorization).toHaveBeenCalledWith(USER_ID, ORG_ID);
    expect(mocks.reserveInviteRateLimit).toHaveBeenCalledWith(ORG_ID, USER_ID);
    expect(mocks.settleInviteRateLimit).toHaveBeenCalledWith(reservation, 1);
    expect(mocks.sendInviteMemberEmail).toHaveBeenCalledWith(INVITE_ID, BODY.email, "Inviter", "", ORG_ID);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "created",
        targetType: "invite",
        status: "success",
        organizationId: ORG_ID,
        targetId: INVITE_ID,
        newObject: { invitedUserId: INVITE_ID, email: BODY.email, name: BODY.name },
      })
    );
  });

  test("refuses a caller who isn't an owner with 403, spending no budget, audited against the organization", async () => {
    mocks.checkSetupInviteAuthorization.mockRejectedValue(new AuthorizationError("Not authorized"));

    expect((await invite()).status).toBe(403);
    expect(mocks.reserveInviteRateLimit).not.toHaveBeenCalled();
    expect(mocks.inviteUser).not.toHaveBeenCalled();
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failure", organizationId: ORG_ID })
    );
  });

  test("hands the unit back when the invite can't be created, and shows why", async () => {
    mocks.inviteUser.mockRejectedValue(new InvalidInputError("Invite already exists"));

    const response = await invite();

    expect(response.status).toBe(400);
    expect((await response.json()).detail).toBe("Invite already exists");
    expect(mocks.settleInviteRateLimit).toHaveBeenCalledWith(reservation, 0);
    expect(mocks.sendInviteMemberEmail).not.toHaveBeenCalled();
  });

  test.each([new Error("smtp unavailable"), new TooManyRequestsError("Maximum number of requests")])(
    "keeps the invite and its unit when the email fails with %s (ENG-3823)",
    async (error) => {
      mocks.sendInviteMemberEmail.mockRejectedValue(error);

      expect((await invite()).status).toBe(201);
      expect(mocks.settleInviteRateLimit).toHaveBeenCalledWith(reservation, 1);
    }
  );

  test("answers 429 once the shared invite budget is spent, inviting no one", async () => {
    mocks.reserveInviteRateLimit.mockRejectedValue(
      new TooManyRequestsError("Maximum number of requests reached.", 900)
    );

    const response = await invite();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("900");
    expect(mocks.inviteUser).not.toHaveBeenCalled();
  });

  test("answers 403 when invites are disabled on the instance", async () => {
    mocks.constants.INVITE_DISABLED = true;

    expect((await invite()).status).toBe(403);
    expect(mocks.inviteUser).not.toHaveBeenCalled();
  });

  test.each([
    ["a malformed email", { ...BODY, email: "nope" }],
    ["a role (this path only invites owners)", { ...BODY, role: "member" }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await invite(body)).status).toBe(400);
    expect(mocks.inviteUser).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await invite(BODY, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect(mocks.inviteUser).not.toHaveBeenCalled();
  });
});
