import { redirect } from "next/navigation";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TMembership, TOrganizationRole } from "@formbricks/types/memberships";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getOrganization } from "@/lib/organization/service";
import { getWorkspace } from "@/lib/workspace/service";
import { getSession } from "@/modules/auth/lib/session";
import { getWorkspacePermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getWorkspaceAuth } from "./utils";

const mocks = vi.hoisted(() => ({ isFormbricksCloud: false }));

// Real getAccessFlags is used on purpose so the tests exercise the actual role -> isBilling mapping
// that the redirect branch keys off of. Everything else getWorkspaceAuth touches is stubbed.
vi.mock("react", () => ({ cache: (fn: (...args: unknown[]) => unknown) => fn }));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  IS_FORMBRICKS_CLOUD: mocks.isFormbricksCloud,
}));
vi.mock("@/lib/workspace/service", () => ({ getWorkspace: vi.fn() }));
vi.mock("@/lib/organization/service", () => ({ getOrganization: vi.fn() }));
vi.mock("@/lib/membership/service", () => ({ getMembershipByUserIdOrganizationId: vi.fn() }));
vi.mock("@/lib/membership/navigation", () => ({ getBillingFallbackPath: vi.fn() }));
vi.mock("@/lingodotdev/server", () => ({ getTranslate: vi.fn(() => Promise.resolve((k: string) => k)) }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/modules/ee/teams/lib/roles", () => ({ getWorkspacePermissionByUserId: vi.fn() }));
vi.mock("@/modules/ee/teams/utils/teams", () => ({
  getTeamPermissionFlags: vi.fn(() => ({
    hasReadAccess: false,
    hasReadWriteAccess: false,
    hasManageAccess: false,
  })),
}));

const workspaceId = "workspace-1";
const organizationId = "organization-1";
const billingFallbackPath = `/organizations/${organizationId}/settings/enterprise`;

const primeAuth = (role: TOrganizationRole) => {
  vi.mocked(getWorkspace).mockResolvedValue({ id: workspaceId, organizationId } as Awaited<
    ReturnType<typeof getWorkspace>
  >);
  vi.mocked(getSession).mockResolvedValue({
    user: { id: "user-1" },
    expires: new Date(0).toISOString(),
  } as Awaited<ReturnType<typeof getSession>>);
  vi.mocked(getOrganization).mockResolvedValue({ id: organizationId } as Awaited<
    ReturnType<typeof getOrganization>
  >);
  vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({
    role,
    organizationId,
    userId: "user-1",
    accepted: true,
  } as TMembership);
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
