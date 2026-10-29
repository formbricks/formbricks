import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError, OperationNotAllowedError, TooManyRequestsError } from "@formbricks/types/errors";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { can } from "@/lib/authorization";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getOrganization, updateOrganization } from "@/lib/organization/service";
import { checkRoleManagementPermission } from "@/modules/ee/role-management/lib/permission";
import { sendInviteMemberEmail } from "@/modules/email";
import { assertInviteIsNew, inviteUser } from "@/modules/organization/settings/teams/lib/invite";
import {
  reserveInviteRateLimit,
  settleInviteRateLimit,
} from "@/modules/organization/settings/teams/lib/invite-rate-limit";
import { inviteV3OrganizationMember, updateV3Organization } from "./operations";

const constants = vi.hoisted(() => ({ INVITE_DISABLED: false }));

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));
vi.mock("@/app/api/v3/lib/audit", () => ({ skipV3AuditLog: vi.fn() }));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  get INVITE_DISABLED() {
    return constants.INVITE_DISABLED;
  },
}));
vi.mock("@/lib/membership/service", () => ({ getMembershipByUserIdOrganizationId: vi.fn() }));
vi.mock("@/lib/organization/service", () => ({ getOrganization: vi.fn(), updateOrganization: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/ee/role-management/lib/permission", () => ({ checkRoleManagementPermission: vi.fn() }));
vi.mock("@/modules/email", () => ({ sendInviteMemberEmail: vi.fn() }));
vi.mock("@/modules/organization/settings/teams/lib/invite", () => ({
  inviteUser: vi.fn(),
  assertInviteIsNew: vi.fn(),
}));
vi.mock("@/modules/organization/settings/teams/lib/invite-rate-limit", () => ({
  reserveInviteRateLimit: vi.fn(),
  settleInviteRateLimit: vi.fn(),
}));

const organizationId = "tz4a98xxat96iws9zmbrgj3a";
const requestId = "req_1";
const instance = "/api/mcp";
const owner = { user: { id: "user_owner", name: "Olivia Owner" }, expires: "2099-01-01" } as never;
const apiKey = { apiKeyId: "key_1", organizationId, workspacePermissions: [] } as never;

const params = (body: unknown, authentication: unknown = owner, auditLog?: Record<string, unknown>) => ({
  organizationId,
  body,
  authentication: authentication as never,
  requestId,
  instance,
  auditLog: auditLog as never,
});

describe("updateV3Organization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    constants.INVITE_DISABLED = false;
    vi.mocked(can).mockResolvedValue(true);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "owner" } as never);
  });

  const previous = { id: organizationId, name: "Acme", updatedAt: new Date("2026-01-01T00:00:00Z") };

  test("renames the organization and audits the old and new name", async () => {
    vi.mocked(getOrganization).mockResolvedValue(previous as never);
    vi.mocked(updateOrganization).mockResolvedValue({
      ...previous,
      name: "Acme Inc",
      updatedAt: new Date("2026-02-01T00:00:00Z"),
    } as never);
    const auditLog: Record<string, unknown> = {};

    const response = await updateV3Organization(params({ name: " Acme Inc " }, owner, auditLog));

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      id: organizationId,
      name: "Acme Inc",
      updatedAt: "2026-02-01T00:00:00.000Z",
    });
    expect(updateOrganization).toHaveBeenCalledExactlyOnceWith(organizationId, { name: "Acme Inc" });
    expect(auditLog).toMatchObject({
      organizationId,
      targetId: organizationId,
      oldObject: { name: "Acme" },
      newObject: { name: "Acme Inc" },
    });
    expect(can).toHaveBeenCalledWith({ type: "user", id: "user_owner" }, "organization.manage", {
      type: "organization",
      id: organizationId,
    });
  });

  test("a rename to the current name writes and audits nothing", async () => {
    vi.mocked(getOrganization).mockResolvedValue(previous as never);
    const auditLog = {};

    const response = await updateV3Organization(params({ name: "Acme" }, owner, auditLog));

    expect(response.status).toBe(200);
    expect(updateOrganization).not.toHaveBeenCalled();
    expect(skipV3AuditLog).toHaveBeenCalledWith(auditLog);
  });

  test("a role that is not owner or manager is refused even if the graph said yes", async () => {
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "member" } as never);

    const response = await updateV3Organization(params({ name: "Acme Inc" }));

    expect(response.status).toBe(403);
    expect(updateOrganization).not.toHaveBeenCalled();
  });

  test("an organization that vanished answers the same 403 as an unauthorized caller", async () => {
    vi.mocked(getOrganization).mockResolvedValue(null);

    const response = await updateV3Organization(params({ name: "Acme Inc" }));

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
  });

  test("a user who is not an owner or manager gets 403 and nothing is written", async () => {
    vi.mocked(can).mockResolvedValue(false);
    const auditLog: Record<string, unknown> = {};

    const response = await updateV3Organization(params({ name: "Acme Inc" }, owner, auditLog));

    expect(response.status).toBe(403);
    expect(updateOrganization).not.toHaveBeenCalled();
    // The organization id came from the request: it is not recorded as the audited tenant.
    expect(auditLog.organizationId).toBeUndefined();
  });

  test("an API key is refused before any permission lookup", async () => {
    const response = await updateV3Organization(params({ name: "Acme Inc" }, apiKey));

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toMatch(/API keys cannot/);
    expect(can).not.toHaveBeenCalled();
    expect(updateOrganization).not.toHaveBeenCalled();
  });

  test("no authentication is 401", async () => {
    const response = await updateV3Organization(params({ name: "Acme Inc" }, null));
    expect(response.status).toBe(401);
  });

  test("rejects an empty name and an unknown key with 400", async () => {
    for (const body of [{ name: "  " }, { name: "Acme", role: "owner" }, {}]) {
      expect((await updateV3Organization(params(body))).status).toBe(400);
    }
    expect(updateOrganization).not.toHaveBeenCalled();
  });

  test("a spent rate limit answers 429", async () => {
    const { applyRateLimit } = await import("@/modules/core/rate-limit/helpers");
    vi.mocked(applyRateLimit).mockRejectedValue(new TooManyRequestsError("slow down", 30));

    expect((await updateV3Organization(params({ name: "Acme Inc" }))).status).toBe(429);
  });
});

describe("inviteV3OrganizationMember", () => {
  const body = { email: "new@example.com", name: "Nora New", role: "member" };

  beforeEach(() => {
    vi.resetAllMocks();
    constants.INVITE_DISABLED = false;
    vi.mocked(can).mockResolvedValue(true);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "owner" } as never);
    vi.mocked(assertInviteIsNew).mockResolvedValue(null);
    vi.mocked(checkRoleManagementPermission).mockResolvedValue(undefined);
    vi.mocked(reserveInviteRateLimit).mockResolvedValue({} as never);
    vi.mocked(inviteUser).mockResolvedValue("invite_1");
    vi.mocked(sendInviteMemberEmail).mockResolvedValue(true);
  });

  test("without confirm it only previews: no invite, no email, no rate-limit spend, no audit", async () => {
    const auditLog = {};

    const response = await inviteV3OrganizationMember(params(body, owner, auditLog));

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({
      status: "preview",
      organizationId,
      email: "new@example.com",
      name: "Nora New",
      role: "member",
    });
    expect(inviteUser).not.toHaveBeenCalled();
    expect(sendInviteMemberEmail).not.toHaveBeenCalled();
    expect(reserveInviteRateLimit).not.toHaveBeenCalled();
    expect(skipV3AuditLog).toHaveBeenCalledWith(auditLog);
    // It ran the same precondition the confirmed call does.
    expect(assertInviteIsNew).toHaveBeenCalledExactlyOnceWith({ email: "new@example.com", organizationId });
  });

  test.each(["Invite already exists", "User is already a member of this organization"])(
    "the preview answers the same 409 the confirmed call would (%s), without writing, mailing or spending budget",
    async (message) => {
      vi.mocked(assertInviteIsNew).mockRejectedValue(new InvalidInputError(message));
      const auditLog = {};

      const response = await inviteV3OrganizationMember(params(body, owner, auditLog));

      expect(response.status).toBe(409);
      expect((await response.json()).detail).toBe(message);
      expect(inviteUser).not.toHaveBeenCalled();
      expect(sendInviteMemberEmail).not.toHaveBeenCalled();
      expect(reserveInviteRateLimit).not.toHaveBeenCalled();
      expect(skipV3AuditLog).toHaveBeenCalledWith(auditLog);
    }
  );

  test("a preview failing for another reason is not turned into a conflict", async () => {
    vi.mocked(assertInviteIsNew).mockRejectedValue(new Error("database down"));

    expect((await inviteV3OrganizationMember(params(body))).status).toBe(500);
  });

  test("the confirmed call leaves the already-a-member check to inviteUser (no second lookup)", async () => {
    await inviteV3OrganizationMember(params({ ...body, confirm: true }));

    expect(assertInviteIsNew).not.toHaveBeenCalled();
  });

  test("confirm: false is still a preview", async () => {
    const response = await inviteV3OrganizationMember(params({ ...body, confirm: false }));

    expect((await response.json()).data.status).toBe("preview");
    expect(inviteUser).not.toHaveBeenCalled();
  });

  test("with confirm it creates the invite with no teams, sends the email and settles the budget", async () => {
    const auditLog: Record<string, unknown> = {};

    const response = await inviteV3OrganizationMember(params({ ...body, confirm: true }, owner, auditLog));

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({
      status: "invited",
      inviteId: "invite_1",
      emailSent: true,
      role: "member",
    });
    expect(inviteUser).toHaveBeenCalledExactlyOnceWith({
      organizationId,
      invitee: { email: "new@example.com", name: "Nora New", role: "member", teamIds: [] },
      currentUserId: "user_owner",
    });
    expect(sendInviteMemberEmail).toHaveBeenCalledWith(
      "invite_1",
      "new@example.com",
      "Olivia Owner",
      "Nora New",
      organizationId
    );
    expect(settleInviteRateLimit).toHaveBeenCalledWith(expect.anything(), 1);
    expect(auditLog).toMatchObject({ organizationId, targetId: "invite_1" });
    expect(skipV3AuditLog).not.toHaveBeenCalled();
  });

  test("a failing email does not fail the stored invite", async () => {
    vi.mocked(sendInviteMemberEmail).mockRejectedValue(new Error("smtp down"));

    const response = await inviteV3OrganizationMember(params({ ...body, confirm: true }));

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ status: "invited", emailSent: false });
  });

  test("an owner may invite a manager, a manager may not", async () => {
    const asOwner = await inviteV3OrganizationMember(params({ ...body, role: "manager", confirm: true }));
    expect(asOwner.status).toBe(200);

    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({ role: "manager" } as never);
    const asManager = await inviteV3OrganizationMember(params({ ...body, role: "manager", confirm: true }));
    expect(asManager.status).toBe(403);
    expect(inviteUser).toHaveBeenCalledTimes(1);

    const memberAsManager = await inviteV3OrganizationMember(params({ ...body, confirm: true }));
    expect(memberAsManager.status).toBe(200);
  });

  test("owner and billing roles cannot be granted, and unknown keys are rejected", async () => {
    for (const bad of [{ role: "owner" }, { role: "billing" }, { teamIds: ["x"] }]) {
      const response = await inviteV3OrganizationMember(params({ ...body, ...bad, confirm: true }));
      expect(response.status).toBe(400);
    }
    expect(inviteUser).not.toHaveBeenCalled();
  });

  test("a malformed email is 400", async () => {
    const response = await inviteV3OrganizationMember(params({ ...body, email: "nope", confirm: true }));
    expect(response.status).toBe(400);
  });

  test("a non-owner/manager and an API key are refused, even with confirm", async () => {
    vi.mocked(can).mockResolvedValue(false);
    expect((await inviteV3OrganizationMember(params({ ...body, confirm: true }))).status).toBe(403);

    expect((await inviteV3OrganizationMember(params({ ...body, confirm: true }, apiKey))).status).toBe(403);
    expect(inviteUser).not.toHaveBeenCalled();
    expect(sendInviteMemberEmail).not.toHaveBeenCalled();
  });

  test("a plan without role management answers 403 with a reason, also for the preview", async () => {
    vi.mocked(checkRoleManagementPermission).mockRejectedValue(new OperationNotAllowedError("no"));

    const response = await inviteV3OrganizationMember(params(body));

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toMatch(/plan/);
  });

  test("a disabled instance refuses invites", async () => {
    constants.INVITE_DISABLED = true;

    const response = await inviteV3OrganizationMember(params({ ...body, confirm: true }));

    expect(response.status).toBe(403);
    expect(inviteUser).not.toHaveBeenCalled();
  });

  test("an existing invite or member is a 409 and gives the budget back", async () => {
    vi.mocked(inviteUser).mockRejectedValue(new InvalidInputError("Invite already exists"));

    const response = await inviteV3OrganizationMember(params({ ...body, confirm: true }));

    expect(response.status).toBe(409);
    expect((await response.json()).detail).toBe("Invite already exists");
    expect(settleInviteRateLimit).toHaveBeenCalledWith(expect.anything(), 0);
    expect(sendInviteMemberEmail).not.toHaveBeenCalled();
  });
});
