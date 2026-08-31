import { redirect } from "next/navigation";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { redirectBillingRoleFromRestrictedOrgSettings } from "./redirect-billing-role";
import { getOrganizationBillingPath } from "./routes";

/**
 * ENG-2409. This guard fronts five organization settings pages and had no test at all.
 *
 * `can` is deliberately left REAL. The rollout is disabled in the unit environment, so the
 * coordinator short-circuits to the legacy evaluator, which answers `organization.read_access` from
 * `getMembershipByUserIdOrganizationId` — mocked below. That makes the role the only input and the
 * decision path the real one.
 *
 * Note what this deliberately does NOT do: the workspace-scoped analogue
 * (`app/(app)/workspaces/[workspaceId]/settings/lib/redirect-billing-role.test.ts`) mocks the auth
 * helper and hands it a ready-made `isBilling` boolean, so it only ever asserted "if the flag is
 * true we redirect" — an assertion that stops meaning anything the moment the flag stops being the
 * decision, which is exactly what this ticket changed.
 */
vi.mock("@/lib/membership/service", () => ({ getMembershipByUserIdOrganizationId: vi.fn() }));
vi.mock("@/modules/organization/lib/utils", () => ({ getOrganizationAuth: vi.fn() }));

const ORGANIZATION_ID = "org-1";
const USER_ID = "user-1";

const arrangeRole = (role: TOrganizationRole) => {
  vi.mocked(getOrganizationAuth).mockResolvedValue({
    session: { user: { id: USER_ID }, expires: new Date().toISOString() },
  } as Awaited<ReturnType<typeof getOrganizationAuth>>);
  vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({
    role,
    organizationId: ORGANIZATION_ID,
    userId: USER_ID,
    accepted: true,
  });
};

describe("redirectBillingRoleFromRestrictedOrgSettings", () => {
  beforeEach(() => {
    vi.mocked(redirect).mockClear();
  });

  test.each<TOrganizationRole>(["owner", "manager", "member"])(
    "lets a %s through to the settings page",
    async (role) => {
      arrangeRole(role);

      await redirectBillingRoleFromRestrictedOrgSettings(ORGANIZATION_ID);

      expect(redirect).not.toHaveBeenCalled();
    }
  );

  test("redirects the billing role to its billing home", async () => {
    arrangeRole("billing");

    await redirectBillingRoleFromRestrictedOrgSettings(ORGANIZATION_ID);

    // `redirect` is globally mocked and does NOT throw (vitestSetup.ts), so execution continues past
    // it — assert on the call rather than on the guard aborting.
    expect(redirect).toHaveBeenCalledExactlyOnceWith(getOrganizationBillingPath(ORGANIZATION_ID, false));
  });

  test("refuses a caller with no membership row", async () => {
    vi.mocked(getOrganizationAuth).mockResolvedValue({
      session: { user: { id: USER_ID }, expires: new Date().toISOString() },
    } as Awaited<ReturnType<typeof getOrganizationAuth>>);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(null);

    await redirectBillingRoleFromRestrictedOrgSettings(ORGANIZATION_ID);

    // Unreachable in production — `getOrganizationAuth` throws first — but pinned so that the guard
    // fails closed rather than open if that ordering is ever disturbed.
    expect(redirect).toHaveBeenCalledOnce();
  });
});
