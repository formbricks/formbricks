import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  getMembershipByUserIdOrganizationId: vi.fn(),
  getOrganizationOwnerCount: vi.fn(),
  updateMembership: vi.fn(),
  checkRoleManagementPermission: vi.fn(),
  transaction: vi.fn(),
  queueAuditEvent: vi.fn(),
  isFormbricksCloud: true,
}));

vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  get IS_FORMBRICKS_CLOUD() {
    return mocks.isFormbricksCloud;
  },
}));
vi.mock("@formbricks/database", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: mocks.getMembershipByUserIdOrganizationId,
}));
vi.mock("@/modules/organization/settings/teams/lib/membership", () => ({
  getOrganizationOwnerCount: mocks.getOrganizationOwnerCount,
}));
vi.mock("@/modules/ee/role-management/lib/membership", () => ({ updateMembership: mocks.updateMembership }));
vi.mock("@/modules/ee/role-management/lib/permission", () => ({
  checkRoleManagementPermission: mocks.checkRoleManagementPermission,
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
const TX = { $queryRaw: vi.fn() };

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
  {
    organizationId = ORG_ID,
    userId = TARGET_USER_ID,
    headers = SAME_ORIGIN_HEADERS as Record<string, string>,
  } = {}
) =>
  PATCH(
    new NextRequest(url(organizationId, userId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ userId }) } as never
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
  mocks.getOrganizationOwnerCount.mockResolvedValue(2);
  // The last-owner guard runs the owner count and the update in one transaction; the fake runs the
  // callback with a stand-in tx so both still reach the mocks.
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(TX));
  mocks.updateMembership.mockImplementation(async (userId: string, _orgId: string, data: { role: string }) =>
    membership(userId, data.role)
  );
});

describe("PATCH /api/internal/members/{userId}", () => {
  describe("the last-owner guard", () => {
    test("refuses to demote the last owner of the organization with 409, and writes nothing", async () => {
      mocks.getOrganizationOwnerCount.mockResolvedValue(1);
      const response = await setRole("member");

      expect(response.status).toBe(409);
      expect((await response.json()).detail).toBe("You cannot demote the last owner of the organization");
      expect(mocks.updateMembership).not.toHaveBeenCalled();
    });

    test("demotes an owner while the organization has another, counting and writing in one transaction", async () => {
      const response = await setRole("member");

      expect(response.status).toBe(200);
      expect((await response.json()).data).toEqual({
        userId: TARGET_USER_ID,
        organizationId: ORG_ID,
        role: "member",
      });
      expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: "Serializable",
      });
      expect(mocks.getOrganizationOwnerCount).toHaveBeenCalledWith(ORG_ID, TX);
      expect(mocks.updateMembership).toHaveBeenCalledWith(TARGET_USER_ID, ORG_ID, { role: "member" }, TX);
    });

    test("locks the organization's owner memberships before counting them, as the members sweep does", async () => {
      await setRole("member");

      const [sql, ...values] = TX.$queryRaw.mock.calls[0];
      expect(sql.join("?")).toMatch(
        /FROM "Membership"[\s\S]*"role" = 'owner'[\s\S]*ORDER BY "userId"[\s\S]*FOR UPDATE/
      );
      expect(values).toEqual([ORG_ID]);
      expect(TX.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.getOrganizationOwnerCount.mock.invocationCallOrder[0]
      );
    });

    test("changes a non-owner's role without counting owners", async () => {
      roles({ caller: "owner", target: "member" });

      expect((await setRole("manager")).status).toBe(200);
      expect(mocks.transaction).not.toHaveBeenCalled();
      expect(mocks.updateMembership).toHaveBeenCalledWith(TARGET_USER_ID, ORG_ID, { role: "manager" });
    });

    test("keeps an owner's role unchanged without counting owners", async () => {
      expect((await setRole("owner")).status).toBe(200);
      expect(mocks.getOrganizationOwnerCount).not.toHaveBeenCalled();
    });

    test("refuses a manager demoting an owner before the owner count is read", async () => {
      roles({ caller: "manager", target: "owner" });
      const response = await setRole("member");

      expect(response.status).toBe(403);
      expect((await response.json()).detail).toBe("Only owners can change the role of an owner");
      expect(mocks.getOrganizationOwnerCount).not.toHaveBeenCalled();
      expect(mocks.updateMembership).not.toHaveBeenCalled();
    });
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

  test("refuses a caller without user management with 403 and the reason, and asks nothing further", async () => {
    allow("organization.manage");
    const response = await setRole("member");

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("User management is not allowed for your role");
    expect(checkedActions()).toEqual(["organization.manage_access"]);
    expect(mocks.updateMembership).not.toHaveBeenCalled();
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
    expect((await response.json()).detail).toBe("Managers can only assign users to the member role");
    expect(mocks.updateMembership).not.toHaveBeenCalled();
  });

  test("lets a manager assign the member role to a non-owner", async () => {
    roles({ caller: "manager", target: "billing" });
    expect((await setRole("member")).status).toBe(200);
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
      { params: Promise.resolve({ userId: TARGET_USER_ID }) } as never
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
