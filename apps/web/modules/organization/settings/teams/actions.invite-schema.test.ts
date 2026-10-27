import { describe, expect, test, vi } from "vitest";
// Registers every action's schema through the mocked client.
import "./actions";

// The invite schema is declared inside the action module, so it is captured from the mocked action
// client rather than exported for tests.
const mocks = vi.hoisted(() => ({
  actionSchemas: [] as Array<{ safeParse: (value: unknown) => { success: boolean } }>,
}));

vi.mock("@formbricks/database", () => ({ prisma: { invite: { findUnique: vi.fn() } } }));
vi.mock("@formbricks/database/prisma", () => ({
  OrganizationRole: { billing: "billing", manager: "manager", member: "member", owner: "owner" },
}));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/authorization", () => ({ assertCan: vi.fn(), can: vi.fn() }));
vi.mock("@/lib/constants", () => ({ INVITE_DISABLED: false, IS_FORMBRICKS_CLOUD: false }));
vi.mock("@/lib/jwt", () => ({ createInviteToken: vi.fn() }));
vi.mock("@/lib/membership/service", () => ({ getMembershipByUserIdOrganizationId: vi.fn() }));
vi.mock("@/lib/membership/utils", () => ({ getAccessFlags: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("@/lib/utils/action-client", () => ({
  authenticatedActionClient: {
    inputSchema: vi.fn((schema: unknown) => {
      mocks.actionSchemas.push(schema as { safeParse: (value: unknown) => { success: boolean } });
      return { action: vi.fn((fn) => fn) };
    }),
  },
}));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromInviteId: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyIPRateLimit: vi.fn(), applyRateLimit: vi.fn() }));
vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: { actions: {}, auth: {} },
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  withAuditLogging: vi.fn((_event: string, _type: string, fn: unknown) => fn),
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getBulkInvitePermission: vi.fn(),
  getIsMultiOrgEnabled: vi.fn(),
}));
vi.mock("@/modules/ee/role-management/actions", () => ({ checkRoleManagementPermission: vi.fn() }));
vi.mock("@/modules/ee/teams/lib/roles", () => ({ getTeamsWhereUserIsAdmin: vi.fn() }));
vi.mock("@/modules/email", () => ({ sendInviteMemberEmail: vi.fn() }));
vi.mock("@/modules/organization/settings/teams/lib/membership", () => ({
  deleteMembership: vi.fn(),
  getMembershipsByUserId: vi.fn(),
  getOrganizationOwnerCount: vi.fn(),
}));
vi.mock("./lib/invite", () => ({
  deleteInvite: vi.fn(),
  getInvite: vi.fn(),
  inviteUser: vi.fn(),
  refreshInviteExpiration: vi.fn(),
  resendInvite: vi.fn(),
}));
vi.mock("./lib/invite-failure", () => ({ getInviteFailureReason: vi.fn() }));
vi.mock("./lib/invite-rate-limit", () => ({ applyInviteRateLimit: vi.fn() }));

describe("single invite input (ENG-6658)", () => {
  const validInvite = {
    organizationId: "clxyz1234567890abcdefghij",
    email: "invitee@example.com",
    name: "Invitee",
    role: "member",
    teamIds: [],
  };
  const inviteSchema = mocks.actionSchemas.find((schema) => schema.safeParse(validInvite).success);

  test("accepts one address", () => {
    expect(inviteSchema).toBeDefined();
  });

  // One invite, and one unit of the invite budget, must not reach several inboxes.
  test.each([
    "a@example.com, b@example.com",
    "a@example.com; b@example.com",
    '"Bob" <b@example.com>',
    "nobody",
  ])("rejects %j as the invitee address", (email) => {
    expect(inviteSchema?.safeParse({ ...validInvite, email }).success).toBe(false);
  });
});
