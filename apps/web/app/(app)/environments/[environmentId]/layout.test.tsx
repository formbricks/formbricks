import { getEnvironment } from "@/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getProjectByEnvironmentId } from "@/lib/project/service";
import { environmentIdLayoutChecks } from "@/modules/environments/lib/utils";
import { cleanup, render, screen } from "@testing-library/react";
import { Session } from "next-auth";
import { redirect } from "next/navigation";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TMembership } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";
import { TUser } from "@formbricks/types/user";
import EnvLayout from "./layout";

// Mock sub-components to render identifiable elements
vi.mock("@/app/(app)/environments/[environmentId]/components/EnvironmentLayout", () => ({
  EnvironmentLayout: ({ children, environmentId, session }: any) => (
    <div data-testid="EnvironmentLayout" data-environment-id={environmentId} data-session={session?.user?.id}>
      {children}
    </div>
  ),
}));
vi.mock("@/modules/ui/components/environmentId-base-layout", () => ({
  EnvironmentIdBaseLayout: ({ children, environmentId, session, user, organization }: any) => (
    <div
      data-testid="EnvironmentIdBaseLayout"
      data-environment-id={environmentId}
      data-session={session?.user?.id}
      data-user={user?.id}
      data-organization={organization?.id}>
      {children}
    </div>
  ),
}));
vi.mock("@/modules/ui/components/toaster-client", () => ({
  ToasterClient: () => <div data-testid="ToasterClient" />,
}));
vi.mock("./components/EnvironmentStorageHandler", () => ({
  default: ({ environmentId }: any) => (
    <div data-testid="EnvironmentStorageHandler" data-environment-id={environmentId} />
  ),
}));
vi.mock("@/app/(app)/environments/[environmentId]/context/environment-context", () => ({
  EnvironmentContextWrapper: ({ children, environment, project }: any) => (
    <div
      data-testid="EnvironmentContextWrapper"
      data-environment-id={environment?.id}
      data-project-id={project?.id}>
      {children}
    </div>
  ),
}));

// Mock navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Mocks for dependencies
vi.mock("@/modules/environments/lib/utils", () => ({
  environmentIdLayoutChecks: vi.fn(),
}));
vi.mock("@/lib/project/service", () => ({
  getProjectByEnvironmentId: vi.fn(),
}));
vi.mock("@/lib/environment/service", () => ({
  getEnvironment: vi.fn(),
}));
vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: vi.fn(),
}));

describe("EnvLayout", () => {
  const mockSession = { user: { id: "user1" } } as Session;
  const mockUser = { id: "user1", email: "user1@example.com" } as TUser;
  const mockOrganization = { id: "org1", name: "Org1", billing: {} } as TOrganization;
  const mockProject = { id: "proj1", name: "Test Project" } as TProject;
  const mockEnvironment = { id: "env1", type: "production" } as TEnvironment;
  const mockMembership = {
    id: "member1",
    role: "owner",
    organizationId: "org1",
    userId: "user1",
    accepted: true,
  } as TMembership;
  const mockTranslation = ((key: string) => key) as any;

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders successfully when all dependencies return valid data", async () => {
    vi.mocked(environmentIdLayoutChecks).mockResolvedValueOnce({
      t: mockTranslation,
      session: mockSession,
      user: mockUser,
      organization: mockOrganization,
    });
    vi.mocked(getProjectByEnvironmentId).mockResolvedValueOnce(mockProject);
    vi.mocked(getEnvironment).mockResolvedValueOnce(mockEnvironment);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValueOnce(mockMembership);

    const result = await EnvLayout({
      params: Promise.resolve({ environmentId: "env1" }),
      children: <div data-testid="child">Content</div>,
    });
    render(result);

    // Verify main layout structure
    expect(screen.getByTestId("EnvironmentIdBaseLayout")).toBeInTheDocument();
    expect(screen.getByTestId("EnvironmentIdBaseLayout")).toHaveAttribute("data-environment-id", "env1");
    expect(screen.getByTestId("EnvironmentIdBaseLayout")).toHaveAttribute("data-session", "user1");
    expect(screen.getByTestId("EnvironmentIdBaseLayout")).toHaveAttribute("data-user", "user1");
    expect(screen.getByTestId("EnvironmentIdBaseLayout")).toHaveAttribute("data-organization", "org1");

    // Verify environment storage handler
    expect(screen.getByTestId("EnvironmentStorageHandler")).toBeInTheDocument();
    expect(screen.getByTestId("EnvironmentStorageHandler")).toHaveAttribute("data-environment-id", "env1");

    // Verify context wrapper
    expect(screen.getByTestId("EnvironmentContextWrapper")).toBeInTheDocument();
    expect(screen.getByTestId("EnvironmentContextWrapper")).toHaveAttribute("data-environment-id", "env1");
    expect(screen.getByTestId("EnvironmentContextWrapper")).toHaveAttribute("data-project-id", "proj1");

    // Verify environment layout
    expect(screen.getByTestId("EnvironmentLayout")).toBeInTheDocument();
    expect(screen.getByTestId("EnvironmentLayout")).toHaveAttribute("data-environment-id", "env1");
    expect(screen.getByTestId("EnvironmentLayout")).toHaveAttribute("data-session", "user1");

    // Verify children are rendered
    expect(screen.getByTestId("child")).toHaveTextContent("Content");

    // Verify all services were called with correct parameters
    expect(environmentIdLayoutChecks).toHaveBeenCalledWith("env1");
    expect(getProjectByEnvironmentId).toHaveBeenCalledWith("env1");
    expect(getEnvironment).toHaveBeenCalledWith("env1");
    expect(getMembershipByUserIdOrganizationId).toHaveBeenCalledWith("user1", "org1");
  });

  test("redirects when session is null", async () => {
    vi.mocked(environmentIdLayoutChecks).mockResolvedValueOnce({
      t: mockTranslation,
      session: null as unknown as Session,
      user: mockUser,
      organization: mockOrganization,
    });
    vi.mocked(redirect).mockImplementationOnce(() => {
      throw new Error("Redirect called");
    });

    await expect(
      EnvLayout({
        params: Promise.resolve({ environmentId: "env1" }),
        children: <div>Content</div>,
      })
    ).rejects.toThrow("Redirect called");

    expect(redirect).toHaveBeenCalledWith("/auth/login");
  });

  test("throws error if user is null", async () => {
    vi.mocked(environmentIdLayoutChecks).mockResolvedValueOnce({
      t: mockTranslation,
      session: mockSession,
      user: null as unknown as TUser,
      organization: mockOrganization,
    });

    await expect(
      EnvLayout({
        params: Promise.resolve({ environmentId: "env1" }),
        children: <div>Content</div>,
      })
    ).rejects.toThrow("common.user_not_found");

    // Verify redirect was not called
    expect(redirect).not.toHaveBeenCalled();
  });

  test("throws error if project is not found", async () => {
    vi.mocked(environmentIdLayoutChecks).mockResolvedValueOnce({
      t: mockTranslation,
      session: mockSession,
      user: mockUser,
      organization: mockOrganization,
    });
    vi.mocked(getProjectByEnvironmentId).mockResolvedValueOnce(null);
    vi.mocked(getEnvironment).mockResolvedValueOnce(mockEnvironment);

    await expect(
      EnvLayout({
        params: Promise.resolve({ environmentId: "env1" }),
        children: <div>Content</div>,
      })
    ).rejects.toThrow("common.project_not_found");

    // Verify both project and environment were called in Promise.all
    expect(getProjectByEnvironmentId).toHaveBeenCalledWith("env1");
    expect(getEnvironment).toHaveBeenCalledWith("env1");
  });

  test("throws error if environment is not found", async () => {
    vi.mocked(environmentIdLayoutChecks).mockResolvedValueOnce({
      t: mockTranslation,
      session: mockSession,
      user: mockUser,
      organization: mockOrganization,
    });
    vi.mocked(getProjectByEnvironmentId).mockResolvedValueOnce(mockProject);
    vi.mocked(getEnvironment).mockResolvedValueOnce(null);

    await expect(
      EnvLayout({
        params: Promise.resolve({ environmentId: "env1" }),
        children: <div>Content</div>,
      })
    ).rejects.toThrow("common.environment_not_found");

    // Verify both project and environment were called in Promise.all
    expect(getProjectByEnvironmentId).toHaveBeenCalledWith("env1");
    expect(getEnvironment).toHaveBeenCalledWith("env1");
  });

  test("throws error if membership is not found", async () => {
    vi.mocked(environmentIdLayoutChecks).mockResolvedValueOnce({
      t: mockTranslation,
      session: mockSession,
      user: mockUser,
      organization: mockOrganization,
    });
    vi.mocked(getProjectByEnvironmentId).mockResolvedValueOnce(mockProject);
    vi.mocked(getEnvironment).mockResolvedValueOnce(mockEnvironment);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValueOnce(null);

    await expect(
      EnvLayout({
        params: Promise.resolve({ environmentId: "env1" }),
        children: <div>Content</div>,
      })
    ).rejects.toThrow("common.membership_not_found");

    expect(getMembershipByUserIdOrganizationId).toHaveBeenCalledWith("user1", "org1");
  });

  test("handles Promise.all correctly for project and environment", async () => {
    vi.mocked(environmentIdLayoutChecks).mockResolvedValueOnce({
      t: mockTranslation,
      session: mockSession,
      user: mockUser,
      organization: mockOrganization,
    });

    // Mock Promise.all to verify it's called correctly
    const getProjectSpy = vi.mocked(getProjectByEnvironmentId).mockResolvedValueOnce(mockProject);
    const getEnvironmentSpy = vi.mocked(getEnvironment).mockResolvedValueOnce(mockEnvironment);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValueOnce(mockMembership);

    const result = await EnvLayout({
      params: Promise.resolve({ environmentId: "env1" }),
      children: <div data-testid="child">Content</div>,
    });
    render(result);

    // Verify both calls were made
    expect(getProjectSpy).toHaveBeenCalledWith("env1");
    expect(getEnvironmentSpy).toHaveBeenCalledWith("env1");

    // Verify successful rendering
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  test("handles different environment types correctly", async () => {
    const developmentEnvironment = { id: "env1", type: "development" } as TEnvironment;

    vi.mocked(environmentIdLayoutChecks).mockResolvedValueOnce({
      t: mockTranslation,
      session: mockSession,
      user: mockUser,
      organization: mockOrganization,
    });
    vi.mocked(getProjectByEnvironmentId).mockResolvedValueOnce(mockProject);
    vi.mocked(getEnvironment).mockResolvedValueOnce(developmentEnvironment);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValueOnce(mockMembership);

    const result = await EnvLayout({
      params: Promise.resolve({ environmentId: "env1" }),
      children: <div data-testid="child">Content</div>,
    });
    render(result);

    // Verify context wrapper receives the development environment
    expect(screen.getByTestId("EnvironmentContextWrapper")).toHaveAttribute("data-environment-id", "env1");
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  test("handles different user roles correctly", async () => {
    const memberMembership = {
      id: "member1",
      role: "member",
      organizationId: "org1",
      userId: "user1",
      accepted: true,
    } as TMembership;

    vi.mocked(environmentIdLayoutChecks).mockResolvedValueOnce({
      t: mockTranslation,
      session: mockSession,
      user: mockUser,
      organization: mockOrganization,
    });
    vi.mocked(getProjectByEnvironmentId).mockResolvedValueOnce(mockProject);
    vi.mocked(getEnvironment).mockResolvedValueOnce(mockEnvironment);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValueOnce(memberMembership);

    const result = await EnvLayout({
      params: Promise.resolve({ environmentId: "env1" }),
      children: <div data-testid="child">Content</div>,
    });
    render(result);

    // Verify successful rendering with member role
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(getMembershipByUserIdOrganizationId).toHaveBeenCalledWith("user1", "org1");
  });
});
