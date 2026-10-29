import { beforeEach, describe, expect, test, vi } from "vitest";
import { resendInviteAction } from "./actions";

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  assertCan: vi.fn(),
  getInvite: vi.fn(),
  getOrganizationIdFromInviteId: vi.fn(),
  reserveInviteRateLimit: vi.fn(),
  resendInvite: vi.fn(),
  sendInviteMemberEmail: vi.fn(),
  settleInviteRateLimit: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: { invite: { findUnique: vi.fn() } },
}));

vi.mock("@/lib/authorization", () => ({
  assertCan: mocks.assertCan,
}));

vi.mock("@/lib/constants", () => ({
  INVITE_DISABLED: false,
}));

vi.mock("@/lib/jwt", () => ({
  createInviteToken: vi.fn(),
}));

vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: vi.fn(),
}));

vi.mock("@/lib/membership/utils", () => ({
  getAccessFlags: vi.fn(),
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({
      action: vi.fn((fn) => fn),
    })),
  },
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromInviteId: mocks.getOrganizationIdFromInviteId,
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: mocks.applyRateLimit,
}));

vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: { actions: { stateMutation: {} } },
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_eventName, _objectType, fn) => fn),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsMultiOrgEnabled: vi.fn(),
}));

vi.mock("@/modules/email", () => ({
  sendInviteMemberEmail: mocks.sendInviteMemberEmail,
}));

vi.mock("@/modules/organization/settings/teams/lib/membership", () => ({
  deleteMembership: vi.fn(),
  getMembershipsByUserId: vi.fn(),
  getOrganizationOwnerCount: vi.fn(),
}));

vi.mock("./lib/invite", () => ({
  deleteInvite: vi.fn(),
  getInvite: mocks.getInvite,
  refreshInviteExpiration: vi.fn(),
  resendInvite: mocks.resendInvite,
}));

vi.mock("./lib/invite-rate-limit", () => ({
  reserveInviteRateLimit: mocks.reserveInviteRateLimit,
  settleInviteRateLimit: mocks.settleInviteRateLimit,
}));

describe("resend invite", () => {
  const organizationId = "org-1";
  const reservation = {
    identifier: organizationId,
    key: "rate-limit-key",
    namespace: "action:invite-member",
    requested: 1,
    settled: false,
  };
  const ctx = { user: { id: "user-1", name: "Inviter" }, auditLoggingCtx: {} };

  beforeEach(() => {
    vi.clearAllMocks();
    reservation.settled = false;
    mocks.getOrganizationIdFromInviteId.mockResolvedValue(organizationId);
    mocks.getInvite.mockResolvedValue({ creator: { name: "Inviter" } });
    mocks.reserveInviteRateLimit.mockResolvedValue(reservation);
    mocks.resendInvite.mockResolvedValue({ email: "invitee@example.com", name: "Invitee" });
  });

  test("releases the reservation when refreshing the invite fails", async () => {
    const error = new Error("database unavailable");
    mocks.resendInvite.mockRejectedValueOnce(error);

    await expect(
      resendInviteAction({
        ctx,
        parsedInput: { inviteId: "invite-1", organizationId },
      } as never)
    ).rejects.toBe(error);

    expect(mocks.reserveInviteRateLimit).toHaveBeenCalledWith(organizationId, ctx.user.id);
    expect(mocks.settleInviteRateLimit).toHaveBeenCalledWith(reservation, 0);
  });

  // Every invite email names the organization it is sent for, which carries its per-recipient cap (ENG-3823).
  test("passes the organization to the email, with the inviter and invitee unnamed", async () => {
    mocks.getInvite.mockResolvedValueOnce({ creator: null });
    mocks.resendInvite.mockResolvedValueOnce({ email: "invitee@example.com", name: null });

    await resendInviteAction({ ctx, parsedInput: { inviteId: "invite-1", organizationId } } as never);

    expect(mocks.sendInviteMemberEmail).toHaveBeenCalledWith(
      "invite-1",
      "invitee@example.com",
      "",
      "",
      organizationId
    );
  });

  test("keeps the unit when refresh succeeds even if email delivery fails", async () => {
    const error = new Error("smtp unavailable");
    mocks.sendInviteMemberEmail.mockRejectedValueOnce(error);

    await expect(
      resendInviteAction({
        ctx,
        parsedInput: { inviteId: "invite-1", organizationId },
      } as never)
    ).rejects.toBe(error);

    expect(mocks.settleInviteRateLimit).toHaveBeenCalledWith(reservation, 1);
  });
});
