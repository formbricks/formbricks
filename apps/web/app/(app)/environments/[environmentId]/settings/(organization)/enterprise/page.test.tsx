import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { cleanup, render, screen } from "@testing-library/react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TMembership } from "@formbricks/types/memberships";
import { TOrganization, TOrganizationBilling } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";

vi.mock("@formbricks/database", () => ({
  prisma: {
    membership: {
      findMany: vi.fn(),
    },
    environment: {
      findUnique: vi.fn(),
    },
    project: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  usePathname: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationByEnvironmentId: vi.fn(),
}));

vi.mock("@/lib/user/service", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: vi.fn(),
}));

vi.mock("@/lib/membership/utils", () => ({
  getAccessFlags: vi.fn(),
}));

vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(),
}));

vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-content-wrapper">{children}</div>
  ),
}));

vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-header">{children}</div>
  ),
}));

vi.mock("@/modules/ui/components/settings-card", () => ({
  SettingsCard: ({ title, description, children }: any) => (
    <div data-testid={`settings-card-${title?.split(".")[0]}`}>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  ),
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

let mockIsFormbricksCloud = false;
vi.mock("@/lib/constants", async () => ({
  get IS_FORMBRICKS_CLOUD() {
    return mockIsFormbricksCloud;
  },
  IS_PRODUCTION: false,
  FB_LOGO_URL: "https://example.com/mock-logo.png",
  ENCRYPTION_KEY: "mock-encryption-key",
  ENTERPRISE_LICENSE_KEY: "mock-enterprise-license-key",
  GITHUB_ID: "mock-github-id",
  GITHUB_SECRET: "mock-github-secret",
  GOOGLE_CLIENT_ID: "mock-google-client-id",
  GOOGLE_CLIENT_SECRET: "mock-google-client-secret",
  AZUREAD_CLIENT_ID: "mock-azuread-client-id",
  AZUREAD_CLIENT_SECRET: "mock-azure-client-secret",
  AZUREAD_TENANT_ID: "mock-azuread-tenant-id",
  OIDC_CLIENT_ID: "mock-oidc-client-id",
  OIDC_CLIENT_SECRET: "mock-oidc-client-secret",
  OIDC_ISSUER: "mock-oidc-issuer",
  OIDC_DISPLAY_NAME: "mock-oidc-display-name",
  OIDC_SIGNING_ALGORITHM: "mock-oidc-signing-algorithm",
  SAML_DATABASE_URL: "mock-saml-database-url",
  WEBAPP_URL: "mock-webapp-url",
  SMTP_HOST: "mock-smtp-host",
  SMTP_PORT: "mock-smtp-port",
  E2E_TESTING: "mock-e2e-testing",
}));

const mockEnvironmentId = "c6x2k3vq00000e5twdfh8x9xg";
const mockOrganizationId = "test-org-id";
const mockUserId = "test-user-id";

const mockSession = {
  user: {
    id: mockUserId,
  },
};

const mockUser = {
  id: mockUserId,
  name: "Test User",
  email: "test@example.com",
  createdAt: new Date(),
  updatedAt: new Date(),
  emailVerified: new Date(),
  imageUrl: "",
  twoFactorEnabled: false,
  identityProvider: "email",
  notificationSettings: { alert: {} },
  role: "project_manager",
  objective: "other",
} as unknown as TUser;

const mockOrganization = {
  id: mockOrganizationId,
  name: "Test Organization",
  createdAt: new Date(),
  updatedAt: new Date(),
  billing: {
    stripeCustomerId: null,
    plan: "free",
    limits: { monthly: { responses: null, miu: null }, projects: null },
    features: {
      isUsageBasedSubscriptionEnabled: false,
      isSubscriptionUpdateDisabled: false,
    },
  } as unknown as TOrganizationBilling,
} as unknown as TOrganization;

const mockMembership: TMembership = {
  organizationId: mockOrganizationId,
  userId: mockUserId,
  accepted: true,
  role: "owner",
};

describe("EnterpriseSettingsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockIsFormbricksCloud = false;
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      environmentId: mockEnvironmentId,
      organizationId: mockOrganizationId,
      userId: mockUserId,
    } as any);
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any);
    vi.mocked(getUser).mockResolvedValue(mockUser);
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(mockOrganization);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue(mockMembership);
    vi.mocked(getAccessFlags).mockReturnValue({ isOwner: true, isAdmin: true } as any); // Ensure isAdmin is also covered if relevant
  });

  afterEach(() => {
    cleanup();
  });

  test("renders correctly for an owner when not on Formbricks Cloud", async () => {
    vi.resetModules();
    await vi.doMock("@/modules/ee/license-check/lib/license", () => ({
      getEnterpriseLicense: vi.fn().mockResolvedValue({
        active: false,
        isPendingDowngrade: false,
        features: { isMultiOrgEnabled: false },
        lastChecked: new Date(),
        fallbackLevel: "live",
      }),
    }));
    const { default: EnterpriseSettingsPage } = await import("./page");
    const Page = await EnterpriseSettingsPage({ params: { environmentId: mockEnvironmentId } });
    render(Page);
    expect(screen.getByTestId("page-content-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("page-header")).toBeInTheDocument();
    expect(screen.getByText("environments.settings.enterprise.sso")).toBeInTheDocument();
    expect(screen.getByText("environments.settings.billing.remove_branding")).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });
});
