import { useSignOut } from "@/modules/auth/hooks/use-sign-out";
import { TOrganizationTeam } from "@/modules/ee/teams/team-list/types/team";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname, useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganization } from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";
import { TUser } from "@formbricks/types/user";
import { getLatestStableFbReleaseAction } from "../actions/actions";
import { MainNavigation } from "./MainNavigation";

// Mock constants that this test needs
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  WEBAPP_URL: "http://localhost:3000",
}));

// Mock server actions that this test needs
vi.mock("@/modules/auth/actions/sign-out", () => ({
  logSignOutAction: vi.fn().mockResolvedValue(undefined),
}));

// Mock dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => "/environments/env1/surveys"),
}));
vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));
vi.mock("@/modules/auth/hooks/use-sign-out", () => ({
  useSignOut: vi.fn(() => ({ signOut: vi.fn() })),
}));
vi.mock("@/app/(app)/environments/[environmentId]/actions/actions", () => ({
  getLatestStableFbReleaseAction: vi.fn(),
}));
vi.mock("@/app/lib/formbricks", () => ({
  formbricksLogout: vi.fn(),
}));
vi.mock("@/lib/membership/utils", () => ({
  getAccessFlags: (role?: string) => ({
    isAdmin: role === "admin",
    isOwner: role === "owner",
    isManager: role === "manager",
    isMember: role === "member",
    isBilling: role === "billing",
  }),
}));
vi.mock("@/modules/organization/components/CreateOrganizationModal", () => ({
  CreateOrganizationModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-org-modal">Create Org Modal</div> : null,
}));
vi.mock("@/modules/projects/components/project-switcher", () => ({
  ProjectSwitcher: ({
    isCollapsed,
    organizationTeams,
    isAccessControlAllowed,
  }: {
    isCollapsed: boolean;
    organizationTeams: TOrganizationTeam[];
    isAccessControlAllowed: boolean;
  }) => (
    <div data-testid="project-switcher" data-collapsed={isCollapsed}>
      Project Switcher
      <div data-testid="organization-teams-count">{organizationTeams?.length || 0}</div>
      <div data-testid="is-access-control-allowed">{isAccessControlAllowed.toString()}</div>
    </div>
  ),
}));
vi.mock("@/modules/ui/components/avatars", () => ({
  ProfileAvatar: () => <div data-testid="profile-avatar">Avatar</div>,
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: any) => <img alt="test" {...props} />,
}));
vi.mock("../../../../../package.json", () => ({
  version: "1.0.0",
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock data
const mockEnvironment: TEnvironment = {
  id: "env1",
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "production",
  projectId: "proj1",
  appSetupCompleted: true,
};
const mockUser = {
  id: "user1",
  name: "Test User",
  email: "test@example.com",
  imageUrl: "http://example.com/avatar.png",
  emailVerified: new Date(),
  twoFactorEnabled: false,
  identityProvider: "email",
  createdAt: new Date(),
  updatedAt: new Date(),
  notificationSettings: { alert: {} },
  role: "project_manager",
  objective: "other",
} as unknown as TUser;

const mockOrganization = {
  id: "org1",
  name: "Test Org",
  createdAt: new Date(),
  updatedAt: new Date(),
  billing: { stripeCustomerId: null, plan: "free", limits: { monthly: { responses: null } } } as any,
} as unknown as TOrganization;

const mockOrganizations: TOrganization[] = [
  mockOrganization,
  { ...mockOrganization, id: "org2", name: "Another Org" },
];
const mockProject: TProject = {
  id: "proj1",
  name: "Test Project",
  createdAt: new Date(),
  updatedAt: new Date(),
  organizationId: "org1",
  environments: [mockEnvironment],
  config: { channel: "website" },
} as unknown as TProject;
const mockProjects: TProject[] = [mockProject];

const defaultProps = {
  environment: mockEnvironment,
  organizations: mockOrganizations,
  user: mockUser,
  organization: mockOrganization,
  projects: mockProjects,
  isMultiOrgEnabled: true,
  isFormbricksCloud: false,
  isDevelopment: false,
  membershipRole: "owner" as const,
  organizationProjectsLimit: 5,
  isLicenseActive: true,
  isAccessControlAllowed: true,
};

describe("MainNavigation", () => {
  let mockRouterPush: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockRouterPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push: mockRouterPush } as any);
    vi.mocked(usePathname).mockReturnValue("/environments/env1/surveys");
    vi.mocked(getLatestStableFbReleaseAction).mockResolvedValue({ data: null }); // Default: no new version
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders expanded by default and collapses on toggle", async () => {
    render(<MainNavigation {...defaultProps} />);
    const projectSwitcher = screen.getByTestId("project-switcher");
    // Assuming the toggle button is the only one initially without an accessible name
    // A more specific selector like data-testid would be better if available.
    const toggleButton = screen.getByRole("button", { name: "" });

    // Check initial state (expanded)
    expect(projectSwitcher).toHaveAttribute("data-collapsed", "false");
    expect(screen.getByAltText("environments.formbricks_logo")).toBeInTheDocument();
    // Check localStorage is not set initially after clear()
    expect(localStorage.getItem("isMainNavCollapsed")).toBeNull();

    // Click to collapse
    await userEvent.click(toggleButton);

    // Check state after first toggle (collapsed)
    await waitFor(() => {
      // Check that the attribute eventually becomes true
      expect(projectSwitcher).toHaveAttribute("data-collapsed", "true");
      // Check that localStorage is updated
      expect(localStorage.getItem("isMainNavCollapsed")).toBe("true");
    });
    // Check that the logo is eventually hidden
    await waitFor(() => {
      expect(screen.queryByAltText("environments.formbricks_logo")).not.toBeInTheDocument();
    });

    // Click to expand
    await userEvent.click(toggleButton);

    // Check state after second toggle (expanded)
    await waitFor(() => {
      // Check that the attribute eventually becomes false
      expect(projectSwitcher).toHaveAttribute("data-collapsed", "false");
      // Check that localStorage is updated
      expect(localStorage.getItem("isMainNavCollapsed")).toBe("false");
    });
    // Check that the logo is eventually visible
    await waitFor(() => {
      expect(screen.getByAltText("environments.formbricks_logo")).toBeInTheDocument();
    });
  });

  test("renders correct active navigation link", () => {
    vi.mocked(usePathname).mockReturnValue("/environments/env1/actions");
    render(<MainNavigation {...defaultProps} />);
    const actionsLink = screen.getByRole("link", { name: /common.actions/ });
    // Check if the parent li has the active class styling
    expect(actionsLink.closest("li")).toHaveClass("border-brand-dark");
  });

  test("renders user dropdown and handles logout", async () => {
    const mockSignOut = vi.fn().mockResolvedValue({ url: "/auth/login" });
    vi.mocked(useSignOut).mockReturnValue({ signOut: mockSignOut });

    // Set up localStorage spy on the mocked localStorage

    render(<MainNavigation {...defaultProps} />);

    // Find the avatar and get its parent div which acts as the trigger
    const userTrigger = screen.getByTestId("profile-avatar").parentElement!;
    expect(userTrigger).toBeInTheDocument(); // Ensure the trigger element is found
    await userEvent.click(userTrigger);

    // Wait for the dropdown content to appear
    await waitFor(() => {
      expect(screen.getByText("common.account")).toBeInTheDocument();
    });

    expect(screen.getByText("common.organization")).toBeInTheDocument();
    expect(screen.getByText("common.license")).toBeInTheDocument(); // Not cloud, not member
    expect(screen.getByText("common.documentation")).toBeInTheDocument();
    expect(screen.getByText("common.logout")).toBeInTheDocument();

    const logoutButton = screen.getByText("common.logout");
    await userEvent.click(logoutButton);

    expect(mockSignOut).toHaveBeenCalledWith({
      reason: "user_initiated",
      redirectUrl: "/auth/login",
      organizationId: "org1",
      redirect: false,
      callbackUrl: "/auth/login",
      clearEnvironmentId: true,
    });

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith("/auth/login");
    });
  });

  test("handles organization switching", async () => {
    render(<MainNavigation {...defaultProps} />);

    const userTrigger = screen.getByTestId("profile-avatar").parentElement!;
    await userEvent.click(userTrigger);

    // Wait for the initial dropdown items
    await waitFor(() => {
      expect(screen.getByText("common.switch_organization")).toBeInTheDocument();
    });

    const switchOrgTrigger = screen.getByText("common.switch_organization").closest("div[role='menuitem']")!;
    await userEvent.hover(switchOrgTrigger); // Hover to open sub-menu

    const org2Item = await screen.findByText("Another Org"); // findByText includes waitFor
    await userEvent.click(org2Item);

    expect(mockRouterPush).toHaveBeenCalledWith("/organizations/org2/");
  });

  test("opens create organization modal", async () => {
    render(<MainNavigation {...defaultProps} />);

    const userTrigger = screen.getByTestId("profile-avatar").parentElement!;
    await userEvent.click(userTrigger);

    // Wait for the initial dropdown items
    await waitFor(() => {
      expect(screen.getByText("common.switch_organization")).toBeInTheDocument();
    });

    const switchOrgTrigger = screen.getByText("common.switch_organization").closest("div[role='menuitem']")!;
    await userEvent.hover(switchOrgTrigger); // Hover to open sub-menu

    const createOrgButton = await screen.findByText("common.create_new_organization"); // findByText includes waitFor
    await userEvent.click(createOrgButton);

    expect(screen.getByTestId("create-org-modal")).toBeInTheDocument();
  });

  test("hides new version banner for members or if no new version", async () => {
    // Test for member
    vi.mocked(getLatestStableFbReleaseAction).mockResolvedValue({ data: "v1.1.0" });
    render(<MainNavigation {...defaultProps} membershipRole="member" />);
    let toggleButton = screen.getByRole("button", { name: "" });
    await userEvent.click(toggleButton);
    await waitFor(() => {
      expect(screen.queryByText("common.new_version_available", { exact: false })).not.toBeInTheDocument();
    });
    cleanup(); // Clean up before next render

    // Test for no new version
    vi.mocked(getLatestStableFbReleaseAction).mockResolvedValue({ data: null });
    render(<MainNavigation {...defaultProps} membershipRole="owner" />);
    toggleButton = screen.getByRole("button", { name: "" });
    await userEvent.click(toggleButton);
    await waitFor(() => {
      expect(screen.queryByText("common.new_version_available", { exact: false })).not.toBeInTheDocument();
    });
  });

  test("hides main nav and project switcher if user role is billing", () => {
    render(<MainNavigation {...defaultProps} membershipRole="billing" />);
    expect(screen.queryByRole("link", { name: /common.surveys/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("project-switcher")).not.toBeInTheDocument();
  });

  test("shows billing link and hides license link in cloud", async () => {
    render(<MainNavigation {...defaultProps} isFormbricksCloud={true} />);
    const userTrigger = screen.getByTestId("profile-avatar").parentElement!;
    await userEvent.click(userTrigger);

    // Wait for dropdown items
    await waitFor(() => {
      expect(screen.getByText("common.billing")).toBeInTheDocument();
    });
    expect(screen.queryByText("common.license")).not.toBeInTheDocument();
  });

  test("passes isAccessControlAllowed props to ProjectSwitcher", () => {
    render(<MainNavigation {...defaultProps} />);

    expect(screen.getByTestId("organization-teams-count")).toHaveTextContent("0");
    expect(screen.getByTestId("is-access-control-allowed")).toHaveTextContent("true");
  });

  test("handles no organizationTeams", () => {
    render(<MainNavigation {...defaultProps} />);

    expect(screen.getByTestId("organization-teams-count")).toHaveTextContent("0");
  });

  test("handles isAccessControlAllowed false", () => {
    render(<MainNavigation {...defaultProps} isAccessControlAllowed={false} />);

    expect(screen.getByTestId("is-access-control-allowed")).toHaveTextContent("false");
  });
});
