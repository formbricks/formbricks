import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { DELETE } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  getMembershipByUserIdOrganizationId: vi.fn(),
  getMembershipsByUserId: vi.fn(),
  deleteMembership: vi.fn(),
  getIsMultiOrgEnabled: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({ prisma: {} }));
vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: mocks.getMembershipByUserIdOrganizationId,
}));
vi.mock("@/modules/organization/settings/teams/lib/membership", () => ({
  deleteMembership: mocks.deleteMembership,
  getMembershipsByUserId: mocks.getMembershipsByUserId,
  getOrganizationOwnerCount: vi.fn(),
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsMultiOrgEnabled: mocks.getIsMultiOrgEnabled }));
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
const USER_ID = "cm9gptbhg0001192zceq9ayud";

const leave = (query = `?organizationId=${ORG_ID}`) =>
  DELETE(
    new NextRequest(`http://localhost/api/internal/members/me${query}`, {
      method: "DELETE",
      headers: { ...(SAME_ORIGIN_HEADERS as Record<string, string>) },
    }),
    { params: Promise.resolve({}) } as never
  );

const memberAs = (role: string | null) =>
  mocks.getMembershipByUserIdOrganizationId.mockResolvedValue(
    role ? { userId: USER_ID, organizationId: ORG_ID, role, accepted: true } : null
  );
const lastAudit = () => mocks.queueAuditEvent.mock.calls.at(-1)?.[0];
const stateMutationSpent = () =>
  mocks.applyRateLimit.mock.calls.some(([config]) => config === rateLimitConfigs.actions.stateMutation);
const detail = async (response: Response) => (await response.json()).detail;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  // SpiceDB refuses a Dashboard viewer `organization.read` (ADR-0025); leaving must not ask anything of it.
  mocks.can.mockResolvedValue(false);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  memberAs("member");
  mocks.getIsMultiOrgEnabled.mockResolvedValue(true);
  mocks.getMembershipsByUserId.mockResolvedValue([{}, {}]);
  mocks.deleteMembership.mockResolvedValue([]);
});

describe("DELETE /api/internal/members/me", () => {
  test("removes the caller's own membership and audits it", async () => {
    const response = await leave();

    expect(response.status).toBe(204);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.stateMutation, ORG_ID);
    expect(mocks.deleteMembership).toHaveBeenCalledWith(USER_ID, ORG_ID);
    expect(lastAudit()).toEqual(
      expect.objectContaining({
        action: "deleted",
        targetType: "membership",
        status: "success",
        organizationId: ORG_ID,
        targetId: `${USER_ID}-${ORG_ID}`,
        oldObject: { userId: USER_ID, organizationId: ORG_ID, role: "member", accepted: true },
      })
    );
  });

  test("lets a Dashboard viewer leave on its own membership alone", async () => {
    memberAs("dashboard_viewer");

    expect((await leave()).status).toBe(204);
    expect(mocks.can).not.toHaveBeenCalled();
  });

  test("refuses someone with no membership before spending the organization's budget", async () => {
    memberAs(null);

    expect((await leave()).status).toBe(403);
    expect(stateMutationSpent()).toBe(false);
    expect(mocks.deleteMembership).not.toHaveBeenCalled();
  });

  test("answers a spent budget with 429", async () => {
    mocks.applyRateLimit.mockImplementation(async (config: unknown) => {
      if (config === rateLimitConfigs.actions.stateMutation) throw new TooManyRequestsError("Slow down", 60);
    });

    expect((await leave()).status).toBe(429);
    expect(mocks.deleteMembership).not.toHaveBeenCalled();
  });

  test.each([
    ["an owner", () => memberAs("owner"), 403, "You cannot leave an organization you own"],
    [
      "anyone where only one organization is allowed",
      () => mocks.getIsMultiOrgEnabled.mockResolvedValue(false),
      403,
      "You cannot leave the organization because you are the only owner and organization deletion is disabled",
    ],
    [
      "someone this is the only organization of",
      () => mocks.getMembershipsByUserId.mockResolvedValue([{}]),
      409,
      "You cannot leave the only organization you are a member of",
    ],
  ])("refuses %s, with the reason", async (_label, arrange, status, reason) => {
    arrange();

    const response = await leave();

    expect(response.status).toBe(status);
    expect(await detail(response)).toBe(reason);
    expect(mocks.deleteMembership).not.toHaveBeenCalled();
  });

  test("rejects a missing organization or an unknown parameter with 400", async () => {
    expect((await leave("")).status).toBe(400);
    expect((await leave(`?organizationId=${ORG_ID}&userId=${USER_ID}`)).status).toBe(400);
  });
});
