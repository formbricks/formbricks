import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  InvalidInputError,
  OperationNotAllowedError,
  TooManyRequestsError,
  ValidationError,
} from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { POST as CREATE_BATCH } from "./batches/route";
import { POST as CREATE } from "./route";
import { BULK_INVITE_MAX_INVITEES, INVITE_MAX_TEAMS } from "./schemas";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  applyRateLimit: vi.fn(),
  getMembershipByUserIdOrganizationId: vi.fn(),
  getTeamsWhereUserIsAdmin: vi.fn(),
  checkRoleManagementPermission: vi.fn(),
  getBulkInvitePermission: vi.fn(),
  getIsDashboardViewerRoleEnabled: vi.fn(),
  inviteUser: vi.fn(),
  sendInviteMemberEmail: vi.fn(),
  reserveInviteRateLimit: vi.fn(),
  settleInviteRateLimit: vi.fn(),
  capturePostHogEvent: vi.fn(),
  queueAuditEvent: vi.fn(),
  inviteDisabled: false,
  isFormbricksCloud: false,
}));

vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  get INVITE_DISABLED() {
    return mocks.inviteDisabled;
  },
  get IS_FORMBRICKS_CLOUD() {
    return mocks.isFormbricksCloud;
  },
}));
vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/user/service", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: mocks.capturePostHogEvent }));
vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: mocks.getMembershipByUserIdOrganizationId,
}));
vi.mock("@/modules/ee/teams/lib/roles", () => ({ getTeamsWhereUserIsAdmin: mocks.getTeamsWhereUserIsAdmin }));
// The real role rules (`assertCanAssignRole`); only the licence lookups are stubbed.
vi.mock("@/modules/ee/role-management/lib/permission", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/role-management/lib/permission")>()),
  checkRoleManagementPermission: mocks.checkRoleManagementPermission,
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getAccessControlPermission: vi.fn().mockResolvedValue(true),
  getBulkInvitePermission: mocks.getBulkInvitePermission,
  getIsDashboardViewerRoleEnabled: mocks.getIsDashboardViewerRoleEnabled,
}));
vi.mock("@/modules/organization/settings/teams/lib/invite", () => ({ inviteUser: mocks.inviteUser }));
vi.mock("@/modules/organization/settings/teams/lib/invite-rate-limit", () => ({
  reserveInviteRateLimit: mocks.reserveInviteRateLimit,
  settleInviteRateLimit: mocks.settleInviteRateLimit,
}));
vi.mock("@/modules/email", () => ({ sendInviteMemberEmail: mocks.sendInviteMemberEmail }));
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
const USER_ID = "cluser1111111111111111111";
const TEAM_ID = "clteam1111111111111111111";
const OTHER_TEAM_ID = "clteam2222222222222222222";
const INVITE_ID = "6a3c1a9e-2f4b-4c8d-9e1f-0a1b2c3d4e5f";
const RESERVATION = { organization: { key: "org" }, user: { key: "user" } };

const post = (handler: typeof CREATE, path: string, body: unknown) =>
  handler(
    new NextRequest(`http://localhost/api/internal/${path}?organizationId=${ORG_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(SAME_ORIGIN_HEADERS as Record<string, string>) },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({}) } as never
  );

const invitee = { email: "invitee@example.com", name: "Invitee", role: "member", teamIds: [] as string[] };
const invite = (body: Record<string, unknown> = {}) => post(CREATE, "invites", { ...invitee, ...body });
const row = (email: string, role = "member", teamIds: string[] = []) => ({
  email,
  name: "Row",
  role,
  teamIds,
});
const bulk = (invitees: unknown[]) => post(CREATE_BATCH, "invites/batches", { invitees });

const lastAudit = () => mocks.queueAuditEvent.mock.calls.at(-1)?.[0];
const callerIs = (role: string | null) =>
  mocks.getMembershipByUserIdOrganizationId.mockResolvedValue(
    role ? { userId: USER_ID, organizationId: ORG_ID, role, accepted: true } : null
  );
const denyFloor = () =>
  mocks.can.mockImplementation(
    async (_actor: unknown, action: string) => action !== "organization.manage_access"
  );
const detail = async (response: Response) => (await response.json()).detail;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.inviteDisabled = false;
  mocks.isFormbricksCloud = false;
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.getUser.mockResolvedValue({ id: USER_ID, name: "Inviter" });
  mocks.can.mockResolvedValue(true);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  callerIs("owner");
  mocks.getTeamsWhereUserIsAdmin.mockResolvedValue([]);
  mocks.checkRoleManagementPermission.mockResolvedValue(undefined);
  mocks.getBulkInvitePermission.mockResolvedValue(true);
  mocks.getIsDashboardViewerRoleEnabled.mockResolvedValue(true);
  mocks.inviteUser.mockResolvedValue(INVITE_ID);
  mocks.sendInviteMemberEmail.mockResolvedValue(true);
  mocks.reserveInviteRateLimit.mockResolvedValue(RESERVATION);
  mocks.settleInviteRateLimit.mockResolvedValue(undefined);
});

describe("POST /api/internal/invites", () => {
  test("invites one person, spends one recipient, emails them and audits and tracks it", async () => {
    const response = await invite();

    expect(response.status).toBe(201);
    expect((await response.json()).data).toEqual({ id: INVITE_ID });
    expect(mocks.inviteUser).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      invitee: { email: "invitee@example.com", name: "Invitee", role: "member", teamIds: [] },
      currentUserId: USER_ID,
    });
    expect(mocks.reserveInviteRateLimit).toHaveBeenCalledWith(ORG_ID, USER_ID, undefined);
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
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "team_member_invited",
      { organization_id: ORG_ID, invitee_role: "member" },
      { organizationId: ORG_ID }
    );
    expect(lastAudit()).toEqual(
      expect.objectContaining({
        action: "created",
        targetType: "invite",
        status: "success",
        organizationId: ORG_ID,
        targetId: INVITE_ID,
        newObject: { email: "invitee@example.com", name: "Invitee", role: "member", teamIds: [] },
      })
    );
  });

  test("signs the email with an empty name for an unnamed inviter", async () => {
    mocks.getUser.mockResolvedValue({ id: USER_ID, name: null });

    await invite();

    expect(mocks.sendInviteMemberEmail).toHaveBeenCalledWith(
      INVITE_ID,
      "invitee@example.com",
      "",
      "Invitee",
      ORG_ID,
      USER_ID
    );
  });

  test("keeps the invite and its recipient when the email can't be sent", async () => {
    mocks.sendInviteMemberEmail.mockRejectedValue(new Error("smtp unavailable"));

    expect((await invite()).status).toBe(201);
    expect(mocks.settleInviteRateLimit).toHaveBeenCalledWith(RESERVATION, 1);
  });

  test.each([
    ["an existing invite", new InvalidInputError("Invite already exists"), 409],
    ["an existing member", new InvalidInputError("User is already a member of this organization"), 409],
    ["repeated teams", new ValidationError("teamIds must be unique"), 422],
    ["foreign teams", new ValidationError("Invalid teamIds"), 422],
  ])("hands the recipient back and names the reason for %s", async (_label, error, status) => {
    mocks.inviteUser.mockRejectedValue(error);

    const response = await invite();

    expect(response.status).toBe(status);
    // The invite form maps this exact reason to its message (`getInviteFailureReasonFromMessage`).
    expect(await detail(response)).toBe(error.message);
    expect(mocks.settleInviteRateLimit).toHaveBeenCalledWith(RESERVATION, 0);
    expect(mocks.sendInviteMemberEmail).not.toHaveBeenCalled();
  });

  test("answers a spent invite budget with 429 and invites nobody", async () => {
    mocks.reserveInviteRateLimit.mockRejectedValue(new TooManyRequestsError("Invite limit reached", 3600));

    expect((await invite()).status).toBe(429);
    expect(mocks.inviteUser).not.toHaveBeenCalled();
  });

  test("refuses while invites are disabled", async () => {
    mocks.inviteDisabled = true;

    const response = await invite();

    expect(response.status).toBe(403);
    expect(await detail(response)).toBe("Invite disabled");
    expect(mocks.inviteUser).not.toHaveBeenCalled();
  });

  test("refuses the billing role off Cloud with 400", async () => {
    const response = await invite({ role: "billing" });

    expect(response.status).toBe(400);
    expect(await detail(response)).toBe("Billing role is not allowed");
    expect(mocks.getMembershipByUserIdOrganizationId).not.toHaveBeenCalled();
  });

  test("refuses a non-member with the uniform 403", async () => {
    callerIs(null);

    expect((await invite()).status).toBe(403);
    expect(mocks.inviteUser).not.toHaveBeenCalled();
  });

  test("refuses a member who administers no team", async () => {
    callerIs("member");

    const response = await invite({ teamIds: [TEAM_ID] });

    expect(response.status).toBe(403);
    expect(await detail(response)).toBe("Not authorized to invite members");
    expect(mocks.can).not.toHaveBeenCalled();
  });

  // ENG-6812: `USER_MANAGEMENT_MINIMUM_ROLE` reaches the server as `organization.manage_access`.
  test("refuses an owner or manager below the user-management floor", async () => {
    callerIs("manager");
    denyFloor();

    const response = await invite();

    expect(response.status).toBe(403);
    expect(await detail(response)).toBe("User management is not allowed for your role");
    expect(mocks.reserveInviteRateLimit).not.toHaveBeenCalled();
    expect(mocks.inviteUser).not.toHaveBeenCalled();
  });

  test("lets a team admin invite a Member into their own team, without the floor", async () => {
    callerIs("member");
    mocks.getTeamsWhereUserIsAdmin.mockResolvedValue([TEAM_ID]);
    denyFloor();

    expect((await invite({ teamIds: [TEAM_ID, TEAM_ID] })).status).toBe(201);
    expect(mocks.can).toHaveBeenCalledTimes(1);
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "team.manage", {
      type: "team",
      id: TEAM_ID,
    });
  });

  test.each([
    [
      "another role than Member",
      { role: "manager", teamIds: [TEAM_ID] },
      "Team admins can only invite users as members",
      403,
    ],
    [
      "a team they don't administer",
      { teamIds: [OTHER_TEAM_ID] },
      "Team admins can only add users to teams where they are admin",
      403,
    ],
    ["no team at all", { teamIds: [] }, "Team admins must add invited users to at least one team", 422],
  ])("holds a team admin to their rules: %s", async (_label, body, reason, status) => {
    callerIs("member");
    mocks.getTeamsWhereUserIsAdmin.mockResolvedValue([TEAM_ID]);
    mocks.can.mockImplementation(
      async (_actor: unknown, action: string, resource: { id: string }) =>
        action === "team.manage" && resource.id === TEAM_ID
    );

    const response = await invite(body);

    expect(response.status).toBe(status);
    expect(await detail(response)).toBe(reason);
    expect(mocks.inviteUser).not.toHaveBeenCalled();
  });

  test("holds a manager to the roles they may give", async () => {
    callerIs("manager");

    const response = await invite({ role: "owner" });

    expect(response.status).toBe(403);
    expect(await detail(response)).toBe("Managers can only give the Member and Dashboard viewer roles");
  });

  test("needs the role management licence for anything but a team-less Owner invite", async () => {
    mocks.checkRoleManagementPermission.mockRejectedValue(
      new OperationNotAllowedError("Role management is not allowed for this organization")
    );

    expect((await invite({ role: "owner" })).status).toBe(201);
    const refused = await invite();
    expect(refused.status).toBe(403);
    expect(await detail(refused)).toBe("Role management is not allowed for this organization");
  });

  test.each([
    ["two addresses", { email: "a@example.com, b@example.com" }],
    ["a display-name address", { email: '"Bob" <b@example.com>' }],
    ["not an address", { email: "nobody" }],
    ["a blank name", { name: "   " }],
    ["too many teams", { teamIds: Array.from({ length: INVITE_MAX_TEAMS + 1 }, () => TEAM_ID) }],
    ["an unknown key", { organizationId: ORG_ID }],
  ])("rejects %s with 400", async (_label, body) => {
    expect((await invite(body)).status).toBe(400);
    expect(mocks.inviteUser).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/invites/batches", () => {
  test("invites each row on its own, answers every row's outcome and charges only the created invites", async () => {
    mocks.inviteUser
      .mockResolvedValueOnce("invite-1")
      .mockRejectedValueOnce(new InvalidInputError("User is already a member of this organization"))
      .mockResolvedValueOnce("invite-3");

    const response = await bulk([
      row("First@Example.com"),
      row("member@example.com"),
      row("third@example.com"),
    ]);

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([
      { email: "first@example.com", success: true },
      { email: "member@example.com", success: false, failureReason: "user_already_member" },
      { email: "third@example.com", success: true },
    ]);
    expect(mocks.reserveInviteRateLimit).toHaveBeenCalledWith(ORG_ID, USER_ID, 3);
    expect(mocks.settleInviteRateLimit).toHaveBeenCalledWith(RESERVATION, 2);
    expect(mocks.sendInviteMemberEmail).toHaveBeenCalledWith(
      "invite-1",
      "first@example.com",
      "Inviter",
      "Row",
      ORG_ID,
      USER_ID
    );
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "team_members_bulk_invited",
      { organization_id: ORG_ID, invited_count: 2, total_count: 3 },
      { organizationId: ORG_ID }
    );
    expect(lastAudit()).toEqual(
      expect.objectContaining({
        action: "created",
        targetType: "invite",
        status: "success",
        organizationId: ORG_ID,
        newObject: {
          invitedCount: 2,
          totalCount: 3,
          emails: ["first@example.com", "third@example.com"],
        },
      })
    );
  });

  test("hands the whole reservation back when every row fails", async () => {
    mocks.inviteUser.mockRejectedValue(new InvalidInputError("Invite already exists"));

    const response = await bulk([row("a@example.com"), row("b@example.com")]);

    expect((await response.json()).data).toEqual([
      { email: "a@example.com", success: false, failureReason: "invite_already_exists" },
      { email: "b@example.com", success: false, failureReason: "invite_already_exists" },
    ]);
    expect(mocks.settleInviteRateLimit).toHaveBeenCalledWith(RESERVATION, 0);
  });

  test("keeps a created row a success when its email can't be sent", async () => {
    mocks.sendInviteMemberEmail.mockRejectedValue(new Error("smtp unavailable"));

    expect((await (await bulk([row("a@example.com")])).json()).data).toEqual([
      { email: "a@example.com", success: true },
    ]);
  });

  test("refuses the bulk invite without its entitlement", async () => {
    mocks.getBulkInvitePermission.mockResolvedValue(false);

    const response = await bulk([row("a@example.com")]);

    expect(response.status).toBe(403);
    expect(await detail(response)).toBe("Bulk invite is not available on your current plan");
    expect(mocks.reserveInviteRateLimit).not.toHaveBeenCalled();
  });

  test("refuses an owner or manager below the floor, and a team admin", async () => {
    denyFloor();
    const belowFloor = await bulk([row("a@example.com")]);
    expect(belowFloor.status).toBe(403);
    expect(await detail(belowFloor)).toBe("User management is not allowed for your role");

    mocks.can.mockResolvedValue(true);
    callerIs("member");
    mocks.getTeamsWhereUserIsAdmin.mockResolvedValue([TEAM_ID]);
    mocks.can.mockImplementation(async (_actor: unknown, action: string) => action === "team.manage");
    expect((await bulk([row("a@example.com", "member", [TEAM_ID])])).status).toBe(403);
    expect(mocks.inviteUser).not.toHaveBeenCalled();
  });

  test("refuses the whole batch for one row the caller may not give, before anything is written", async () => {
    callerIs("manager");

    const response = await bulk([row("a@example.com"), row("b@example.com", "owner")]);

    expect(response.status).toBe(403);
    expect(await detail(response)).toBe("Managers can only give the Member and Dashboard viewer roles");
    expect(mocks.inviteUser).not.toHaveBeenCalled();
  });

  test("refuses a billing row off Cloud with 400 naming the invitees", async () => {
    const response = await bulk([row("a@example.com", "billing")]);

    expect(response.status).toBe(400);
    expect((await response.json()).invalid_params).toEqual([
      { name: "invitees", reason: "Billing role is not allowed" },
    ]);
  });

  test("refuses while invites are disabled", async () => {
    mocks.inviteDisabled = true;

    const response = await bulk([row("a@example.com")]);

    expect(response.status).toBe(403);
    expect(await detail(response)).toBe("Invite disabled");
  });

  test.each([
    ["no rows", [], "No invitees provided"],
    [
      `more than ${BULK_INVITE_MAX_INVITEES} rows`,
      Array.from({ length: BULK_INVITE_MAX_INVITEES + 1 }, (_unused, index) => row(`r${index}@example.com`)),
      `A bulk invite is limited to ${BULK_INVITE_MAX_INVITEES} members at a time`,
    ],
  ])("rejects %s with 400 and its reason", async (_label, invitees, reason) => {
    const response = await bulk(invitees);

    expect(response.status).toBe(400);
    expect((await response.json()).invalid_params[0].reason).toBe(reason);
    expect(mocks.reserveInviteRateLimit).not.toHaveBeenCalled();
  });

  test(`accepts exactly ${BULK_INVITE_MAX_INVITEES} rows`, async () => {
    const invitees = Array.from({ length: BULK_INVITE_MAX_INVITEES }, (_unused, index) =>
      row(`r${index}@example.com`)
    );

    expect((await bulk(invitees)).status).toBe(200);
    expect(mocks.reserveInviteRateLimit).toHaveBeenCalledWith(ORG_ID, USER_ID, BULK_INVITE_MAX_INVITEES);
  });
});
