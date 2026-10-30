import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  getInvite: vi.fn(),
  getInviteAuditSnapshot: vi.fn(),
  getMembershipByUserIdOrganizationId: vi.fn(),
  checkRoleManagementPermission: vi.fn(),
  updateInvite: vi.fn(),
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
vi.mock("@/lib/utils/services", () => ({ getInvite: mocks.getInvite }));
vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: mocks.getMembershipByUserIdOrganizationId,
}));
vi.mock("@/modules/organization/settings/teams/lib/invite", () => ({
  getInvite: mocks.getInviteAuditSnapshot,
}));
vi.mock("@/modules/ee/role-management/lib/permission", () => ({
  checkRoleManagementPermission: mocks.checkRoleManagementPermission,
}));
vi.mock("@/modules/ee/role-management/lib/invite", () => ({ updateInvite: mocks.updateInvite }));
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
const INVITE_ID = "6a3c1a9e-2f4b-4c8d-9e1f-0a1b2c3d4e5f";

const url = (id = INVITE_ID) => `http://localhost/api/internal/invites/${id}`;
const props = (id = INVITE_ID) => ({ params: Promise.resolve({ inviteId: id }) });

const patch = (
  body: unknown,
  { id = INVITE_ID, headers = SAME_ORIGIN_HEADERS as Record<string, string> } = {}
) =>
  PATCH(
    new NextRequest(url(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    props(id) as never
  );

const allow = (...actions: string[]) =>
  mocks.can.mockImplementation(async (_actor: unknown, action: string) => actions.includes(action));

const checkedActions = () => mocks.can.mock.calls.map(([, action]) => action);
const lastAudit = () => mocks.queueAuditEvent.mock.calls.at(-1)?.[0];
const callerIs = (role: string | null) =>
  mocks.getMembershipByUserIdOrganizationId.mockResolvedValue(
    role ? { userId: USER_ID, organizationId: ORG_ID, role, accepted: true } : null
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isFormbricksCloud = true;
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.applyRateLimit.mockResolvedValue(undefined);
  allow("organization.manage");
  mocks.getInvite.mockResolvedValue({ organizationId: ORG_ID });
  callerIs("owner");
  mocks.checkRoleManagementPermission.mockResolvedValue(undefined);
  mocks.getInviteAuditSnapshot
    .mockResolvedValueOnce({ email: "invitee@example.com", creator: { name: "Owner" } })
    .mockResolvedValueOnce({ email: "invitee@example.com", creator: { name: "Owner" } });
  mocks.updateInvite.mockResolvedValue(true);
});

describe("PATCH /api/internal/invites/{inviteId}", () => {
  test("lets an owner change the invite's role, and audits it against the invite's organization", async () => {
    const response = await patch({ role: "manager" });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ id: INVITE_ID, role: "manager" });
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
    expect(checkedActions()).toEqual(["organization.manage"]);
    expect(mocks.updateInvite).toHaveBeenCalledWith(INVITE_ID, { role: "manager" });
    expect(lastAudit()).toEqual(
      expect.objectContaining({
        action: "updated",
        targetType: "invite",
        status: "success",
        organizationId: ORG_ID,
        targetId: INVITE_ID,
        oldObject: { email: "invitee@example.com", creator: { name: "Owner" } },
        newObject: { email: "invitee@example.com", creator: { name: "Owner" } },
      })
    );
  });

  test("spends the organization's state-mutation budget, after authorizing the caller", async () => {
    await patch({ role: "member" });
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.stateMutation, ORG_ID);
  });

  test("answers 429 when the organization's write budget is spent, and writes nothing", async () => {
    mocks.applyRateLimit.mockImplementation(async (config: { namespace: string }) => {
      if (config.namespace === rateLimitConfigs.actions.stateMutation.namespace) {
        throw new TooManyRequestsError("Maximum number of requests reached. Please try again later.", 30);
      }
    });
    const response = await patch({ role: "member" });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(mocks.updateInvite).not.toHaveBeenCalled();
  });

  test("refuses a caller without organization.manage with 403, and audits the refusal", async () => {
    allow();
    expect((await patch({ role: "member" })).status).toBe(403);
    expect(mocks.applyRateLimit).not.toHaveBeenCalledWith(
      rateLimitConfigs.actions.stateMutation,
      expect.anything()
    );
    expect(mocks.updateInvite).not.toHaveBeenCalled();
    expect(lastAudit()).toEqual(
      expect.objectContaining({ status: "failure", organizationId: ORG_ID, targetId: INVITE_ID })
    );
  });

  test("refuses a caller who isn't a member of the invite's organization, before any check", async () => {
    callerIs(null);
    expect((await patch({ role: "member" })).status).toBe(403);
    expect(mocks.can).not.toHaveBeenCalled();
    expect(mocks.updateInvite).not.toHaveBeenCalled();
  });

  test("answers 403 for an invite that does not exist, and audits the attempt against its id", async () => {
    mocks.getInvite.mockResolvedValue(null);
    const response = await patch({ role: "member" });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.can).not.toHaveBeenCalled();
    expect(lastAudit()).toEqual(expect.objectContaining({ status: "failure", targetId: INVITE_ID }));
  });

  test("answers 403 when the invite is gone by the time it is written", async () => {
    mocks.updateInvite.mockRejectedValue(new ResourceNotFoundError("Invite", INVITE_ID));
    expect((await patch({ role: "member" })).status).toBe(403);
  });

  test("refuses a manager who invites as anything but member", async () => {
    callerIs("manager");
    const response = await patch({ role: "manager" });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Managers can only invite members");
    expect(mocks.updateInvite).not.toHaveBeenCalled();
  });

  test("lets a manager invite as member", async () => {
    callerIs("manager");
    expect((await patch({ role: "member" })).status).toBe(200);
  });

  test("answers 400 for the billing role outside Formbricks Cloud", async () => {
    mocks.isFormbricksCloud = false;
    const response = await patch({ role: "billing" });

    expect(response.status).toBe(400);
    expect((await response.json()).detail).toBe("Billing role is not allowed");
    expect(mocks.updateInvite).not.toHaveBeenCalled();
  });

  test("allows the billing role on Formbricks Cloud", async () => {
    expect((await patch({ role: "billing" })).status).toBe(200);
  });

  test("refuses with the licence's reason after authorizing, when there is no role management", async () => {
    mocks.checkRoleManagementPermission.mockRejectedValue(
      new OperationNotAllowedError("Role management is not allowed for this organization")
    );
    const response = await patch({ role: "member" });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Role management is not allowed for this organization");
    expect(checkedActions()).toEqual(["organization.manage"]);
    expect(mocks.updateInvite).not.toHaveBeenCalled();
  });

  test.each([
    ["an unknown role", { role: "admin" }],
    ["no role", {}],
    ["an unknown field", { role: "member", email: "someone@example.com" }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await patch(body)).status).toBe(400);
    expect(mocks.updateInvite).not.toHaveBeenCalled();
  });

  test("answers 400 for an invite id that isn't a UUID", async () => {
    expect((await patch({ role: "member" }, { id: "clinvite111111111111111111" })).status).toBe(400);
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await patch({ role: "member" }, { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(
      403
    );
    expect(mocks.updateInvite).not.toHaveBeenCalled();
  });
});
