import { redirect } from "next/navigation";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthenticationError, AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import type { TMembership, TOrganizationRole } from "@formbricks/types/memberships";
import { can } from "@/lib/authorization";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getOrganization } from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import { canUserNavigateWorkspace } from "@/lib/workspace/auth";
import { getWorkspace } from "@/lib/workspace/service";
import { getSession } from "@/modules/auth/lib/session";
import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/license";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";
import { getWorkspacePermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getWorkspaceAuth, getWorkspaceLayoutData, workspaceIdLayoutChecks } from "./utils";

const mocks = vi.hoisted(() => ({ isFormbricksCloud: false, workspaceFindUnique: vi.fn() }));

// Real getAccessFlags and getTeamPermissionFlags are used on purpose so the tests exercise the
// actual role -> isBilling mapping (the redirect branch) and the permission -> isReadOnly mapping.
// Everything else getWorkspaceAuth touches is stubbed. next/navigation is globally mocked in
// vitestSetup.ts, so `redirect` is a no-op spy here.
vi.mock("react", () => ({ cache: (fn: (...args: unknown[]) => unknown) => fn }));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  IS_FORMBRICKS_CLOUD: mocks.isFormbricksCloud,
}));
vi.mock("@/lib/workspace/service", () => ({ getWorkspace: vi.fn() }));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/workspace/auth", () => ({ canUserNavigateWorkspace: vi.fn() }));
vi.mock("@formbricks/database", () => ({ prisma: { workspace: { findUnique: mocks.workspaceFindUnique } } }));
vi.mock("@/lib/user/service", () => ({ getUser: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getAccessControlPermission: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/license", () => ({ getEnterpriseLicense: vi.fn() }));
vi.mock("@/lib/organization/service", () => ({
  getOrganization: vi.fn(),
  getMonthlyOrganizationResponseCount: vi.fn(),
}));
vi.mock("@/lib/membership/service", () => ({ getMembershipByUserIdOrganizationId: vi.fn() }));
vi.mock("@/lib/membership/navigation", () => ({ getBillingFallbackPath: vi.fn() }));
vi.mock("@/lingodotdev/server", () => ({ getTranslate: vi.fn(() => Promise.resolve((k: string) => k)) }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/modules/ee/teams/lib/roles", () => ({ getWorkspacePermissionByUserId: vi.fn() }));

const workspaceId = "workspace-1";
const organizationId = "organization-1";
const userId = "user-1";
const billingFallbackPath = `/organizations/${organizationId}/settings/enterprise`;

const primeAuth = (role: TOrganizationRole) => {
  vi.mocked(getWorkspace).mockResolvedValue({ id: workspaceId, organizationId } as Awaited<
    ReturnType<typeof getWorkspace>
  >);
  vi.mocked(getSession).mockResolvedValue({
    user: { id: userId },
    expires: new Date(0).toISOString(),
  } as Awaited<ReturnType<typeof getSession>>);
  vi.mocked(getOrganization).mockResolvedValue({ id: organizationId } as Awaited<
    ReturnType<typeof getOrganization>
  >);
  vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({
    role,
    organizationId,
    userId,
    accepted: true,
  } as TMembership);
  vi.mocked(can).mockResolvedValue(true);
  vi.mocked(getWorkspacePermissionByUserId).mockResolvedValue(null);
  vi.mocked(getBillingFallbackPath).mockReturnValue(billingFallbackPath);
};

describe("getWorkspaceAuth billing gate (ENG-1763)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("redirects a billing-role member to the billing fallback path", async () => {
    primeAuth("billing");

    await getWorkspaceAuth(workspaceId);

    expect(getBillingFallbackPath).toHaveBeenCalledWith(organizationId, mocks.isFormbricksCloud);
    expect(redirect).toHaveBeenCalledWith(billingFallbackPath);
  });

  test.each<TOrganizationRole>(["owner", "manager", "member"])(
    "does not redirect a %s member",
    async (role) => {
      primeAuth(role);

      const result = await getWorkspaceAuth(workspaceId);

      expect(redirect).not.toHaveBeenCalled();
      expect(getBillingFallbackPath).not.toHaveBeenCalled();
      expect(result.isBilling).toBe(false);
    }
  );
});

describe("getWorkspaceAuth workspace-access gate + isReadOnly (ENG-1769)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Happy-path default: an org member with read-only workspace access.
    primeAuth("member");
    vi.mocked(getWorkspacePermissionByUserId).mockResolvedValue("read");
  });

  test("throws ResourceNotFoundError when the workspace is missing", async () => {
    vi.mocked(getWorkspace).mockResolvedValue(null);
    await expect(getWorkspaceAuth(workspaceId)).rejects.toThrow(ResourceNotFoundError);
  });

  test("throws AuthenticationError when there is no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await expect(getWorkspaceAuth(workspaceId)).rejects.toThrow(AuthenticationError);
  });

  test("throws ResourceNotFoundError when the organization is missing", async () => {
    vi.mocked(getOrganization).mockResolvedValue(null);
    await expect(getWorkspaceAuth(workspaceId)).rejects.toThrow(ResourceNotFoundError);
  });

  test("throws AuthorizationError when the user has no org membership", async () => {
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null);
    await expect(getWorkspaceAuth(workspaceId)).rejects.toThrow(AuthorizationError);
  });

  // The core fix: an org member with no WorkspaceTeam grant for this workspace
  // must be rejected instead of being admitted (and mislabeled as a writer).
  test("throws AuthorizationError when the user has no workspace access", async () => {
    vi.mocked(can).mockResolvedValue(false);
    vi.mocked(getWorkspacePermissionByUserId).mockResolvedValue(null);
    await expect(getWorkspaceAuth(workspaceId)).rejects.toThrow(AuthorizationError);
    // The narrow read permission, not the navigation check: billing has already been
    // redirected above, so this choke point must not re-admit it.
    expect(can).toHaveBeenCalledWith({ type: "user", id: userId }, "workspace.read", {
      type: "workspace",
      id: workspaceId,
    });
  });

  test("marks a member with a read grant as read-only", async () => {
    vi.mocked(getWorkspacePermissionByUserId).mockResolvedValue("read");
    const auth = await getWorkspaceAuth(workspaceId);
    expect(auth.isMember).toBe(true);
    expect(auth.hasReadAccess).toBe(true);
    expect(auth.isReadOnly).toBe(true);
  });

  test("does not mark a member with a readWrite grant as read-only", async () => {
    vi.mocked(getWorkspacePermissionByUserId).mockResolvedValue("readWrite");
    const auth = await getWorkspaceAuth(workspaceId);
    expect(auth.hasReadWriteAccess).toBe(true);
    expect(auth.isReadOnly).toBe(false);
  });

  test("does not mark a member with a manage grant as read-only", async () => {
    vi.mocked(getWorkspacePermissionByUserId).mockResolvedValue("manage");
    const auth = await getWorkspaceAuth(workspaceId);
    expect(auth.hasManageAccess).toBe(true);
    expect(auth.isReadOnly).toBe(false);
  });

  // Fail-safe: even if a member reaches the flags with no resolved permission,
  // isReadOnly must be true (most restricted), never false (writer).
  test("treats a member with no resolved permission as read-only (fail safe)", async () => {
    vi.mocked(getWorkspacePermissionByUserId).mockResolvedValue(null);
    const auth = await getWorkspaceAuth(workspaceId);
    expect(auth.isMember).toBe(true);
    expect(auth.hasReadAccess).toBe(false);
    expect(auth.hasReadWriteAccess).toBe(false);
    expect(auth.hasManageAccess).toBe(false);
    expect(auth.isReadOnly).toBe(true);
  });

  test("does not mark an owner as read-only", async () => {
    primeAuth("owner");
    vi.mocked(getWorkspacePermissionByUserId).mockResolvedValue(null);
    const auth = await getWorkspaceAuth(workspaceId);
    expect(auth.isOwner).toBe(true);
    expect(auth.isReadOnly).toBe(false);
  });

  test("returns the resolved workspace, organization, and session on success", async () => {
    const auth = await getWorkspaceAuth(workspaceId);
    expect(auth.workspace).toMatchObject({ id: workspaceId, organizationId });
    expect(auth.organization).toMatchObject({ id: organizationId });
    expect(auth.session.user.id).toBe(userId);
    expect(auth.workspacePermission).toBe("read");
  });
});

// The layout helpers gate navigation rather than data, so unlike getWorkspaceAuth they must keep
// admitting the billing role — that is how it reaches the billing screens. These ids are real
// cuid2s because getWorkspaceLayoutData validates them.
describe("layout navigation gates (ENG-1737)", () => {
  const layoutWorkspaceId = "cl9ebqhxk00003b600tymydho";
  const layoutOrganizationId = "cl9ebqhxk00013b60vqhmydho";
  const layoutUserId = "cl9ebqhxk00023b60kzlmydho";

  const organizationRelation = {
    id: layoutOrganizationId,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    name: "Org",
    billing: { stripeCustomerId: null, limits: {}, usageCycleAnchor: null, stripe: null },
    isAISmartToolsEnabled: false,
    whitelabel: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      user: { id: layoutUserId },
      expires: new Date(0).toISOString(),
    } as Awaited<ReturnType<typeof getSession>>);
    vi.mocked(getUser).mockResolvedValue({ id: layoutUserId } as Awaited<ReturnType<typeof getUser>>);
    vi.mocked(canUserNavigateWorkspace).mockResolvedValue(true);
    mocks.workspaceFindUnique.mockResolvedValue({ organization: organizationRelation });
  });

  describe("workspaceIdLayoutChecks", () => {
    test("asks the navigation question about the resolved workspace and its organization", async () => {
      const result = await workspaceIdLayoutChecks(layoutWorkspaceId);

      expect(canUserNavigateWorkspace).toHaveBeenCalledWith(layoutUserId, {
        id: layoutWorkspaceId,
        organizationId: layoutOrganizationId,
      });
      expect(result.organization).toMatchObject({ id: layoutOrganizationId });
    });

    test("throws AuthorizationError when the user may not navigate there", async () => {
      vi.mocked(canUserNavigateWorkspace).mockResolvedValue(false);

      await expect(workspaceIdLayoutChecks(layoutWorkspaceId)).rejects.toThrow(AuthorizationError);
    });

    // Existence is now answered before access, so a missing workspace reports itself as missing
    // instead of as a denial — matching getWorkspaceAuth.
    test("throws ResourceNotFoundError for a workspace that does not exist", async () => {
      mocks.workspaceFindUnique.mockResolvedValue(null);

      await expect(workspaceIdLayoutChecks(layoutWorkspaceId)).rejects.toThrow(ResourceNotFoundError);
      expect(canUserNavigateWorkspace).not.toHaveBeenCalled();
    });

    test("returns early without deciding access when there is no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const result = await workspaceIdLayoutChecks(layoutWorkspaceId);

      expect(result.session).toBeNull();
      expect(canUserNavigateWorkspace).not.toHaveBeenCalled();
    });
  });

  describe("getWorkspaceLayoutData", () => {
    beforeEach(() => {
      mocks.workspaceFindUnique.mockResolvedValue({
        id: layoutWorkspaceId,
        organizationId: layoutOrganizationId,
        organization: { ...organizationRelation, memberships: [{ userId: layoutUserId, role: "member" }] },
      });
      vi.mocked(getAccessControlPermission).mockResolvedValue(false);
      vi.mocked(getWorkspacePermissionByUserId).mockResolvedValue("read");
      vi.mocked(getEnterpriseLicense).mockResolvedValue({ active: false } as Awaited<
        ReturnType<typeof getEnterpriseLicense>
      >);
    });

    test("asks the navigation question about the resolved workspace and its organization", async () => {
      await getWorkspaceLayoutData(layoutWorkspaceId, layoutUserId);

      expect(canUserNavigateWorkspace).toHaveBeenCalledWith(layoutUserId, {
        id: layoutWorkspaceId,
        organizationId: layoutOrganizationId,
      });
    });

    test("throws AuthorizationError when the user may not navigate there", async () => {
      vi.mocked(canUserNavigateWorkspace).mockResolvedValue(false);

      await expect(getWorkspaceLayoutData(layoutWorkspaceId, layoutUserId)).rejects.toThrow(
        AuthorizationError
      );
    });

    test("throws ResourceNotFoundError for a workspace that does not exist", async () => {
      mocks.workspaceFindUnique.mockResolvedValue(null);

      await expect(getWorkspaceLayoutData(layoutWorkspaceId, layoutUserId)).rejects.toThrow(
        ResourceNotFoundError
      );
      expect(canUserNavigateWorkspace).not.toHaveBeenCalled();
    });
  });
});
