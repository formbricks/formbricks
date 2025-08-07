import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { getTeamsByOrganizationId } from "@/modules/ee/teams/team-list/lib/team";
import { getMembershipsByUserId } from "@/modules/organization/settings/teams/lib/membership";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { MembersLoading, MembersView } from "./members-view";

vi.mock("@/app/(app)/environments/[environmentId]/settings/components/SettingsCard", () => ({
  SettingsCard: ({ title, description, children }: any) => (
    <div data-testid="SettingsCard">
      <div>{title}</div>
      <div>{description}</div>
      {children}
    </div>
  ),
}));

vi.mock("@/lib/constants", () => ({
  INVITE_DISABLED: false,
  IS_FORMBRICKS_CLOUD: true,
}));

vi.mock("@/modules/organization/settings/teams/components/edit-memberships/organization-actions", () => ({
  OrganizationActions: (props: any) => <div data-testid="OrganizationActions">{JSON.stringify(props)}</div>,
}));

vi.mock("@/modules/organization/settings/teams/components/edit-memberships", () => ({
  EditMemberships: (props: any) => <div data-testid="EditMemberships">{JSON.stringify(props)}</div>,
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

vi.mock("@/modules/organization/settings/teams/lib/membership", () => ({
  getMembershipsByUserId: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsMultiOrgEnabled: vi.fn(),
}));

vi.mock("@/modules/ee/teams/team-list/lib/team", () => ({
  getTeamsByOrganizationId: vi.fn(),
}));

describe("MembersView", () => {
  afterEach(() => {
    cleanup();
  });

  const baseProps = {
    membershipRole: "owner",
    organization: { id: "org-1", name: "Test Org" },
    currentUserId: "user-1",
    environmentId: "env-1",
    isAccessControlAllowed: true,
    isUserManagementDisabledFromUi: false,
  } as any;

  const mockMembership = {
    organizationId: "org-1",
    userId: "user-1",
    accepted: true,
    role: "owner" as TOrganizationRole,
  };

  test("renders SettingsCard and children with correct props", async () => {
    vi.mocked(getMembershipsByUserId).mockResolvedValue([mockMembership]);
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
    vi.mocked(getTeamsByOrganizationId).mockResolvedValue([{ id: "t1", name: "Team 1" }]);

    const ui = await MembersView(baseProps);
    render(ui);
    expect(screen.getByTestId("SettingsCard")).toBeInTheDocument();
    expect(screen.getByText("environments.settings.general.manage_members")).toBeInTheDocument();
    expect(screen.getByText("environments.settings.general.manage_members_description")).toBeInTheDocument();
    expect(screen.getByTestId("OrganizationActions")).toBeInTheDocument();
    expect(screen.getByTestId("EditMemberships")).toBeInTheDocument();
  });

  test("disables leave organization if only one membership", async () => {
    vi.mocked(getMembershipsByUserId).mockResolvedValue([]);
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
    vi.mocked(getTeamsByOrganizationId).mockResolvedValue([{ id: "t1", name: "Team 1" }]);

    const ui = await MembersView(baseProps);
    render(ui);
    expect(screen.getByTestId("OrganizationActions").textContent).toContain(
      '"isLeaveOrganizationDisabled":true'
    );
  });

  test("does not render OrganizationActions or EditMemberships if no membershipRole", async () => {
    vi.mocked(getMembershipsByUserId).mockResolvedValue([mockMembership]);
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
    vi.mocked(getTeamsByOrganizationId).mockResolvedValue([{ id: "t1", name: "Team 1" }]);
    const ui = await MembersView({ ...baseProps, membershipRole: undefined });
    render(ui);
    expect(screen.queryByTestId("OrganizationActions")).toBeNull();
    expect(screen.queryByTestId("EditMemberships")).toBeNull();
  });
});

describe("MembersLoading", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders two skeleton loaders", () => {
    const { container } = render(<MembersLoading />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(2);
    expect(skeletons[0]).toHaveClass("h-8", "w-80", "rounded-full", "bg-slate-200");
  });
});
