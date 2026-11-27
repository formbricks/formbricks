import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS, SAME_ORIGIN_REQUEST_HEADERS } from "@/app/api/v3/lib/test-utils";
import { MCP_GRANT_REVOKE_TRANSACTION_TIMEOUT_MS } from "@/lib/authzed/mcp-grant-timeouts";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { LastActiveOwnerError } from "@/modules/organization/settings/teams/lib/owner-guard";
import { PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  getMembershipByUserIdOrganizationId: vi.fn(),
  runOwnerGuardedTransaction: vi.fn(),
  queryRaw: vi.fn(),
  lockUserActiveState: vi.fn(),
  updateMembership: vi.fn(),
  updateMembershipInTransaction: vi.fn(),
  projectMembershipRoleChange: vi.fn(),
  finishRevokedMcpGrants: vi.fn(),
  checkRoleManagementPermission: vi.fn(),
  getIsDashboardViewerRoleEnabled: vi.fn(),
  queueAuditEvent: vi.fn(),
  isFormbricksCloud: true,
}));

vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  get IS_FORMBRICKS_CLOUD() {
    return mocks.isFormbricksCloud;
  },
}));
vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: mocks.getMembershipByUserIdOrganizationId,
}));
// The owners' lock and its count are owner-guard's, covered by its own tests and the last-owner race
// integration test; here it runs the change with a stand-in tx, or refuses as the real guard would.
vi.mock("@/modules/organization/settings/teams/lib/owner-guard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/organization/settings/teams/lib/owner-guard")>()),
  runOwnerGuardedTransaction: mocks.runOwnerGuardedTransaction,
}));
vi.mock("@/modules/organization/settings/teams/lib/membership", () => ({ deleteMembership: vi.fn() }));
vi.mock("@/lib/user/reactivation", () => ({ lockUserActiveState: mocks.lockUserActiveState }));
vi.mock("@/modules/ee/role-management/lib/membership", () => ({
  updateMembership: mocks.updateMembership,
  updateMembershipInTransaction: mocks.updateMembershipInTransaction,
  projectMembershipRoleChange: mocks.projectMembershipRoleChange,
}));
vi.mock("@/modules/auth/lib/mcp-grant-revocation", () => ({
  finishRevokedMcpGrants: mocks.finishRevokedMcpGrants,
}));
// The real role rules (`assertCanAssignRole`); only the licence lookup is stubbed.
vi.mock("@/modules/ee/role-management/lib/permission", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/role-management/lib/permission")>()),
  checkRoleManagementPermission: mocks.checkRoleManagementPermission,
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getAccessControlPermission: vi.fn().mockResolvedValue(true),
  getIsDashboardViewerRoleEnabled: mocks.getIsDashboardViewerRoleEnabled,
}));
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

const ORG_ID = "cm9gptbhg0000192zceq9ayuc";
const OTHER_ORG_ID = "cm9gptbhg0003192zceq9ayuf";
const CURRENT_USER_ID = "cm9gptbhg0001192zceq9ayud";
const TARGET_USER_ID = "cm9gptbhg0002192zceq9ayue";
const GRANT_AUDITS = [{ grantId: "grant-1" }];
// The guarded transaction's stand-in; `$queryRaw` answers the locked read of the member's role.
const TX = { stand: "in", $queryRaw: mocks.queryRaw };

const membership = (userId: string, role: string) => ({
  userId,
  organizationId: ORG_ID,
  role,
  accepted: true,
});

/** The caller's and the target's roles in the organization (`null` for no membership). */
const roles = ({ caller, target }: { caller: string | null; target: string | null }) =>
  mocks.getMembershipByUserIdOrganizationId.mockImplementation(async (userId: string) => {
    const role = userId === CURRENT_USER_ID ? caller : target;
    return role ? membership(userId, role) : null;
  });

const url = (organizationId = ORG_ID, userId = TARGET_USER_ID) =>
  `http://localhost/api/internal/members/${userId}?organizationId=${organizationId}`;

const patch = (
  body: unknown,
  { organizationId = ORG_ID, userId = TARGET_USER_ID, headers = SAME_ORIGIN_REQUEST_HEADERS } = {}
) =>
  PATCH(
    new NextRequest(url(organizationId, userId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ userId }) }
  );

const setRole = (role: string) => patch({ role });

const allow = (...actions: string[]) =>
  mocks.can.mockImplementation(async (_actor: unknown, action: string) => actions.includes(action));

const checkedActions = () => mocks.can.mock.calls.map(([, action]) => action);
const lastAudit = () => mocks.queueAuditEvent.mock.calls.at(-1)?.[0];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isFormbricksCloud = true;
  mocks.getSession.mockResolvedValue({ user: { id: CURRENT_USER_ID } });
  mocks.applyRateLimit.mockResolvedValue(undefined);
  allow("organization.manage_access", "organization.manage");
  roles({ caller: "owner", target: "owner" });
  mocks.checkRoleManagementPermission.mockResolvedValue(undefined);
  mocks.queryRaw.mockResolvedValue([{ role: "member" }]);
  // The last-owner guard runs the change in its own transaction; the fake runs the
  // callback with a stand-in tx so both still reach the mocks.
  mocks.runOwnerGuardedTransaction.mockImplementation(
    async (_orgId: string, _userId: string | null, callback: (tx: unknown) => unknown) => callback(TX)
  );
  mocks.updateMembership.mockImplementation(async (userId: string, _orgId: string, data: { role: string }) =>
    membership(userId, data.role)
  );
  mocks.updateMembershipInTransaction.mockImplementation(
    async (_tx: unknown, userId: string, _orgId: string, data: { role: string }) => ({
      membership: membership(userId, data.role),
      grantAudits: GRANT_AUDITS,
      affectedTeamIds: ["team-1"],
    })
  );
  mocks.projectMembershipRoleChange.mockResolvedValue(undefined);
  mocks.finishRevokedMcpGrants.mockResolvedValue(undefined);
});

describe("PATCH /api/internal/members/{userId}", () => {
  describe("the last-owner guard", () => {
    test("refuses to demote the last owner of the organization with 409, and writes nothing", async () => {
      mocks.runOwnerGuardedTransaction.mockRejectedValue(new LastActiveOwnerError());
      const response = await setRole("member");

      expect(response.status).toBe(409);
      expect((await response.json()).detail).toBe("You cannot demote the last owner of the organization");
      expect(mocks.updateMembershipInTransaction).not.toHaveBeenCalled();
      expect(mocks.projectMembershipRoleChange).not.toHaveBeenCalled();
      expect(mocks.finishRevokedMcpGrants).not.toHaveBeenCalled();
    });

    test("demotes an owner under the owners' lock, then the user's row, in one transaction", async () => {
      mocks.runOwnerGuardedTransaction.mockImplementation(
        async (_orgId: string, _userId: string | null, callback: (tx: unknown) => unknown) => {
          const result = await callback(TX);
          // Still inside the transaction: the ended grants wait for the commit.
          expect(mocks.finishRevokedMcpGrants).not.toHaveBeenCalled();
          return result;
        }
      );
      const response = await setRole("member");

      expect(response.status).toBe(200);
      expect((await response.json()).data).toEqual({
        userId: TARGET_USER_ID,
        organizationId: ORG_ID,
        role: "member",
      });
      // The guard is told who may leave the owners, so it counts without them before the change runs.
      // Ending the user's MCP grants can wait on a reconciling pass, so the transaction gets its timeout.
      expect(mocks.runOwnerGuardedTransaction).toHaveBeenCalledWith(
        ORG_ID,
        TARGET_USER_ID,
        expect.any(Function),
        {
          timeout: MCP_GRANT_REVOKE_TRANSACTION_TIMEOUT_MS,
        }
      );
      expect(mocks.lockUserActiveState).toHaveBeenCalledWith(TX, TARGET_USER_ID);
      expect(mocks.lockUserActiveState.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.updateMembershipInTransaction.mock.invocationCallOrder[0]
      );
      expect(mocks.updateMembershipInTransaction).toHaveBeenCalledWith(TX, TARGET_USER_ID, ORG_ID, {
        role: "member",
      });
      expect(mocks.updateMembership).not.toHaveBeenCalled();
      // The grants it ended are audited once the transaction commits, with the caller as the actor.
      expect(mocks.finishRevokedMcpGrants).toHaveBeenCalledWith(GRANT_AUDITS, {
        actorUserId: CURRENT_USER_ID,
      });
    });

    test("projects the demotion to SpiceDB after the commit, before the ended grants are finished", async () => {
      let committed = false;
      mocks.runOwnerGuardedTransaction.mockImplementation(
        async (_orgId: string, _userId: string | null, callback: (tx: unknown) => unknown) => {
          const result = await callback(TX);
          committed = true;
          return result;
        }
      );
      mocks.projectMembershipRoleChange.mockImplementation(async () => {
        expect(committed).toBe(true);
        expect(mocks.finishRevokedMcpGrants).not.toHaveBeenCalled();
      });

      expect((await setRole("member")).status).toBe(200);
      expect(mocks.projectMembershipRoleChange).toHaveBeenCalledTimes(1);
      expect(mocks.projectMembershipRoleChange).toHaveBeenCalledWith(ORG_ID, TARGET_USER_ID, ["team-1"]);
    });

    test("audits only the grants of the attempt that committed when the guard retries the demotion", async () => {
      const firstAttempt = [{ grantId: "grant-first-attempt" }];
      const committedAttempt = [{ grantId: "grant-committed" }];
      mocks.updateMembershipInTransaction
        .mockResolvedValueOnce({
          membership: membership(TARGET_USER_ID, "member"),
          grantAudits: firstAttempt,
          affectedTeamIds: [],
        })
        .mockResolvedValueOnce({
          membership: membership(TARGET_USER_ID, "member"),
          grantAudits: committedAttempt,
          affectedTeamIds: [],
        });
      // The guard aborts the first attempt (a serialization conflict) and runs the change again.
      mocks.runOwnerGuardedTransaction.mockImplementation(
        async (_orgId: string, _userId: string | null, callback: (tx: unknown) => unknown) => {
          await callback(TX);
          return callback(TX);
        }
      );

      expect((await setRole("member")).status).toBe(200);
      expect(mocks.finishRevokedMcpGrants).toHaveBeenCalledTimes(1);
      expect(mocks.finishRevokedMcpGrants).toHaveBeenCalledWith(committedAttempt, {
        actorUserId: CURRENT_USER_ID,
      });
    });

    // The lookup before the lock may be stale: the member it saw can have been made an owner, and every
    // other owner taken out, before this change commits (ENG-2177). So the guard reads the role itself.
    test("decides under the owners' lock whether changing a non-owner's role takes an owner out", async () => {
      roles({ caller: "owner", target: "member" });

      expect((await setRole("manager")).status).toBe(200);
      expect(mocks.runOwnerGuardedTransaction).toHaveBeenCalledWith(
        ORG_ID,
        TARGET_USER_ID,
        expect.any(Function),
        { timeout: MCP_GRANT_REVOKE_TRANSACTION_TIMEOUT_MS }
      );
      expect(mocks.updateMembershipInTransaction).toHaveBeenCalledWith(TX, TARGET_USER_ID, ORG_ID, {
        role: "manager",
      });
      expect(mocks.updateMembership).not.toHaveBeenCalled();
      // The caller is the actor of any MCP grant the change ends.
      expect(mocks.finishRevokedMcpGrants).toHaveBeenCalledWith(GRANT_AUDITS, {
        actorUserId: CURRENT_USER_ID,
      });
    });

    test("refuses with 409 when the member the lookup saw has since become the last owner", async () => {
      roles({ caller: "owner", target: "member" });
      mocks.runOwnerGuardedTransaction.mockRejectedValue(new LastActiveOwnerError());
      const response = await setRole("member");

      expect(response.status).toBe(409);
      expect((await response.json()).detail).toBe("You cannot demote the last owner of the organization");
      expect(mocks.updateMembership).not.toHaveBeenCalled();
    });

    test("refuses a manager whose target became an owner after the lookup, and writes nothing", async () => {
      roles({ caller: "manager", target: "member" });
      mocks.queryRaw.mockResolvedValue([{ role: "owner" }]);
      const response = await setRole("member");

      expect(response.status).toBe(403);
      expect((await response.json()).detail).toBe("Only owners can change the role of an owner");
      expect(mocks.updateMembershipInTransaction).not.toHaveBeenCalled();
      expect(mocks.projectMembershipRoleChange).not.toHaveBeenCalled();
    });

    test("lets a manager change a member the locked read still finds a non-owner", async () => {
      roles({ caller: "manager", target: "member" });

      expect((await setRole("member")).status).toBe(200);
      expect(mocks.queryRaw).toHaveBeenCalledOnce();
      expect(mocks.updateMembershipInTransaction).toHaveBeenCalledOnce();
    });

    test("doesn't re-read the role under the lock for an owner, whom the rule doesn't limit", async () => {
      roles({ caller: "owner", target: "member" });

      expect((await setRole("manager")).status).toBe(200);
      expect(mocks.queryRaw).not.toHaveBeenCalled();
    });

    test("makes a member an owner without counting owners", async () => {
      roles({ caller: "owner", target: "member" });

      expect((await setRole("owner")).status).toBe(200);
      expect(mocks.runOwnerGuardedTransaction).not.toHaveBeenCalled();
      expect(mocks.updateMembership).toHaveBeenCalledWith(
        TARGET_USER_ID,
        ORG_ID,
        { role: "owner" },
        CURRENT_USER_ID
      );
    });

    test("keeps an owner's role unchanged without counting owners", async () => {
      expect((await setRole("owner")).status).toBe(200);
      expect(mocks.runOwnerGuardedTransaction).not.toHaveBeenCalled();
    });

    test("refuses a manager demoting an owner before the owner count is read", async () => {
      roles({ caller: "manager", target: "owner" });
      const response = await setRole("member");

      expect(response.status).toBe(403);
      expect((await response.json()).detail).toBe("Only owners can change the role of an owner");
      expect(mocks.runOwnerGuardedTransaction).not.toHaveBeenCalled();
      expect(mocks.updateMembership).not.toHaveBeenCalled();
    });
  });

  // A sole owner demoting themselves would leave an organization nobody can repair (ENG-2177): no manager
  // may make an owner, and only an owner may change an owner's role.
  test("refuses the caller changing their own role with 403, and writes nothing", async () => {
    const response = await patch({ role: "member" }, { userId: CURRENT_USER_ID });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You cannot change your own role");
    expect(mocks.runOwnerGuardedTransaction).not.toHaveBeenCalled();
    expect(mocks.updateMembership).not.toHaveBeenCalled();
    expect(mocks.updateMembershipInTransaction).not.toHaveBeenCalled();
  });

  test("asks organization.manage_access, then organization.manage, of the named organization", async () => {
    roles({ caller: "owner", target: "member" });
    await setRole("manager");

    expect(checkedActions()).toEqual(["organization.manage_access", "organization.manage"]);
    expect(mocks.can).toHaveBeenCalledWith(
      { type: "user", id: CURRENT_USER_ID },
      "organization.manage_access",
      { type: "organization", id: ORG_ID }
    );
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: CURRENT_USER_ID }, "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
  });

  test("refuses a caller without user management with 403 and its reason, and writes nothing", async () => {
    allow("organization.manage");
    const response = await setRole("member");

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("User management is not allowed for your role");
    expect(mocks.runOwnerGuardedTransaction).not.toHaveBeenCalled();
    expect(mocks.updateMembership).not.toHaveBeenCalled();
  });

  test("answers user management's reason even when organization.manage is refused too", async () => {
    allow();
    const response = await setRole("member");

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("User management is not allowed for your role");
  });

  test("refuses a caller without organization.manage, and audits the refusal against the membership", async () => {
    allow("organization.manage_access");
    expect((await setRole("member")).status).toBe(403);
    expect(mocks.updateMembership).not.toHaveBeenCalled();
    expect(lastAudit()).toEqual(
      expect.objectContaining({
        action: "updated",
        targetType: "membership",
        status: "failure",
        organizationId: ORG_ID,
        targetId: `${TARGET_USER_ID}-${ORG_ID}`,
      })
    );
  });

  test("refuses a caller who isn't a member of the named organization, before any check", async () => {
    mocks.getMembershipByUserIdOrganizationId.mockResolvedValue(null);
    const response = await setRole("member");

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.getMembershipByUserIdOrganizationId).toHaveBeenCalledWith(CURRENT_USER_ID, ORG_ID);
    expect(mocks.can).not.toHaveBeenCalled();
  });

  test("checks the caller's membership in the organization named, not their own", async () => {
    mocks.getMembershipByUserIdOrganizationId.mockImplementation(
      async (userId: string, organizationId: string) =>
        organizationId === ORG_ID ? membership(userId, "owner") : null
    );
    expect((await patch({ role: "member" }, { organizationId: OTHER_ORG_ID })).status).toBe(403);
    expect(mocks.updateMembership).not.toHaveBeenCalled();
  });

  test("spends the organization's state-mutation budget", async () => {
    roles({ caller: "owner", target: "member" });
    await setRole("manager");
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.stateMutation, ORG_ID);
  });

  test("answers 400 for the billing role outside Formbricks Cloud", async () => {
    mocks.isFormbricksCloud = false;
    roles({ caller: "owner", target: "member" });
    const response = await setRole("billing");

    expect(response.status).toBe(400);
    expect((await response.json()).detail).toBe("Billing role is not allowed");
    expect(mocks.updateMembership).not.toHaveBeenCalled();
  });

  test("refuses a manager who assigns anything but the member role", async () => {
    roles({ caller: "manager", target: "member" });
    const response = await setRole("manager");

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe(
      "Managers can only give the Member and Dashboard viewer roles"
    );
    expect(mocks.updateMembership).not.toHaveBeenCalled();
  });

  test("lets a manager assign the member role to a non-owner", async () => {
    roles({ caller: "manager", target: "billing" });
    expect((await setRole("member")).status).toBe(200);
  });

  test("lets a manager give the Dashboard viewer role when the plan has it, and refuses it when not", async () => {
    roles({ caller: "manager", target: "member" });
    mocks.getIsDashboardViewerRoleEnabled.mockResolvedValue(true);
    expect((await setRole("dashboard_viewer")).status).toBe(200);

    mocks.updateMembership.mockClear();
    mocks.getIsDashboardViewerRoleEnabled.mockResolvedValue(false);
    const refused = await setRole("dashboard_viewer");
    expect(refused.status).toBe(403);
    expect((await refused.json()).detail).toBe("The Dashboard viewer role is not available on this plan");
    expect(mocks.updateMembership).not.toHaveBeenCalled();
  });

  test("refuses with the licence's reason after authorizing, when there is no role management", async () => {
    roles({ caller: "owner", target: "member" });
    mocks.checkRoleManagementPermission.mockRejectedValue(
      new OperationNotAllowedError("Role management is not allowed for this organization")
    );
    const response = await setRole("manager");

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Role management is not allowed for this organization");
    expect(mocks.updateMembership).not.toHaveBeenCalled();
    // Both authorization checks ran, and both before the licence: a caller who may not manage the
    // organization never learns whether it holds the entitlement.
    expect(checkedActions()).toEqual(["organization.manage_access", "organization.manage"]);
    const [licenceCheck] = mocks.checkRoleManagementPermission.mock.invocationCallOrder;
    expect(Math.max(...mocks.can.mock.invocationCallOrder)).toBeLessThan(licenceCheck);
  });

  test("answers 403 for a user who isn't a member of the organization", async () => {
    roles({ caller: "owner", target: null });
    expect((await setRole("member")).status).toBe(403);
    expect(mocks.updateMembership).not.toHaveBeenCalled();
  });

  test("audits a role change with the membership before and after", async () => {
    roles({ caller: "owner", target: "member" });
    await setRole("manager");

    expect(lastAudit()).toEqual(
      expect.objectContaining({
        action: "updated",
        targetType: "membership",
        status: "success",
        organizationId: ORG_ID,
        targetId: `${TARGET_USER_ID}-${ORG_ID}`,
        oldObject: membership(TARGET_USER_ID, "member"),
        newObject: membership(TARGET_USER_ID, "manager"),
      })
    );
  });

  test.each([
    ["an unknown role", { role: "admin" }],
    ["an unknown field", { role: "member", accepted: false }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await patch(body)).status).toBe(400);
    expect(mocks.updateMembership).not.toHaveBeenCalled();
  });

  test("answers 400 without an organization", async () => {
    const response = await PATCH(
      new NextRequest(`http://localhost/api/internal/members/${TARGET_USER_ID}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...SAME_ORIGIN_HEADERS },
        body: JSON.stringify({ role: "member" }),
      }),
      { params: Promise.resolve({ userId: TARGET_USER_ID }) }
    );
    expect(response.status).toBe(400);
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await setRole("member")).status).toBe(401);
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await patch({ role: "member" }, { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(
      403
    );
    expect(mocks.updateMembership).not.toHaveBeenCalled();
  });
});
