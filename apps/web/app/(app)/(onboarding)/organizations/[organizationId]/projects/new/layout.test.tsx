import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getOrganization } from "@/lib/organization/service";
import { getOrganizationProjectsCount } from "@/lib/project/service";
import { getOrganizationProjectsLimit } from "@/modules/ee/license-check/lib/utils";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TMembership } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import OnboardingLayout from "./layout";

// Mock environment variables
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  POSTHOG_API_KEY: "mock-posthog-api-key",
  POSTHOG_HOST: "mock-posthog-host",
  IS_POSTHOG_CONFIGURED: true,
  ENCRYPTION_KEY: "mock-encryption-key",
  ENTERPRISE_LICENSE_KEY: "mock-enterprise-license-key",
  GITHUB_ID: "mock-github-id",
  GITHUB_SECRET: "test-githubID",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  AZUREAD_CLIENT_ID: "test-azuread-client-id",
  AZUREAD_CLIENT_SECRET: "test-azure",
  AZUREAD_TENANT_ID: "test-azuread-tenant-id",
  OIDC_DISPLAY_NAME: "test-oidc-display-name",
  OIDC_CLIENT_ID: "test-oidc-client-id",
  OIDC_ISSUER: "test-oidc-issuer",
  OIDC_CLIENT_SECRET: "test-oidc-client-secret",
  OIDC_SIGNING_ALGORITHM: "test-oidc-signing-algorithm",
  WEBAPP_URL: "test-webapp-url",
  IS_PRODUCTION: false,
}));

// Mock dependencies
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: vi.fn(),
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganization: vi.fn(),
}));

vi.mock("@/lib/project/service", () => ({
  getOrganizationProjectsCount: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getOrganizationProjectsLimit: vi.fn(),
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

describe("OnboardingLayout", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("redirects to login if no session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const props = {
      params: { organizationId: "test-org-id" },
      children: <div>Test Child</div>,
    };

    await OnboardingLayout(props);
    expect(redirect).toHaveBeenCalledWith("/auth/login");
  });

  test("returns not found if user is member or billing", async () => {
    const mockSession = {
      user: { id: "test-user-id" },
    };
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any);

    const mockMembership: TMembership = {
      organizationId: "test-org-id",
      userId: "test-user-id",
      accepted: true,
      role: "member",
    };
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembership);

    const props = {
      params: { organizationId: "test-org-id" },
      children: <div>Test Child</div>,
    };

    await OnboardingLayout(props);
    expect(notFound).toHaveBeenCalled();
  });

  test("throws error if organization is not found", async () => {
    const mockSession = {
      user: { id: "test-user-id" },
    };
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any);

    const mockMembership: TMembership = {
      organizationId: "test-org-id",
      userId: "test-user-id",
      accepted: true,
      role: "owner",
    };
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembership);
    vi.mocked(getOrganization).mockResolvedValue(null);

    const props = {
      params: { organizationId: "test-org-id" },
      children: <div>Test Child</div>,
    };

    await expect(OnboardingLayout(props)).rejects.toThrow("common.organization_not_found");
  });

  test("redirects to home if project limit is reached", async () => {
    const mockSession = {
      user: { id: "test-user-id" },
    };
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any);

    const mockMembership: TMembership = {
      organizationId: "test-org-id",
      userId: "test-user-id",
      accepted: true,
      role: "owner",
    };
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembership);

    const mockOrganization: TOrganization = {
      id: "test-org-id",
      name: "Test Org",
      createdAt: new Date(),
      updatedAt: new Date(),
      isAIEnabled: false,
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
    };
    vi.mocked(getOrganization).mockResolvedValue(mockOrganization);
    vi.mocked(getOrganizationProjectsLimit).mockResolvedValue(3);
    vi.mocked(getOrganizationProjectsCount).mockResolvedValue(3);

    const props = {
      params: { organizationId: "test-org-id" },
      children: <div>Test Child</div>,
    };

    await OnboardingLayout(props);
    expect(redirect).toHaveBeenCalledWith("/");
  });

  test("renders children when all conditions are met", async () => {
    const mockSession = {
      user: { id: "test-user-id" },
    };
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any);

    const mockMembership: TMembership = {
      organizationId: "test-org-id",
      userId: "test-user-id",
      accepted: true,
      role: "owner",
    };
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembership);

    const mockOrganization: TOrganization = {
      id: "test-org-id",
      name: "Test Org",
      createdAt: new Date(),
      updatedAt: new Date(),
      isAIEnabled: false,
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
    };
    vi.mocked(getOrganization).mockResolvedValue(mockOrganization);
    vi.mocked(getOrganizationProjectsLimit).mockResolvedValue(3);
    vi.mocked(getOrganizationProjectsCount).mockResolvedValue(2);

    const props = {
      params: { organizationId: "test-org-id" },
      children: <div>Test Child</div>,
    };

    const result = await OnboardingLayout(props);
    expect(result).toEqual(<>{props.children}</>);
  });
});
