import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";
import { inviteOrganizationMemberAction } from "./actions";

const mocks = vi.hoisted(() => ({
  checkSetupInviteAuthorization: vi.fn(),
  inviteUser: vi.fn(),
  reserveInviteRateLimit: vi.fn(),
  sendInviteMemberEmail: vi.fn(),
  settleInviteRateLimit: vi.fn(),
}));

vi.mock("@/lib/constants", () => ({
  INVITE_DISABLED: false,
}));

vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn(() => ({
      action: vi.fn((fn) => fn),
    })),
  },
}));

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_eventName, _objectType, fn) => fn),
}));

vi.mock("@/modules/email", () => ({
  sendInviteMemberEmail: mocks.sendInviteMemberEmail,
}));

vi.mock("@/modules/organization/settings/teams/lib/invite-rate-limit", () => ({
  reserveInviteRateLimit: mocks.reserveInviteRateLimit,
  settleInviteRateLimit: mocks.settleInviteRateLimit,
}));

vi.mock("@/modules/setup/organization/[organizationId]/invite/lib/authorization", () => ({
  checkSetupInviteAuthorization: mocks.checkSetupInviteAuthorization,
}));

vi.mock("@/modules/setup/organization/[organizationId]/invite/lib/invite", () => ({
  inviteUser: mocks.inviteUser,
}));

describe("setup invite rate-limit settlement", () => {
  const organizationId = "org-1";
  const reservation = {
    identifier: organizationId,
    key: "rate-limit-key",
    namespace: "action:invite-member",
    requested: 1,
    settled: false,
  };
  const ctx = { user: { id: "user-1", name: "Inviter" }, auditLoggingCtx: {} };
  const parsedInput = {
    email: "invitee@example.com",
    name: "Invitee",
    organizationId,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inviteUser.mockResolvedValue("invite-1");
    mocks.reserveInviteRateLimit.mockResolvedValue(reservation);
  });

  test("releases the reservation when invite creation fails", async () => {
    const error = new InvalidInputError("Invite already exists");
    mocks.inviteUser.mockRejectedValueOnce(error);

    await expect(inviteOrganizationMemberAction({ ctx, parsedInput } as never)).rejects.toBe(error);

    expect(mocks.settleInviteRateLimit).toHaveBeenCalledWith(reservation, 0);
    expect(mocks.sendInviteMemberEmail).not.toHaveBeenCalled();
  });

  test("keeps the unit after persistence even if email delivery fails", async () => {
    const error = new Error("smtp unavailable");
    mocks.sendInviteMemberEmail.mockRejectedValueOnce(error);

    await expect(inviteOrganizationMemberAction({ ctx, parsedInput } as never)).rejects.toBe(error);

    expect(mocks.settleInviteRateLimit).toHaveBeenCalledWith(reservation, 1);
  });
});
