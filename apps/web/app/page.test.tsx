import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TMembership } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";
import { TUser } from "@formbricks/types/user";
import Page from "./page";

vi.mock("@/lib/project/service", () => ({
  getProjectEnvironmentsByOrganizationIds: vi.fn(),
}));

vi.mock("@/lib/instance/service", () => ({
  getIsFreshInstance: vi.fn(),
}));

vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: vi.fn(),
}));

vi.mock("@/lib/membership/utils", () => ({
  getAccessFlags: vi.fn(),
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationsByUserId: vi.fn(),
}));

vi.mock("@/lib/user/service", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {},
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/modules/ui/components/client-logout", () => ({
  ClientLogout: () => <div data-testid="client-logout">Client Logout</div>,
}));

vi.mock("@/app/ClientEnvironmentRedirect", () => ({
  default: ({ environmentId, userEnvironments }: { environmentId: string; userEnvironments?: string[] }) => (
    <div data-testid="client-environment-redirect">
      Environment ID: {environmentId}
      {userEnvironments && ` | User Environments: ${userEnvironments.join(", ")}`}
    </div>
  ),
}));

describe("Page", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("redirects to setup/intro when no session and fresh instance", async () => {
    const { getServerSession } = await import("next-auth");
    const { getIsFreshInstance } = await import("@/lib/instance/service");
    const { redirect } = await import("next/navigation");

    vi.mocked(getServerSession).mockResolvedValue(null);
    vi.mocked(getIsFreshInstance).mockResolvedValue(true);

    await Page();

    expect(redirect).toHaveBeenCalledWith("/setup/intro");
  });

  test("redirects to auth/login when no session and not fresh instance", async () => {
    const { getServerSession } = await import("next-auth");
    const { getIsFreshInstance } = await import("@/lib/instance/service");
    const { redirect } = await import("next/navigation");

    vi.mocked(getServerSession).mockResolvedValue(null);
    vi.mocked(getIsFreshInstance).mockResolvedValue(false);

    await Page();

    expect(redirect).toHaveBeenCalledWith("/auth/login");
  });

  test("shows client logout when user is not found", async () => {
    const { getServerSession } = await import("next-auth");
    const { getIsFreshInstance } = await import("@/lib/instance/service");
    const { getUser } = await import("@/lib/user/service");
    const { render } = await import("@testing-library/react");

    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "test-user-id" },
    } as any);
    vi.mocked(getIsFreshInstance).mockResolvedValue(false);
    vi.mocked(getUser).mockResolvedValue(null);

    const result = await Page();
    const { container } = render(result);

    expect(container.querySelector('[data-testid="client-logout"]')).toBeInTheDocument();
  });

  test("redirects to organization creation when user has no organizations", async () => {
    const { getServerSession } = await import("next-auth");
    const { getIsFreshInstance } = await import("@/lib/instance/service");
    const { getUser } = await import("@/lib/user/service");
    const { getOrganizationsByUserId } = await import("@/lib/organization/service");
    const { redirect } = await import("next/navigation");

    const mockUser: TUser = {
      id: "test-user-id",
      name: "Test User",
      email: "test@example.com",
      emailVerified: null,
      imageUrl: null,
      twoFactorEnabled: false,
      identityProvider: "email",
      createdAt: new Date(),
      updatedAt: new Date(),
      role: null,
      objective: null,
      notificationSettings: {
        alert: {},
        weeklySummary: {},
        unsubscribedOrganizationIds: [],
      },
      locale: "en-US",
      lastLoginAt: null,
      isActive: true,
    };

    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "test-user-id" },
    } as any);
    vi.mocked(getIsFreshInstance).mockResolvedValue(false);
    vi.mocked(getUser).mockResolvedValue(mockUser);
    vi.mocked(getOrganizationsByUserId).mockResolvedValue([]);

    await Page();

    expect(redirect).toHaveBeenCalledWith("/setup/organization/create");
  });

  test("redirects to project creation when user has organizations but no environment", async () => {
    const { getServerSession } = await import("next-auth");
    const { getIsFreshInstance } = await import("@/lib/instance/service");
    const { getUser } = await import("@/lib/user/service");
    const { getOrganizationsByUserId } = await import("@/lib/organization/service");
    const { getProjectEnvironmentsByOrganizationIds } = await import("@/lib/project/service");
    const { getMembershipByUserIdOrganizationId } = await import("@/lib/membership/service");
    const { getAccessFlags } = await import("@/lib/membership/utils");
    const { redirect } = await import("next/navigation");

    const mockUser: TUser = {
      id: "test-user-id",
      name: "Test User",
      email: "test@example.com",
      emailVerified: null,
      imageUrl: null,
      twoFactorEnabled: false,
      identityProvider: "email",
      createdAt: new Date(),
      updatedAt: new Date(),
      role: null,
      objective: null,
      notificationSettings: {
        alert: {},
        weeklySummary: {},
        unsubscribedOrganizationIds: [],
      },
      locale: "en-US",
      lastLoginAt: null,
      isActive: true,
    };

    const mockOrganization: TOrganization = {
      id: "test-org-id",
      name: "Test Organization",
      createdAt: new Date(),
      updatedAt: new Date(),
      billing: {
        stripeCustomerId: null,
        plan: "free",
        period: "monthly",
        limits: {
          projects: 3,
          monthly: {
            responses: 1500,
            miu: 2000,
          },
        },
        periodStart: new Date(),
      },
      isAIEnabled: false,
    };

    const mockMembership: TMembership = {
      organizationId: "test-org-id",
      userId: "test-user-id",
      accepted: true,
      role: "owner",
    };

    const mockUserProjects = [
      {
        id: "test-project-id",
        name: "Test Project",
        environments: [],
      },
    ];

    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "test-user-id" },
    } as any);
    vi.mocked(getIsFreshInstance).mockResolvedValue(false);
    vi.mocked(getUser).mockResolvedValue(mockUser);
    vi.mocked(getProjectEnvironmentsByOrganizationIds).mockResolvedValue(
      mockUserProjects as unknown as TProject[]
    );
    vi.mocked(getOrganizationsByUserId).mockResolvedValue([mockOrganization]);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembership);
    vi.mocked(getAccessFlags).mockReturnValue({
      isManager: false,
      isOwner: true,
      isBilling: false,
      isMember: true,
    });

    await Page();

    expect(redirect).toHaveBeenCalledWith(`/organizations/${mockOrganization.id}/projects/new/mode`);
  });

  test("redirects to landing when user has organizations but no environment and is not owner/manager", async () => {
    const { getServerSession } = await import("next-auth");
    const { getIsFreshInstance } = await import("@/lib/instance/service");
    const { getUser } = await import("@/lib/user/service");
    const { getProjectEnvironmentsByOrganizationIds } = await import("@/lib/project/service");
    const { getOrganizationsByUserId } = await import("@/lib/organization/service");
    const { getMembershipByUserIdOrganizationId } = await import("@/lib/membership/service");
    const { getAccessFlags } = await import("@/lib/membership/utils");
    const { redirect } = await import("next/navigation");

    const mockUser: TUser = {
      id: "test-user-id",
      name: "Test User",
      email: "test@example.com",
      emailVerified: null,
      imageUrl: null,
      twoFactorEnabled: false,
      identityProvider: "email",
      createdAt: new Date(),
      updatedAt: new Date(),
      role: null,
      objective: null,
      notificationSettings: {
        alert: {},
        weeklySummary: {},
        unsubscribedOrganizationIds: [],
      },
      locale: "en-US",
      lastLoginAt: null,
      isActive: true,
    };

    const mockOrganization: TOrganization = {
      id: "test-org-id",
      name: "Test Organization",
      createdAt: new Date(),
      updatedAt: new Date(),
      billing: {
        stripeCustomerId: null,
        plan: "free",
        period: "monthly",
        limits: {
          projects: 3,
          monthly: {
            responses: 1500,
            miu: 2000,
          },
        },
        periodStart: new Date(),
      },
      isAIEnabled: false,
    };

    const mockMembership: TMembership = {
      organizationId: "test-org-id",
      userId: "test-user-id",
      accepted: true,
      role: "member",
    };

    const mockUserProjects = [
      {
        id: "test-project-id",
        name: "Test Project",
        environments: [],
      },
    ];

    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "test-user-id" },
    } as any);
    vi.mocked(getIsFreshInstance).mockResolvedValue(false);
    vi.mocked(getUser).mockResolvedValue(mockUser);
    vi.mocked(getProjectEnvironmentsByOrganizationIds).mockResolvedValue(
      mockUserProjects as unknown as TProject[]
    );
    vi.mocked(getOrganizationsByUserId).mockResolvedValue([mockOrganization]);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembership);
    vi.mocked(getAccessFlags).mockReturnValue({
      isManager: false,
      isOwner: false,
      isBilling: false,
      isMember: true,
    });

    await Page();

    expect(redirect).toHaveBeenCalledWith(`/organizations/${mockOrganization.id}/landing`);
  });

  test("renders ClientEnvironmentRedirect when user has environment", async () => {
    const { getServerSession } = await import("next-auth");
    const { getIsFreshInstance } = await import("@/lib/instance/service");
    const { getUser } = await import("@/lib/user/service");
    const { getOrganizationsByUserId } = await import("@/lib/organization/service");
    const { getMembershipByUserIdOrganizationId } = await import("@/lib/membership/service");
    const { getAccessFlags } = await import("@/lib/membership/utils");
    const { getProjectEnvironmentsByOrganizationIds } = await import("@/lib/project/service");
    const { render } = await import("@testing-library/react");

    const mockUser: TUser = {
      id: "test-user-id",
      name: "Test User",
      email: "test@example.com",
      emailVerified: null,
      imageUrl: null,
      twoFactorEnabled: false,
      identityProvider: "email",
      createdAt: new Date(),
      updatedAt: new Date(),
      role: null,
      objective: null,
      notificationSettings: {
        alert: {},
        weeklySummary: {},
        unsubscribedOrganizationIds: [],
      },
      locale: "en-US",
      lastLoginAt: null,
      isActive: true,
    };

    const mockOrganization: TOrganization = {
      id: "test-org-id",
      name: "Test Organization",
      createdAt: new Date(),
      updatedAt: new Date(),
      billing: {
        stripeCustomerId: null,
        plan: "free",
        period: "monthly",
        limits: {
          projects: 3,
          monthly: {
            responses: 1500,
            miu: 2000,
          },
        },
        periodStart: new Date(),
      },
      isAIEnabled: false,
    };

    const mockMembership: TMembership = {
      organizationId: "test-org-id",
      userId: "test-user-id",
      accepted: true,
      role: "member",
    };

    const mockUserProjects = [
      {
        id: "project-1",
        name: "Test Project",
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: "test-org-id",
        styling: { allowStyleOverwrite: true },
        recontactDays: 0,
        inAppSurveyBranding: false,
        linkSurveyBranding: false,
        config: { channel: "link" as const, industry: "saas" as const },
        placement: "bottomRight" as const,
        clickOutsideClose: false,
        darkOverlay: false,
        languages: [],
        logo: null,
        environments: [
          {
            id: "test-env-id",
            type: "production" as const,
            createdAt: new Date(),
            updatedAt: new Date(),
            projectId: "project-1",
            appSetupCompleted: true,
          },
          {
            id: "test-env-dev",
            type: "development" as const,
            createdAt: new Date(),
            updatedAt: new Date(),
            projectId: "project-1",
            appSetupCompleted: true,
          },
        ],
      },
    ] as any;

    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "test-user-id" },
    } as any);
    vi.mocked(getIsFreshInstance).mockResolvedValue(false);
    vi.mocked(getUser).mockResolvedValue(mockUser);
    vi.mocked(getOrganizationsByUserId).mockResolvedValue([mockOrganization]);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembership);
    vi.mocked(getProjectEnvironmentsByOrganizationIds).mockResolvedValue(mockUserProjects);
    vi.mocked(getAccessFlags).mockReturnValue({
      isManager: false,
      isOwner: false,
      isBilling: false,
      isMember: true,
    });

    const result = await Page();
    const { container } = render(result);

    expect(container.querySelector('[data-testid="client-environment-redirect"]')).toHaveTextContent(
      `User Environments: test-env-id, test-env-dev`
    );
  });
});
