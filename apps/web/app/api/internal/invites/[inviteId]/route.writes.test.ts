import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  DatabaseError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { POST as RESEND } from "./emails/route";
import { DELETE } from "./route";
import { POST as SHARE_LINK } from "./share-links/route";

/**
 * The writes to one pending invite that the members list offers: withdraw it, re-link it, resend it. Each
 * asks the user-management floor and `organization.manage` of the invite's own organization, spends its
 * state-mutation budget, and scopes an owner's invite to owners in the write itself (ENG-6812).
 */

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  getInvite: vi.fn(),
  getMembershipByUserIdOrganizationId: vi.fn(),
  getInviteAuditSnapshot: vi.fn(),
  deleteInvite: vi.fn(),
  refreshInviteExpiration: vi.fn(),
  resendInvite: vi.fn(),
  findUniqueInvite: vi.fn(),
  createInviteToken: vi.fn(),
  sendInviteMemberEmail: vi.fn(),
  reserveInviteRateLimit: vi.fn(),
  settleInviteRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  inviteDisabled: false,
}));

vi.mock("@formbricks/database", () => ({ prisma: { invite: { findUnique: mocks.findUniqueInvite } } }));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  get INVITE_DISABLED() {
    return mocks.inviteDisabled;
  },
}));
vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/jwt", () => ({ createInviteToken: mocks.createInviteToken }));
vi.mock("@/lib/utils/services", () => ({ getInvite: mocks.getInvite }));
vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: mocks.getMembershipByUserIdOrganizationId,
}));
vi.mock("@/modules/organization/settings/teams/lib/invite", () => ({
  getInvite: mocks.getInviteAuditSnapshot,
  deleteInvite: mocks.deleteInvite,
  refreshInviteExpiration: mocks.refreshInviteExpiration,
  resendInvite: mocks.resendInvite,
}));
vi.mock("@/modules/organization/settings/teams/lib/invite-rate-limit", () => ({
  reserveInviteRateLimit: mocks.reserveInviteRateLimit,
  settleInviteRateLimit: mocks.settleInviteRateLimit,
}));
vi.mock("@/modules/email", () => ({ sendInviteMemberEmail: mocks.sendInviteMemberEmail }));
vi.mock("@/modules/ee/role-management/lib/invite", () => ({ updateInvite: vi.fn() }));
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

const ORG_ID = "clorg11111111111111111111";
const OTHER_ORG_ID = "clorg22222222222222222222";
const USER_ID = "cluser1111111111111111111";
const INVITE_ID = "6a3c1a9e-2f4b-4c8d-9e1f-0a1b2c3d4e5f";
const BASE = `http://localhost/api/internal/invites/${INVITE_ID}`;
const RESERVATION = { organization: { key: "org" }, user: { key: "user" } };
const SNAPSHOT = { email: "invitee@example.com", role: "member", creator: { name: "Inviter" } };

const props = { params: Promise.resolve({ inviteId: INVITE_ID }) } as never;
const send = (method: string, url: string) =>
  new NextRequest(url, { method, headers: { ...(SAME_ORIGIN_HEADERS as Record<string, string>) } });

const withdraw = () => DELETE(send("DELETE", BASE), props);
const shareLink = () => SHARE_LINK(send("POST", `${BASE}/share-links`), props);
const resend = (organizationId = ORG_ID) =>
  RESEND(send("POST", `${BASE}/emails?organizationId=${organizationId}`), props);

const lastAudit = () => mocks.queueAuditEvent.mock.calls.at(-1)?.[0];
const checkedActions = () => mocks.can.mock.calls.map(([, action]) => action);
const stateMutationSpentOn = () =>
  mocks.applyRateLimit.mock.calls
    .filter(([config]) => config === rateLimitConfigs.actions.stateMutation)
    .map(([, key]) => key);
const callerIs = (role: string | null) =>
  mocks.getMembershipByUserIdOrganizationId.mockResolvedValue(
    role ? { userId: USER_ID, organizationId: ORG_ID, role, accepted: true } : null
  );
const denyFloor = () =>
  mocks.can.mockImplementation(
    async (_actor: unknown, action: string) => action !== "organization.manage_access"
  );

const writes = () => [
  mocks.deleteInvite,
  mocks.refreshInviteExpiration,
  mocks.resendInvite,
  mocks.sendInviteMemberEmail,
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.inviteDisabled = false;
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getInvite.mockResolvedValue({ organizationId: ORG_ID });
  callerIs("owner");
  mocks.getInviteAuditSnapshot.mockResolvedValue(SNAPSHOT);
  mocks.deleteInvite.mockResolvedValue(true);
  mocks.findUniqueInvite.mockResolvedValue({
    email: "invitee@example.com",
    expiresAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  mocks.refreshInviteExpiration.mockResolvedValue({
    email: "invitee@example.com",
    expiresAt: new Date("2026-01-08T00:00:00.000Z"),
  });
  mocks.resendInvite.mockResolvedValue({ email: "invitee@example.com", name: "Invitee" });
  mocks.createInviteToken.mockReturnValue("token/with+chars");
  mocks.sendInviteMemberEmail.mockResolvedValue(true);
  mocks.reserveInviteRateLimit.mockResolvedValue(RESERVATION);
  mocks.settleInviteRateLimit.mockResolvedValue(undefined);
});

describe.each([
  ["DELETE /api/internal/invites/{inviteId}", withdraw, mocks.deleteInvite],
  ["POST /api/internal/invites/{inviteId}/share-links", shareLink, mocks.refreshInviteExpiration],
  ["POST /api/internal/invites/{inviteId}/emails", () => resend(), mocks.resendInvite],
])("%s", (_name, call, write) => {
  test("asks the user-management floor, then organization.manage, of the invite's organization", async () => {
    expect((await call()).status).toBeLessThan(300);

    expect(checkedActions()).toEqual(["organization.manage_access", "organization.manage"]);
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
    expect(stateMutationSpentOn()).toEqual([ORG_ID]);
  });

  test("refuses an owner or manager below the floor, with its reason, and writes nothing", async () => {
    denyFloor();

    const response = await call();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("User management is not allowed for your role");
    expect(checkedActions()).toEqual(["organization.manage_access"]);
    for (const w of writes()) expect(w).not.toHaveBeenCalled();
  });

  test("refuses a caller without organization.manage before spending the budget", async () => {
    mocks.can.mockImplementation(async (_actor: unknown, action: string) => action !== "organization.manage");

    const response = await call();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(stateMutationSpentOn()).toEqual([]);
    for (const w of writes()) expect(w).not.toHaveBeenCalled();
  });

  test("answers a missing invite with the uniform 403, audited against it", async () => {
    mocks.getInvite.mockResolvedValue(null);

    const response = await call();

    expect(response.status).toBe(403);
    expect(mocks.can).not.toHaveBeenCalled();
    expect(lastAudit()).toEqual(expect.objectContaining({ status: "failure", targetId: INVITE_ID }));
  });

  test("answers a spent budget with 429 and writes nothing", async () => {
    mocks.applyRateLimit.mockImplementation(async (config: unknown) => {
      if (config === rateLimitConfigs.actions.stateMutation) throw new TooManyRequestsError("Slow down", 60);
    });

    expect((await call()).status).toBe(429);
    for (const w of writes()) expect(w).not.toHaveBeenCalled();
  });

  // ENG-6812: an owner's pending invite is an owner's to withdraw, resend or re-link.
  test("scopes the write to the caller's role: owner invites stay out of a manager's reach", async () => {
    callerIs("manager");
    await call();
    expect(write).toHaveBeenLastCalledWith(INVITE_ID, { allowOwnerInvite: false });

    callerIs("owner");
    await call();
    expect(write).toHaveBeenLastCalledWith(INVITE_ID, { allowOwnerInvite: true });
  });

  test("shows the owner rule when the scoped write refuses an owner invite", async () => {
    write.mockRejectedValue(new OperationNotAllowedError("Only owners can change an owner invite"));

    const response = await call();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Only owners can change an owner invite");
  });

  test("answers an invite gone before the write with the uniform 403", async () => {
    write.mockRejectedValue(new ResourceNotFoundError("Invite", INVITE_ID));

    const response = await call();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
  });
});

describe("DELETE /api/internal/invites/{inviteId}", () => {
  test("withdraws the invite and audits what it was", async () => {
    const response = await withdraw();

    expect(response.status).toBe(204);
    expect(lastAudit()).toEqual(
      expect.objectContaining({
        action: "deleted",
        targetType: "invite",
        status: "success",
        organizationId: ORG_ID,
        targetId: INVITE_ID,
        oldObject: SNAPSHOT,
      })
    );
  });
});

describe("POST /api/internal/invites/{inviteId}/share-links", () => {
  test("restarts the invite's seven days and answers a URL-encoded seven-day token, audited by expiry", async () => {
    const response = await shareLink();

    expect(response.status).toBe(201);
    expect((await response.json()).data).toEqual({ inviteToken: encodeURIComponent("token/with+chars") });
    expect(mocks.createInviteToken).toHaveBeenCalledWith(INVITE_ID, "invitee@example.com", {
      expiresIn: "7d",
    });
    expect(lastAudit()).toEqual(
      expect.objectContaining({
        action: "updated",
        targetType: "invite",
        status: "success",
        organizationId: ORG_ID,
        targetId: INVITE_ID,
        oldObject: { expiresAt: new Date("2026-01-01T00:00:00.000Z") },
        newObject: { expiresAt: new Date("2026-01-08T00:00:00.000Z") },
      })
    );
  });
});

describe("POST /api/internal/invites/{inviteId}/emails", () => {
  test("refreshes the invite, spends one recipient and resends the email naming the organization", async () => {
    const response = await resend();

    expect(response.status).toBe(204);
    expect(mocks.reserveInviteRateLimit).toHaveBeenCalledWith(ORG_ID, USER_ID);
    expect(mocks.settleInviteRateLimit).toHaveBeenCalledWith(RESERVATION, 1);
    // The organization carries the email's per-recipient cap (ENG-3823).
    expect(mocks.sendInviteMemberEmail).toHaveBeenCalledWith(
      INVITE_ID,
      "invitee@example.com",
      "Inviter",
      "Invitee",
      ORG_ID,
      USER_ID
    );
    expect(lastAudit()).toEqual(
      expect.objectContaining({
        action: "updated",
        targetType: "invite",
        status: "success",
        organizationId: ORG_ID,
        targetId: INVITE_ID,
        oldObject: SNAPSHOT,
        newObject: { email: "invitee@example.com", name: "Invitee" },
      })
    );
  });

  test("resends with the inviter and invitee unnamed", async () => {
    mocks.getInviteAuditSnapshot.mockResolvedValue({ creator: null });
    mocks.resendInvite.mockResolvedValue({ email: "invitee@example.com", name: null });

    await resend();

    expect(mocks.sendInviteMemberEmail).toHaveBeenCalledWith(
      INVITE_ID,
      "invitee@example.com",
      "",
      "",
      ORG_ID,
      USER_ID
    );
  });

  test("refuses while invites are disabled, before anything is read", async () => {
    mocks.inviteDisabled = true;

    const response = await resend();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Invite are disabled");
    expect(mocks.getInvite).not.toHaveBeenCalled();
  });

  test("refuses an invite of another organization than the one named, with the uniform 403", async () => {
    mocks.getInvite.mockResolvedValue({ organizationId: OTHER_ORG_ID });

    const response = await resend();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.can).not.toHaveBeenCalled();
    expect(mocks.resendInvite).not.toHaveBeenCalled();
  });

  test("answers a spent invite budget with 429 and sends nothing", async () => {
    mocks.reserveInviteRateLimit.mockRejectedValue(new TooManyRequestsError("Invite limit reached", 3600));

    const response = await resend();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3600");
    expect(mocks.resendInvite).not.toHaveBeenCalled();
    expect(mocks.sendInviteMemberEmail).not.toHaveBeenCalled();
  });

  test("hands the recipient back when the invite can't be refreshed", async () => {
    mocks.resendInvite.mockRejectedValue(new DatabaseError("database unavailable"));

    expect((await resend()).status).toBe(500);
    expect(mocks.settleInviteRateLimit).toHaveBeenCalledWith(RESERVATION, 0);
    expect(mocks.sendInviteMemberEmail).not.toHaveBeenCalled();
  });

  test("keeps the recipient spent and fails the request when the email can't be sent", async () => {
    mocks.sendInviteMemberEmail.mockRejectedValue(new Error("smtp unavailable"));

    expect((await resend()).status).toBe(500);
    expect(mocks.settleInviteRateLimit).toHaveBeenCalledWith(RESERVATION, 1);
    expect(lastAudit()).toEqual(expect.objectContaining({ status: "failure", organizationId: ORG_ID }));
  });

  test("rejects a missing organization with 400", async () => {
    const response = await RESEND(send("POST", `${BASE}/emails`), props);

    expect(response.status).toBe(400);
    expect(mocks.getInvite).not.toHaveBeenCalled();
  });
});
