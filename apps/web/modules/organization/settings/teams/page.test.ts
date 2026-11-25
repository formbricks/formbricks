import type { ReactElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MembersView } from "@/modules/organization/settings/teams/components/members-view";
import { TeamsPage } from "./page";

const mocks = vi.hoisted(() => ({
  getAccessControlPermission: vi.fn(),
  canManageUsers: vi.fn(),
  getTeamsWhereUserIsAdmin: vi.fn(),
  getOrganizationAuth: vi.fn(),
  userManagementMinimumRole: "manager",
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/constants", () => ({
  get USER_MANAGEMENT_MINIMUM_ROLE() {
    return mocks.userManagementMinimumRole;
  },
}));
vi.mock("@/lingodotdev/server", () => ({ getTranslate: async () => (key: string) => key }));
vi.mock("@/lib/membership/user-management", () => ({ canManageUsers: mocks.canManageUsers }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getAccessControlPermission: mocks.getAccessControlPermission,
}));
vi.mock("@/modules/ee/teams/lib/roles", () => ({ getTeamsWhereUserIsAdmin: mocks.getTeamsWhereUserIsAdmin }));
vi.mock("@/modules/organization/lib/utils", () => ({ getOrganizationAuth: mocks.getOrganizationAuth }));
vi.mock("@/modules/settings/lib/redirect-billing-role", () => ({
  redirectBillingRoleFromRestrictedOrgSettings: vi.fn(),
}));
vi.mock("@/modules/ee/teams/team-list/components/teams-view", () => ({ TeamsView: () => null }));
vi.mock("@/modules/organization/settings/teams/components/members-view", () => ({ MembersView: () => null }));
vi.mock("@/modules/ui/components/page-content-wrapper", () => ({ PageContentWrapper: () => null }));
vi.mock("@/modules/ui/components/page-header", () => ({ PageHeader: () => null }));

type TElement = ReactElement<{ children?: ReactElement[]; isUserManagementDisabledFromUi?: boolean }>;

/** Whether the page hides the members' invite and management controls from this caller. */
const membersControlsHidden = async (): Promise<boolean | undefined> => {
  const page = (await TeamsPage({ params: Promise.resolve({ organizationId: "org-1" }) })) as TElement;
  const membersView = page.props.children?.find((child) => child.type === MembersView) as TElement;
  return membersView.props.isUserManagementDisabledFromUi;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userManagementMinimumRole = "manager";
  mocks.getAccessControlPermission.mockResolvedValue(true);
  mocks.canManageUsers.mockResolvedValue(false);
  mocks.getTeamsWhereUserIsAdmin.mockResolvedValue(["team-1"]);
  mocks.getOrganizationAuth.mockResolvedValue({
    session: { user: { id: "user-1" } },
    currentUserMembership: { role: "member" },
    organization: { id: "org-1" },
  });
});

describe("TeamsPage", () => {
  test.each(["owner", "manager"])(
    "offers a team admin the invite controls at the %s floor",
    async (floor) => {
      mocks.userManagementMinimumRole = floor;

      expect(await membersControlsHidden()).toBe(false);
    }
  );

  // ENG-7376: the controls follow the invite route, which refuses a team admin at `disabled`.
  test("hides the controls from a team admin while user management is disabled", async () => {
    mocks.userManagementMinimumRole = "disabled";

    expect(await membersControlsHidden()).toBe(true);
  });

  test("leaves the controls to the floor's own answer for an owner or manager", async () => {
    mocks.userManagementMinimumRole = "disabled";
    mocks.canManageUsers.mockResolvedValue(true);
    mocks.getTeamsWhereUserIsAdmin.mockResolvedValue([]);

    expect(await membersControlsHidden()).toBe(false);
  });

  test("hides the controls from a team admin without the access control licence", async () => {
    mocks.getAccessControlPermission.mockResolvedValue(false);

    expect(await membersControlsHidden()).toBe(true);
  });
});
