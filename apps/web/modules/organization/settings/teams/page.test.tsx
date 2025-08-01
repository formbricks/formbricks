import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TeamsPage } from "./page";

vi.mock(
  "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar",
  () => ({
    OrganizationSettingsNavbar: (props) => <div data-testid="org-navbar">OrgNavbar-{props.activeId}</div>,
  })
);

vi.mock("@/lib/constants", () => ({
  USER_MANAGEMENT_MINIMUM_ROLE: "owner",
  IS_FORMBRICKS_CLOUD: 1,
  ENCRYPTION_KEY: "test-key",
  ENTERPRISE_LICENSE_KEY: "test-enterprise-key",
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getAccessControlPermission: vi.fn(),
}));

vi.mock("@/modules/ee/teams/team-list/components/teams-view", () => ({
  TeamsView: (props) => <div data-testid="teams-view">TeamsView-{props.organizationId}</div>,
}));

vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(),
}));

vi.mock("@/modules/organization/settings/teams/components/members-view", () => ({
  MembersView: (props) => <div data-testid="members-view">MembersView-{props.membershipRole}</div>,
}));

vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: ({ children }) => <div data-testid="content-wrapper">{children}</div>,
}));

vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: ({ children, pageTitle }) => (
    <div data-testid="page-header">
      <span>{pageTitle}</span>
      {children}
    </div>
  ),
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

const mockParams = { environmentId: "env-1" };
const mockOrg = { id: "org-1", billing: { plan: "free" } };
const mockMembership = { role: "owner" };
const mockSession = { user: { id: "user-1" } };

describe("TeamsPage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders all main components and passes props", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      session: mockSession,
      currentUserMembership: mockMembership,
      organization: mockOrg,
    } as any);
    vi.mocked(getAccessControlPermission).mockResolvedValue(true);
    const props = { params: Promise.resolve(mockParams) };
    render(await TeamsPage(props));
    expect(screen.getByTestId("content-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("page-header")).toBeInTheDocument();
    expect(screen.getByTestId("org-navbar")).toHaveTextContent("OrgNavbar-teams");
    expect(screen.getByTestId("members-view")).toHaveTextContent("MembersView-owner");
    expect(screen.getByTestId("teams-view")).toHaveTextContent("TeamsView-org-1");
    expect(screen.getByText("environments.settings.general.organization_settings")).toBeInTheDocument();
  });

  test("passes correct props to role management util", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      session: mockSession,
      currentUserMembership: mockMembership,
      organization: mockOrg,
    } as any);
    vi.mocked(getAccessControlPermission).mockResolvedValue(false);
    const props = { params: Promise.resolve(mockParams) };
    render(await TeamsPage(props));
    expect(getAccessControlPermission).toHaveBeenCalledWith("free");
  });
});
