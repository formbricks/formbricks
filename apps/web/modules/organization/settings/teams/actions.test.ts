import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ZodType } from "zod";
import { InvalidInputError } from "@formbricks/types/errors";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { bulkInviteUsersAction, inviteUserAction, resendInviteAction } from "./actions";

// The action client is mocked, so the schemas each action registers are read off the mock. Captured at
// load, before any `clearAllMocks`.
const actionSchemas = vi
  .mocked(authenticatedActionClient.inputSchema)
  .mock.calls.map(([schema]) => schema as unknown as ZodType);

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  assertCan: vi.fn(),
  capturePostHogEvent: vi.fn(),
  checkRoleManagementPermission: vi.fn(),
  getBulkInvitePermission: vi.fn(),
  getInvite: vi.fn(),
  getMembershipByUserIdOrganizationId: vi.fn(),
  getOrganizationIdFromInviteId: vi.fn(),
  getTeamsWhereUserIsAdmin: vi.fn(),
  inviteUser: vi.fn(),
  reserveInviteRateLimit: vi.fn(),
  resendInvite: vi.fn(),
  sendInviteMemberEmail: vi.fn(),
  settleInviteRateLimit: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: { invite: { findUnique: vi.fn() } },
}));

vi.mock("@formbricks/database/prisma", () => ({
  OrganizationRole: {
    billing: "billing",
    manager: "manager",
    member: "member",
    owner: "owner",
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: { error: vi.fn() },
}));

vi.mock("@/lib/authorization", () => ({
  assertCan: mocks.assertCan,
  can: vi.fn(),
}));

vi.mock("@/lib/constants", () => ({
  INVITE_DISABLED: false,
  IS_FORMBRICKS_CLOUD: false,
}));

vi.mock("@/lib/jwt", () => ({
  createInviteToken: vi.fn(),
}));

vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: mocks.getMembershipByUserIdOrganizationId,
}));

vi.mock("@/lib/membership/utils", () => ({
  getAccessFlags: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
  capturePostHogEvent: mocks.capturePostHogEvent,
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
  getBulkInvitePermission: mocks.getBulkInvitePermission,
  getIsMultiOrgEnabled: vi.fn(),
}));

vi.mock("@/modules/ee/role-management/lib/permission", () => ({
  checkRoleManagementPermission: mocks.checkRoleManagementPermission,
}));

vi.mock("@/modules/ee/teams/lib/roles", () => ({
  getTeamsWhereUserIsAdmin: mocks.getTeamsWhereUserIsAdmin,
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
  inviteUser: mocks.inviteUser,
  refreshInviteExpiration: vi.fn(),
  resendInvite: mocks.resendInvite,
}));

vi.mock("./lib/invite-rate-limit", () => ({
  reserveInviteRateLimit: mocks.reserveInviteRateLimit,
  settleInviteRateLimit: mocks.settleInviteRateLimit,
}));

describe("single invite input", () => {
  const validInvite = {
    organizationId: "clxyz1234567890abcdefghij",
    email: "invitee@example.com",
    name: "Invitee",
    role: "member",
    teamIds: [],
  };
  const inviteSchema = actionSchemas.find((schema) => schema.safeParse(validInvite).success);

  test("accepts one address", () => {
    expect(inviteSchema).toBeDefined();
  });

  // ENG-6658: one invite, and one unit of the invite budget, must not reach several inboxes.
  test.each([
    "a@example.com, b@example.com",
    "a@example.com; b@example.com",
    '"Bob" <b@example.com>',
    "nobody",
  ])("rejects %j as the invitee address", (email) => {
    expect(inviteSchema?.safeParse({ ...validInvite, email }).success).toBe(false);
  });
});

describe("invite rate-limit settlement", () => {
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
    reservation.requested = 1;
    reservation.settled = false;
    mocks.getMembershipByUserIdOrganizationId.mockResolvedValue({ role: "owner" });
    mocks.getOrganizationIdFromInviteId.mockResolvedValue(organizationId);
    mocks.getTeamsWhereUserIsAdmin.mockResolvedValue([]);
    mocks.getBulkInvitePermission.mockResolvedValue(true);
    mocks.getInvite.mockResolvedValue({ creator: { name: "Inviter" } });
    mocks.inviteUser.mockResolvedValue("invite-1");
    mocks.reserveInviteRateLimit.mockResolvedValue(reservation);
    mocks.resendInvite.mockResolvedValue({ email: "invitee@example.com", name: "Invitee" });
  });

  test("releases a single invite reservation when persistence fails", async () => {
    const error = new InvalidInputError("Invite already exists");
    mocks.inviteUser.mockRejectedValueOnce(error);

    await expect(
      inviteUserAction({
        ctx,
        parsedInput: {
          organizationId,
          email: "invitee@example.com",
          name: "Invitee",
          role: "owner",
          teamIds: [],
        },
      } as never)
    ).rejects.toBe(error);

    expect(mocks.reserveInviteRateLimit).toHaveBeenCalledWith(organizationId, ctx.user.id);
    expect(mocks.settleInviteRateLimit).toHaveBeenCalledWith(reservation, 0);
    expect(mocks.sendInviteMemberEmail).not.toHaveBeenCalled();
  });

  test("keeps a single invite unit when persistence succeeds even if email delivery fails", async () => {
    mocks.sendInviteMemberEmail.mockRejectedValueOnce(new Error("smtp unavailable"));

    await expect(
      inviteUserAction({
        ctx,
        parsedInput: {
          organizationId,
          email: "invitee@example.com",
          name: "Invitee",
          role: "owner",
          teamIds: [],
        },
      } as never)
    ).resolves.toBe("invite-1");

    expect(mocks.settleInviteRateLimit).toHaveBeenCalledWith(reservation, 1);
    // The organization carries the email's per-recipient cap (ENG-3823).
    expect(mocks.sendInviteMemberEmail).toHaveBeenCalledWith(
      "invite-1",
      "invitee@example.com",
      "Inviter",
      "Invitee",
      organizationId
    );
  });

  test("settles a bulk reservation to the number of created invites", async () => {
    reservation.requested = 3;
    mocks.inviteUser
      .mockResolvedValueOnce("invite-1")
      .mockRejectedValueOnce(new InvalidInputError("User is already a member of this organization"))
      .mockResolvedValueOnce("invite-3");

    const result = await bulkInviteUsersAction({
      ctx,
      parsedInput: {
        organizationId,
        invitees: [
          { email: "first@example.com", name: "First", role: "member", teamIds: [] },
          { email: "member@example.com", name: "Member", role: "member", teamIds: [] },
          { email: "third@example.com", name: "Third", role: "member", teamIds: [] },
        ],
      },
    } as never);

    expect(result).toEqual([
      { email: "first@example.com", success: true },
      { email: "member@example.com", success: false, failureReason: "user_already_member" },
      { email: "third@example.com", success: true },
    ]);
    expect(mocks.reserveInviteRateLimit).toHaveBeenCalledWith(organizationId, ctx.user.id, 3);
    expect(mocks.settleInviteRateLimit).toHaveBeenCalledWith(reservation, 2);
  });

  test("releases the whole bulk reservation when every invite fails", async () => {
    reservation.requested = 2;
    mocks.inviteUser.mockRejectedValue(new InvalidInputError("Invite already exists"));

    await bulkInviteUsersAction({
      ctx,
      parsedInput: {
        organizationId,
        invitees: [
          { email: "first@example.com", name: "First", role: "member", teamIds: [] },
          { email: "second@example.com", name: "Second", role: "member", teamIds: [] },
        ],
      },
    } as never);

    expect(mocks.settleInviteRateLimit).toHaveBeenCalledWith(reservation, 0);
  });

  test("releases a resend reservation when refreshing the invite fails", async () => {
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
  describe("passes the organization to every invite email", () => {
    const nameless = { user: { id: "user-1", name: null }, auditLoggingCtx: {} };

    test("on a resend, with the inviter and invitee unnamed", async () => {
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

    test("on a single invite from an unnamed user", async () => {
      await inviteUserAction({
        ctx: nameless,
        parsedInput: { organizationId, email: "invitee@example.com", role: "owner", teamIds: [] },
      } as never);

      expect(mocks.sendInviteMemberEmail).toHaveBeenCalledWith(
        "invite-1",
        "invitee@example.com",
        "",
        "",
        organizationId
      );
    });

    test("on a bulk invite from an unnamed user", async () => {
      await bulkInviteUsersAction({
        ctx: nameless,
        parsedInput: {
          organizationId,
          invitees: [{ email: "First@Example.com", role: "member", teamIds: [] }],
        },
      } as never);

      expect(mocks.sendInviteMemberEmail).toHaveBeenCalledWith(
        "invite-1",
        "first@example.com",
        "",
        "",
        organizationId
      );
    });
  });

  test("keeps a resend unit when refresh succeeds even if email delivery fails", async () => {
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
