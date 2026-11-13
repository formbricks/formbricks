import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError, ValidationError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { DELETE } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  getMembershipByUserIdOrganizationId: vi.fn(),
  deleteMembership: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({ prisma: {} }));
vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: mocks.getMembershipByUserIdOrganizationId,
}));
vi.mock("@/modules/organization/settings/teams/lib/membership", () => ({
  deleteMembership: mocks.deleteMembership,
  getOrganizationOwnerCount: vi.fn(),
}));
vi.mock("@/modules/ee/role-management/lib/membership", () => ({ updateMembership: vi.fn() }));
vi.mock("@/modules/ee/role-management/lib/api-access", () => ({
  refuseRoleAssignment: vi.fn(),
  requireRoleManagementEntitlement: vi.fn(),
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
const CALLER_ID = "cm9gptbhg0001192zceq9ayud";
const TARGET_ID = "cm9gptbhg0002192zceq9ayue";

const remove = (userId = TARGET_ID) =>
  DELETE(
    new NextRequest(`http://localhost/api/internal/members/${userId}?organizationId=${ORG_ID}`, {
      method: "DELETE",
      headers: { ...(SAME_ORIGIN_HEADERS as Record<string, string>) },
    }),
    { params: Promise.resolve({ userId }) } as never
  );

const roles = ({ caller, target }: { caller: string | null; target: string | null }) =>
  mocks.getMembershipByUserIdOrganizationId.mockImplementation(async (userId: string) => {
    const role = userId === CALLER_ID ? caller : target;
    return role ? { userId, organizationId: ORG_ID, role, accepted: true } : null;
  });
const lastAudit = () => mocks.queueAuditEvent.mock.calls.at(-1)?.[0];
const checkedActions = () => mocks.can.mock.calls.map(([, action]) => action);
const stateMutationSpent = () =>
  mocks.applyRateLimit.mock.calls.some(([config]) => config === rateLimitConfigs.actions.stateMutation);
const detail = async (response: Response) => (await response.json()).detail;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: CALLER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  roles({ caller: "owner", target: "member" });
  mocks.deleteMembership.mockResolvedValue([]);
});

describe("DELETE /api/internal/members/{userId}", () => {
  test("removes the member after the floor and organization.manage, and audits the membership", async () => {
    const response = await remove();

    expect(response.status).toBe(204);
    expect(checkedActions()).toEqual(["organization.manage_access", "organization.manage"]);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.stateMutation, ORG_ID);
    expect(mocks.deleteMembership).toHaveBeenCalledWith(TARGET_ID, ORG_ID);
    expect(lastAudit()).toEqual(
      expect.objectContaining({
        action: "deleted",
        targetType: "membership",
        status: "success",
        organizationId: ORG_ID,
        targetId: `${TARGET_ID}-${ORG_ID}`,
        oldObject: { userId: TARGET_ID, organizationId: ORG_ID, role: "member", accepted: true },
      })
    );
  });

  // ENG-6812: the user-management floor holds whatever the UI hides.
  test("refuses an owner or manager below the floor, with its reason", async () => {
    mocks.can.mockImplementation(
      async (_actor: unknown, action: string) => action !== "organization.manage_access"
    );

    const response = await remove();

    expect(response.status).toBe(403);
    expect(await detail(response)).toBe("User management is not allowed for your role");
    expect(mocks.deleteMembership).not.toHaveBeenCalled();
  });

  test("refuses a caller without organization.manage before spending the budget", async () => {
    mocks.can.mockImplementation(async (_actor: unknown, action: string) => action !== "organization.manage");

    expect((await remove()).status).toBe(403);
    expect(stateMutationSpent()).toBe(false);
    expect(mocks.deleteMembership).not.toHaveBeenCalled();
  });

  test("answers a spent budget with 429", async () => {
    mocks.applyRateLimit.mockImplementation(async (config: unknown) => {
      if (config === rateLimitConfigs.actions.stateMutation) throw new TooManyRequestsError("Slow down", 60);
    });

    expect((await remove()).status).toBe(429);
    expect(mocks.deleteMembership).not.toHaveBeenCalled();
  });

  test("refuses removing yourself", async () => {
    const response = await remove(CALLER_ID);

    expect(response.status).toBe(403);
    expect(await detail(response)).toBe("You cannot delete yourself from the organization");
  });

  test("keeps an owner out of a manager's reach", async () => {
    roles({ caller: "manager", target: "owner" });

    const response = await remove();

    expect(response.status).toBe(403);
    expect(await detail(response)).toBe("You cannot delete the owner of the organization");
    expect(mocks.deleteMembership).not.toHaveBeenCalled();
  });

  test("answers a missing member with the uniform 403", async () => {
    roles({ caller: "owner", target: null });

    const response = await remove();

    expect(response.status).toBe(403);
    expect(await detail(response)).toBe("You are not authorized to access this resource");
  });

  test("answers the last-owner guard, run inside the delete's transaction, with 409", async () => {
    roles({ caller: "owner", target: "owner" });
    mocks.deleteMembership.mockRejectedValue(
      new ValidationError("You cannot delete the last owner of the organization")
    );

    const response = await remove();

    expect(response.status).toBe(409);
    expect(await detail(response)).toBe("You cannot delete the last owner of the organization");
  });

  test("rejects a missing organization with 400", async () => {
    const response = await DELETE(
      new NextRequest(`http://localhost/api/internal/members/${TARGET_ID}`, {
        method: "DELETE",
        headers: { ...(SAME_ORIGIN_HEADERS as Record<string, string>) },
      }),
      { params: Promise.resolve({ userId: TARGET_ID }) } as never
    );

    expect(response.status).toBe(400);
  });
});
