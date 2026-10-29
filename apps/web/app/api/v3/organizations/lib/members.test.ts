import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { can } from "@/lib/authorization";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { updateMembership } from "@/modules/ee/role-management/lib/membership";
import { checkRoleManagementPermission } from "@/modules/ee/role-management/lib/permission";
import {
  deleteMembership,
  getOrganizationOwnerCount,
} from "@/modules/organization/settings/teams/lib/membership";
import { getMemberDirectory } from "@/modules/shell/organization/lib/member-directory";
import type { TMemberRow } from "@/modules/shell/organization/lib/member-rows";
import { requireV3UserManagement } from "./access";
import {
  listV3OrganizationMembers,
  removeV3OrganizationMember,
  updateV3OrganizationMemberRole,
} from "./members";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));
vi.mock("@formbricks/database", () => ({ prisma: { $transaction: vi.fn() } }));
vi.mock("@/app/api/v3/lib/audit", () => ({ skipV3AuditLog: vi.fn() }));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/membership/service", () => ({ getMembershipByUserIdOrganizationId: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: vi.fn() }));
vi.mock("@/modules/ee/role-management/lib/membership", () => ({ updateMembership: vi.fn() }));
vi.mock("@/modules/ee/role-management/lib/permission", () => ({ checkRoleManagementPermission: vi.fn() }));
vi.mock("@/modules/organization/settings/teams/lib/membership", () => ({
  deleteMembership: vi.fn(),
  getOrganizationOwnerCount: vi.fn(),
}));
vi.mock("@/modules/shell/organization/lib/member-directory", () => ({ getMemberDirectory: vi.fn() }));

const organizationId = "tz4a98xxat96iws9zmbrgj3a";
const actorId = "user_actor";
const targetId = "user_target";
const requestId = "req_1";
const instance = "/api/mcp";
const session = { user: { id: actorId, name: "Actor" }, expires: "2099-01-01" } as never;
const apiKey = { apiKeyId: "key_1", organizationId, workspacePermissions: [] } as never;

const base = { organizationId, authentication: session, requestId, instance };

/** The acting user's role, then (on the second lookup) the target's. */
const memberships = (actor: string | null, target?: string | null) => {
  vi.mocked(getMembershipByUserIdOrganizationId).mockImplementation(async (userId) => {
    const role = userId === actorId ? actor : target;
    return role ? ({ userId, organizationId, role } as never) : null;
  });
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(can).mockResolvedValue(true);
  vi.mocked(getOrganizationOwnerCount).mockResolvedValue(2);
  vi.mocked(prisma.$transaction).mockImplementation((async (run: (tx: unknown) => unknown) =>
    run({})) as never);
});

const row = (overrides: Partial<TMemberRow>): TMemberRow => ({
  kind: "member",
  id: "a",
  name: "Ada",
  email: "ada@example.com",
  role: "member",
  status: "active",
  twoFactorEnabled: true,
  teamNames: ["Product"],
  invitedAt: null,
  ...overrides,
});

describe("requireV3UserManagement", () => {
  test("asks for organization.manage_access on top of the owner-or-manager check", async () => {
    memberships("manager");
    vi.mocked(can).mockImplementation(async (_actor, action) => action !== "organization.manage_access");

    const result = await requireV3UserManagement(session, organizationId, requestId, instance);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect(((await (result as Response).json()) as { detail: string }).detail).toMatch(/User management/);
  });
});

describe("listV3OrganizationMembers", () => {
  const query = { limit: 50 };

  beforeEach(() => {
    memberships("manager");
    vi.mocked(getMemberDirectory).mockResolvedValue({
      rows: [
        row({ id: "m1", twoFactorEnabled: true, teamNames: ["Product"] }),
        row({
          kind: "invite",
          id: "i1",
          status: "pending",
          twoFactorEnabled: null,
          teamNames: [],
          invitedAt: new Date("2026-06-08T12:00:00Z"),
        }),
      ],
      isTruncated: false,
    });
  });

  test("an owner or manager gets two-factor state and teams, and the invite date as ISO text", async () => {
    const response = await listV3OrganizationMembers({ ...base, query });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(getMemberDirectory).toHaveBeenCalledWith(organizationId, true);
    // Ordered by id, so the invite (i1) comes before the member (m1).
    expect(body.data).toEqual([
      expect.objectContaining({ id: "i1", kind: "invite", invitedAt: "2026-06-08T12:00:00.000Z" }),
      expect.objectContaining({ id: "m1", twoFactorEnabled: true, teamNames: ["Product"], invitedAt: null }),
    ]);
    expect(body.meta).toEqual({ limit: 50, nextCursor: null, totalCount: 2, totalCountRelation: "eq" });
  });

  test("a plain member never loads the sensitive fields, and teams read as null", async () => {
    memberships("member");

    const response = await listV3OrganizationMembers({ ...base, query });

    expect(getMemberDirectory).toHaveBeenCalledWith(organizationId, false);
    expect((await response.json()).data.map((r: { teamNames: unknown }) => r.teamNames)).toEqual([
      null,
      null,
    ]);
  });

  test("the billing role, a stranger and an API key get no list", async () => {
    vi.mocked(can).mockResolvedValue(false);
    expect((await listV3OrganizationMembers({ ...base, query })).status).toBe(403);

    vi.mocked(can).mockResolvedValue(true);
    memberships(null);
    expect((await listV3OrganizationMembers({ ...base, query })).status).toBe(403);

    expect((await listV3OrganizationMembers({ ...base, authentication: apiKey, query })).status).toBe(403);
    expect((await listV3OrganizationMembers({ ...base, authentication: null, query })).status).toBe(401);
    expect(getMemberDirectory).not.toHaveBeenCalled();
  });

  test("filters by kind, pages by id with an opaque cursor, and rejects a forged cursor", async () => {
    const onlyInvites = await listV3OrganizationMembers({ ...base, query: { ...query, kind: "invite" } });
    expect((await onlyInvites.json()).data.map((r: { id: string }) => r.id)).toEqual(["i1"]);

    const first = await (await listV3OrganizationMembers({ ...base, query: { limit: 1 } })).json();
    expect(first.data).toHaveLength(1);
    expect(first.meta).toMatchObject({ totalCount: 2, nextCursor: expect.any(String) });
    const second = await (
      await listV3OrganizationMembers({ ...base, query: { limit: 1, cursor: first.meta.nextCursor } })
    ).json();
    expect(second.data[0].id).not.toBe(first.data[0].id);

    const forged = await listV3OrganizationMembers({ ...base, query: { limit: 1, cursor: "%%%" } });
    expect(forged.status).toBe(400);
  });

  test("a directory cut at its cap reports a lower bound", async () => {
    vi.mocked(getMemberDirectory).mockResolvedValue({ rows: [row({})], isTruncated: true });

    const body = await (await listV3OrganizationMembers({ ...base, query })).json();

    expect(body.meta.totalCountRelation).toBe("gte");
  });
});

describe("updateV3OrganizationMemberRole", () => {
  const params = (body: unknown, extra: Record<string, unknown> = {}) => ({
    ...base,
    userId: targetId,
    body,
    ...extra,
  });

  beforeEach(() => {
    vi.mocked(checkRoleManagementPermission).mockResolvedValue(undefined);
    vi.mocked(updateMembership).mockResolvedValue({} as never);
  });

  test("without confirm it previews, writes nothing and audits nothing", async () => {
    memberships("owner", "manager");
    const auditLog = {};

    const response = await updateV3OrganizationMemberRole(params({ role: "member" }, { auditLog }));

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({
      status: "preview",
      previousRole: "manager",
      role: "member",
      lowersAccess: true,
    });
    expect(updateMembership).not.toHaveBeenCalled();
    expect(applyRateLimit).not.toHaveBeenCalled();
    expect(skipV3AuditLog).toHaveBeenCalledWith(auditLog);
  });

  test("with confirm it changes the role and audits the old and new one", async () => {
    memberships("owner", "member");
    const auditLog: Record<string, unknown> = {};

    const response = await updateV3OrganizationMemberRole(
      params({ role: "manager", confirm: true }, { auditLog })
    );

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ status: "updated", lowersAccess: false });
    expect(updateMembership).toHaveBeenCalledExactlyOnceWith(targetId, organizationId, { role: "manager" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(auditLog).toMatchObject({
      organizationId,
      targetId: `${targetId}-${organizationId}`,
      oldObject: { role: "member" },
      newObject: { role: "manager" },
    });
  });

  test("the current role is a no-op that writes and audits nothing", async () => {
    memberships("owner", "member");
    const auditLog = {};

    const response = await updateV3OrganizationMemberRole(
      params({ role: "member", confirm: true }, { auditLog })
    );

    expect((await response.json()).data.status).toBe("unchanged");
    expect(updateMembership).not.toHaveBeenCalled();
    expect(skipV3AuditLog).toHaveBeenCalledWith(auditLog);
  });

  test.each([
    ["owner", { role: "owner" }],
    ["billing", { role: "billing" }],
    ["an unknown key", { role: "member", userId: "x" }],
  ])("an agent cannot grant %s", async (_label, body) => {
    memberships("owner", "member");

    expect((await updateV3OrganizationMemberRole(params(body))).status).toBe(400);
    expect(updateMembership).not.toHaveBeenCalled();
  });

  test("you cannot change your own role", async () => {
    memberships("owner", "owner");

    const response = await updateV3OrganizationMemberRole(
      params({ role: "member", confirm: true }, { userId: actorId })
    );

    expect(response.status).toBe(403);
    expect(updateMembership).not.toHaveBeenCalled();
  });

  test("a manager assigns only member and never touches an owner", async () => {
    memberships("manager", "member");
    expect((await updateV3OrganizationMemberRole(params({ role: "manager", confirm: true }))).status).toBe(
      403
    );

    memberships("manager", "owner");
    expect((await updateV3OrganizationMemberRole(params({ role: "member", confirm: true }))).status).toBe(
      403
    );
    expect(updateMembership).not.toHaveBeenCalled();
  });

  test("a member who is not in the organization answers the hidden 403", async () => {
    memberships("owner", null);

    const response = await updateV3OrganizationMemberRole(params({ role: "member", confirm: true }));

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
  });

  test("a plan without role management refuses before anything is written", async () => {
    memberships("owner", "member");
    vi.mocked(checkRoleManagementPermission).mockRejectedValue(new OperationNotAllowedError("no"));

    const response = await updateV3OrganizationMemberRole(params({ role: "manager", confirm: true }));

    expect(response.status).toBe(403);
    expect(updateMembership).not.toHaveBeenCalled();
  });

  test("demoting an owner counts owners inside a serializable transaction", async () => {
    memberships("owner", "owner");

    const response = await updateV3OrganizationMemberRole(params({ role: "manager", confirm: true }));

    expect(response.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(getOrganizationOwnerCount).toHaveBeenCalledWith(organizationId, {});
    expect(updateMembership).toHaveBeenCalledWith(targetId, organizationId, { role: "manager" }, {});
  });

  test("the last owner cannot be demoted, in the preview as well as the confirmed call", async () => {
    memberships("owner", "owner");
    vi.mocked(getOrganizationOwnerCount).mockResolvedValue(1);

    const preview = await updateV3OrganizationMemberRole(params({ role: "manager" }));
    const confirmed = await updateV3OrganizationMemberRole(params({ role: "manager", confirm: true }));

    expect(preview.status).toBe(409);
    expect(confirmed.status).toBe(409);
    expect(updateMembership).not.toHaveBeenCalled();
  });

  test("a serialization conflict between two owner demotions answers 409", async () => {
    memberships("owner", "owner");
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("conflict", {
        code: PrismaErrorType.TransactionConflict,
        clientVersion: "x",
      })
    );

    const response = await updateV3OrganizationMemberRole(params({ role: "manager", confirm: true }));

    expect(response.status).toBe(409);
  });

  test("an API key is refused before any lookup", async () => {
    const response = await updateV3OrganizationMemberRole(
      params({ role: "member", confirm: true }, { authentication: apiKey })
    );

    expect(response.status).toBe(403);
    expect(getMembershipByUserIdOrganizationId).not.toHaveBeenCalled();
  });
});

describe("removeV3OrganizationMember", () => {
  const params = (extra: Record<string, unknown> = {}) => ({ ...base, userId: targetId, ...extra });

  test("without confirm it previews and removes nothing", async () => {
    memberships("manager", "member");
    const auditLog = {};

    const response = await removeV3OrganizationMember(params({ auditLog }));

    expect((await response.json()).data).toMatchObject({ status: "preview", role: "member" });
    expect(deleteMembership).not.toHaveBeenCalled();
    expect(skipV3AuditLog).toHaveBeenCalledWith(auditLog);
  });

  test("with confirm it removes the member and audits the old membership", async () => {
    memberships("manager", "member");
    const auditLog: Record<string, unknown> = {};

    const response = await removeV3OrganizationMember(params({ confirm: true, auditLog }));

    expect((await response.json()).data.status).toBe("removed");
    expect(deleteMembership).toHaveBeenCalledExactlyOnceWith(targetId, organizationId);
    expect(applyRateLimit).toHaveBeenCalled();
    expect(auditLog).toMatchObject({
      organizationId,
      targetId: `${targetId}-${organizationId}`,
      oldObject: expect.objectContaining({ role: "member" }),
    });
  });

  test("you cannot remove yourself", async () => {
    memberships("owner", "owner");

    const response = await removeV3OrganizationMember(params({ userId: actorId, confirm: true }));

    expect(response.status).toBe(403);
    expect(deleteMembership).not.toHaveBeenCalled();
  });

  test("a manager cannot remove an owner, an owner can while another remains", async () => {
    memberships("manager", "owner");
    expect((await removeV3OrganizationMember(params({ confirm: true }))).status).toBe(403);

    memberships("owner", "owner");
    expect((await removeV3OrganizationMember(params({ confirm: true }))).status).toBe(200);
    expect(deleteMembership).toHaveBeenCalledOnce();
  });

  test("the last owner stays, in the preview as well", async () => {
    memberships("owner", "owner");
    vi.mocked(getOrganizationOwnerCount).mockResolvedValue(1);

    expect((await removeV3OrganizationMember(params())).status).toBe(409);
    expect((await removeV3OrganizationMember(params({ confirm: true }))).status).toBe(409);
    expect(deleteMembership).not.toHaveBeenCalled();
  });

  test("someone who is not a member answers the hidden 403, a plain member cannot remove anyone", async () => {
    memberships("owner", null);
    expect((await removeV3OrganizationMember(params({ confirm: true }))).status).toBe(403);

    memberships("member", "member");
    expect((await removeV3OrganizationMember(params({ confirm: true }))).status).toBe(403);
    expect(deleteMembership).not.toHaveBeenCalled();
  });
});
