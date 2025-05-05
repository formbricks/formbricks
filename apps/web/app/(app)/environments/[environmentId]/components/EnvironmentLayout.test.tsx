import { EnvironmentLayout } from "@/app/(app)/environments/[environmentId]/components/EnvironmentLayout";
import { getEnvironment, getEnvironments } from "@/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import {
  getMonthlyActiveOrganizationPeopleCount,
  getMonthlyOrganizationResponseCount,
  getOrganizationByEnvironmentId,
  getOrganizationsByUserId,
} from "@/lib/organization/service";
import { getUserProjects } from "@/lib/project/service";
import { getUser } from "@/lib/user/service";
import { getEnterpriseLicense, getOrganizationProjectsLimit } from "@/modules/ee/license-check/lib/utils";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { cleanup, render, screen } from "@testing-library/react";
import type { Session } from "next-auth";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TMembership } from "@formbricks/types/memberships";
import {
  TOrganization,
  TOrganizationBilling,
  TOrganizationBillingPlanLimits,
} from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";
import { TUser } from "@formbricks/types/user";

// Mock services and utils
vi.mock("@/lib/environment/service", () => ({
  getEnvironment: vi.fn(),
  getEnvironments: vi.fn(),
}));
vi.mock("@/lib/organization/service", () => ({
  getOrganizationByEnvironmentId: vi.fn(),
  getOrganizationsByUserId: vi.fn(),
  getMonthlyActiveOrganizationPeopleCount: vi.fn(),
  getMonthlyOrganizationResponseCount: vi.fn(),
}));
vi.mock("@/lib/user/service", () => ({
  getUser: vi.fn(),
}));
vi.mock("@/lib/project/service", () => ({
  getUserProjects: vi.fn(),
}));
vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: vi.fn(),
}));
vi.mock("@/lib/membership/utils", () => ({
  getAccessFlags: vi.fn(() => ({ isMember: true })), // Default to member for simplicity
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getEnterpriseLicense: vi.fn(),
  getOrganizationProjectsLimit: vi.fn(),
}));
vi.mock("@/modules/ee/teams/lib/roles", () => ({
  getProjectPermissionByUserId: vi.fn(),
}));
vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

let mockIsFormbricksCloud = false;
let mockIsDevelopment = false;

vi.mock("@/lib/constants", () => ({
  get IS_FORMBRICKS_CLOUD() {
    return mockIsFormbricksCloud;
  },
  get IS_DEVELOPMENT() {
    return mockIsDevelopment;
  },
}));

// Mock components
vi.mock("@/app/(app)/environments/[environmentId]/components/MainNavigation", () => ({
  MainNavigation: () => <div data-testid="main-navigation">MainNavigation</div>,
}));
vi.mock("@/app/(app)/environments/[environmentId]/components/TopControlBar", () => ({
  TopControlBar: () => <div data-testid="top-control-bar">TopControlBar</div>,
}));
vi.mock("@/modules/ui/components/dev-environment-banner", () => ({
  DevEnvironmentBanner: ({ environment }: { environment: TEnvironment }) =>
    environment.type === "development" ? <div data-testid="dev-banner">DevEnvironmentBanner</div> : null,
}));
vi.mock("@/modules/ui/components/limits-reached-banner", () => ({
  LimitsReachedBanner: () => <div data-testid="limits-banner">LimitsReachedBanner</div>,
}));
vi.mock("@/modules/ui/components/pending-downgrade-banner", () => ({
  PendingDowngradeBanner: ({
    isPendingDowngrade,
    active,
  }: {
    isPendingDowngrade: boolean;
    active: boolean;
  }) =>
    isPendingDowngrade && active ? <div data-testid="downgrade-banner">PendingDowngradeBanner</div> : null,
}));

const mockUser = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  emailVerified: new Date(),
  imageUrl: "",
  twoFactorEnabled: false,
  identityProvider: "email",
  createdAt: new Date(),
  updatedAt: new Date(),
  notificationSettings: { alert: {}, weeklySummary: {} },
} as unknown as TUser;

const mockOrganization = {
  id: "org-1",
  name: "Test Org",
  createdAt: new Date(),
  updatedAt: new Date(),
  billing: {
    stripeCustomerId: null,
    limits: { monthly: { responses: null } } as unknown as TOrganizationBillingPlanLimits,
  } as unknown as TOrganizationBilling,
} as unknown as TOrganization;

const mockEnvironment: TEnvironment = {
  id: "env-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "production",
  projectId: "proj-1",
  appSetupCompleted: true,
};

const mockProject: TProject = {
  id: "proj-1",
  name: "Test Project",
  createdAt: new Date(),
  updatedAt: new Date(),
  organizationId: "org-1",
  environments: [mockEnvironment],
} as unknown as TProject;

const mockMembership: TMembership = {
  organizationId: "org-1",
  userId: "user-1",
  accepted: true,
  role: "owner",
};

const mockLicense = {
  plan: "free",
  active: false,
  lastChecked: new Date(),
  features: { isMultiOrgEnabled: false },
} as any;

const mockProjectPermission = {
  userId: "user-1",
  projectId: "proj-1",
  role: "admin",
} as any;

const mockSession: Session = {
  user: {
    id: "user-1",
  },
  expires: new Date(Date.now() + 3600 * 1000).toISOString(),
};

describe("EnvironmentLayout", () => {
  beforeEach(() => {
    vi.mocked(getUser).mockResolvedValue(mockUser);
    vi.mocked(getEnvironment).mockResolvedValue(mockEnvironment);
    vi.mocked(getOrganizationsByUserId).mockResolvedValue([mockOrganization]);
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(mockOrganization);
    vi.mocked(getUserProjects).mockResolvedValue([mockProject]);
    vi.mocked(getEnvironments).mockResolvedValue([mockEnvironment]);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembership);
    vi.mocked(getMonthlyActiveOrganizationPeopleCount).mockResolvedValue(100);
    vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(500);
    vi.mocked(getEnterpriseLicense).mockResolvedValue(mockLicense);
    vi.mocked(getOrganizationProjectsLimit).mockResolvedValue(null as any);
    vi.mocked(getProjectPermissionByUserId).mockResolvedValue(mockProjectPermission);
    mockIsDevelopment = false;
    mockIsFormbricksCloud = false;
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  test("renders correctly with default props", async () => {
    // Ensure the default mockLicense has isPendingDowngrade: false and active: false
    vi.mocked(getEnterpriseLicense).mockResolvedValue({
      ...mockLicense,
      isPendingDowngrade: false,
      active: false,
    });

    render(
      await EnvironmentLayout({
        environmentId: "env-1",
        session: mockSession,
        children: <div>Child Content</div>,
      })
    );

    expect(screen.getByTestId("main-navigation")).toBeInTheDocument();
    expect(screen.getByTestId("top-control-bar")).toBeInTheDocument();
    expect(screen.getByText("Child Content")).toBeInTheDocument();
    expect(screen.queryByTestId("dev-banner")).not.toBeInTheDocument();
    expect(screen.queryByTestId("limits-banner")).not.toBeInTheDocument();
    expect(screen.queryByTestId("downgrade-banner")).not.toBeInTheDocument(); // This should now pass
  });

  test("renders DevEnvironmentBanner in development environment", async () => {
    const devEnvironment = { ...mockEnvironment, type: "development" as const };
    vi.mocked(getEnvironment).mockResolvedValue(devEnvironment);
    mockIsDevelopment = true;

    render(
      await EnvironmentLayout({
        environmentId: "env-1",
        session: mockSession,
        children: <div>Child Content</div>,
      })
    );

    expect(screen.getByTestId("dev-banner")).toBeInTheDocument();
  });

  test("renders LimitsReachedBanner in Formbricks Cloud", async () => {
    mockIsFormbricksCloud = true;

    render(
      await EnvironmentLayout({
        environmentId: "env-1",
        session: mockSession,
        children: <div>Child Content</div>,
      })
    );

    expect(screen.getByTestId("limits-banner")).toBeInTheDocument();
    expect(vi.mocked(getMonthlyActiveOrganizationPeopleCount)).toHaveBeenCalledWith(mockOrganization.id);
    expect(vi.mocked(getMonthlyOrganizationResponseCount)).toHaveBeenCalledWith(mockOrganization.id);
  });

  test("renders PendingDowngradeBanner when pending downgrade", async () => {
    // Ensure the license mock reflects the condition needed for the banner
    const pendingLicense = { ...mockLicense, isPendingDowngrade: true, active: true };
    vi.mocked(getEnterpriseLicense).mockResolvedValue(pendingLicense);

    render(
      await EnvironmentLayout({
        environmentId: "env-1",
        session: mockSession,
        children: <div>Child Content</div>,
      })
    );

    expect(screen.getByTestId("downgrade-banner")).toBeInTheDocument();
  });

  test("throws error if user not found", async () => {
    vi.mocked(getUser).mockResolvedValue(null);
    await expect(EnvironmentLayout({ environmentId: "env-1", session: mockSession })).rejects.toThrow(
      "common.user_not_found"
    );
  });

  test("throws error if organization not found", async () => {
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(null);
    await expect(EnvironmentLayout({ environmentId: "env-1", session: mockSession })).rejects.toThrow(
      "common.organization_not_found"
    );
  });

  test("throws error if environment not found", async () => {
    vi.mocked(getEnvironment).mockResolvedValue(null);
    await expect(EnvironmentLayout({ environmentId: "env-1", session: mockSession })).rejects.toThrow(
      "common.environment_not_found"
    );
  });

  test("throws error if projects, environments or organizations not found", async () => {
    vi.mocked(getUserProjects).mockResolvedValue(null as any); // Simulate one of the promises failing
    await expect(EnvironmentLayout({ environmentId: "env-1", session: mockSession })).rejects.toThrow(
      "environments.projects_environments_organizations_not_found"
    );
  });

  test("throws error if member has no project permission", async () => {
    vi.mocked(getAccessFlags).mockReturnValue({ isMember: true } as any);
    vi.mocked(getProjectPermissionByUserId).mockResolvedValue(null);
    await expect(EnvironmentLayout({ environmentId: "env-1", session: mockSession })).rejects.toThrow(
      "common.project_permission_not_found"
    );
  });
});
