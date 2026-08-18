import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { checkSetupInviteAuthorization, hasSetupInviteAccess } from "./authorization";

// Only the storage boundary is mocked: the real `can`/`assertCan` path runs (the rollout is off in
// the unit environment, so the coordinator resolves through the legacy evaluator), so these
// assertions describe the actual authorization outcome per role rather than the arguments a mock was
// called with. ENG-2409 swapped the implementation from a role list to `organization.write` without
// touching a single assertion below — that equivalence is the point.
vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: vi.fn(),
}));

vi.mock("@/modules/ee/teams/lib/roles", () => ({
  getTeamRoleByTeamIdUserId: vi.fn(),
  getWorkspacePermissionByUserId: vi.fn(),
}));

const userId = "test-user-id";
const organizationId = "test-organization-id";

const mockRole = (role: TOrganizationRole | null) => {
  vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(role ? ({ role } as any) : null);
};

// ENG-2169: the onboarding invite path persists an owner invite and takes no role input, so anything
// other than an owner must be rejected here — a manager passing this check could mint an owner.
const deniedRoles: TOrganizationRole[] = ["manager", "member", "billing"];

describe("checkSetupInviteAuthorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("allows an organization owner", async () => {
    mockRole("owner");

    await expect(checkSetupInviteAuthorization(userId, organizationId)).resolves.not.toThrow();
  });

  test.each(deniedRoles)("rejects a %s", async (role) => {
    mockRole(role);

    await expect(checkSetupInviteAuthorization(userId, organizationId)).rejects.toThrow(AuthorizationError);
  });

  test("rejects a user without a membership in the organization", async () => {
    mockRole(null);

    await expect(checkSetupInviteAuthorization(userId, organizationId)).rejects.toThrow(AuthorizationError);
  });
});

describe("hasSetupInviteAccess", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("is true for an organization owner", async () => {
    mockRole("owner");

    await expect(hasSetupInviteAccess(userId, organizationId)).resolves.toBe(true);
  });

  test.each(deniedRoles)("is false for a %s", async (role) => {
    mockRole(role);

    await expect(hasSetupInviteAccess(userId, organizationId)).resolves.toBe(false);
  });

  test("is false for a user without a membership in the organization", async () => {
    mockRole(null);

    await expect(hasSetupInviteAccess(userId, organizationId)).resolves.toBe(false);
  });
});
