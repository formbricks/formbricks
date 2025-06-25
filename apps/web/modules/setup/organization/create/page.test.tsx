import * as instanceService from "@/lib/instance/service";
import * as organizationService from "@/lib/organization/service";
import * as userService from "@/lib/user/service";
import * as licenseCheck from "@/modules/ee/license-check/lib/utils";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as nextAuth from "next-auth";
import * as nextNavigation from "next/navigation";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AuthenticationError } from "@formbricks/types/errors";
import { CreateOrganizationPage } from "./page";

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
  SENTRY_DSN: "mock-sentry-dsn",
  FB_LOGO_URL: "mock-fb-logo-url",
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: 587,
  SMTP_USER: "smtp-user",
  SAML_AUDIENCE: "test-saml-audience",
  SAML_PATH: "test-saml-path",
  SAML_DATABASE_URL: "test-saml-database-url",
  TERMS_URL: "test-terms-url",
  SIGNUP_ENABLED: true,
  PRIVACY_URL: "test-privacy-url",
  EMAIL_VERIFICATION_DISABLED: false,
  EMAIL_AUTH_ENABLED: true,
  GOOGLE_OAUTH_ENABLED: true,
  GITHUB_OAUTH_ENABLED: true,
  AZURE_OAUTH_ENABLED: true,
  OIDC_OAUTH_ENABLED: true,
  DEFAULT_ORGANIZATION_ID: "test-default-organization-id",
  IS_TURNSTILE_CONFIGURED: true,
  SAML_TENANT: "test-saml-tenant",
  SAML_PRODUCT: "test-saml-product",
  TURNSTILE_SITE_KEY: "test-turnstile-site-key",
  SAML_OAUTH_ENABLED: true,
  SMTP_PASSWORD: "smtp-password",
  SESSION_MAX_AGE: 1000,
  REDIS_URL: "test-redis-url",
  AUDIT_LOG_ENABLED: true,
}));

// Mock the CreateOrganization component
vi.mock("./components/create-organization", () => ({
  CreateOrganization: vi.fn(() => <div data-testid="create-organization-component" />),
}));

// Mock the RemovedFromOrganization component
vi.mock("./components/removed-from-organization", () => ({
  RemovedFromOrganization: vi.fn(({ user, isFormbricksCloud }) => (
    <div data-testid="removed-from-organization-component">
      <div data-testid="user-id">{user.id}</div>
      <div data-testid="is-formbricks-cloud">{isFormbricksCloud.toString()}</div>
    </div>
  )),
}));

// Mock the ClientLogout component
vi.mock("@/modules/ui/components/client-logout", () => ({
  ClientLogout: vi.fn(() => <div data-testid="client-logout-component" />),
}));

// Mock getServerSession from next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

// Mock services
vi.mock("@/lib/instance/service", () => ({
  gethasNoOrganizations: vi.fn(),
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationsByUserId: vi.fn(),
}));

vi.mock("@/lib/user/service", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsMultiOrgEnabled: vi.fn(),
}));

// Mock getTranslate
vi.mock("@/tolgee/server", async () => {
  const actual = await vi.importActual("@/tolgee/server");
  return {
    ...actual,
    getTranslate: () => (key: string) => key,
  };
});

describe("CreateOrganizationPage", () => {
  const mockSession = {
    user: {
      id: "user-123",
      name: "Test User",
      email: "test@example.com",
    },
  };

  const mockUser = {
    id: "user-123",
    name: "Test User",
    email: "test@example.com",
    emailVerified: null,
    imageUrl: null,
    twoFactorEnabled: false,
    identityProvider: "email" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    onboardingCompleted: false,
    role: "founder" as const,
    organizationId: "org-123",
    organizationRole: "owner",
    organizationName: "Test Org",
    organizationSlug: "test-org",
    organizationPlan: "free",
    organizationPeriod: "monthly",
    organizationPeriodStart: new Date(),
    organizationStripeCustomerId: null,
    organizationIsAIEnabled: false,
    objective: null,
    notificationSettings: {
      alert: {
        surveyInvite: true,
        surveyResponse: true,
        surveyClosed: true,
        surveyPaused: true,
        surveyCompleted: true,
        surveyDeleted: true,
        surveyUpdated: true,
        surveyCreated: true,
      },
      weeklySummary: {
        surveyInvite: true,
        surveyResponse: true,
        surveyClosed: true,
        surveyPaused: true,
        surveyCompleted: true,
        surveyDeleted: true,
        surveyUpdated: true,
        surveyCreated: true,
      },
      unsubscribedOrganizationIds: [],
    },
    locale: "en-US" as const,
    lastLoginAt: new Date(),
  };

  const mockOrganization = {
    id: "org-1",
    name: "Test Organization",
    createdAt: new Date(),
    updatedAt: new Date(),
    billing: {
      stripeCustomerId: null,
      plan: "free" as const,
      period: "monthly" as const,
      limits: {
        monthly: {
          responses: 1000,
          miu: 100,
        },
        projects: 5,
      },
      periodStart: new Date(),
    },
    isAIEnabled: false,
  };

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders CreateOrganization when hasNoOrganizations is true", async () => {
    // Mock session and services
    vi.mocked(nextAuth.getServerSession).mockResolvedValue(mockSession);
    vi.mocked(userService.getUser).mockResolvedValue(mockUser);
    vi.mocked(instanceService.gethasNoOrganizations).mockResolvedValue(true);
    vi.mocked(licenseCheck.getIsMultiOrgEnabled).mockResolvedValue(false);
    vi.mocked(organizationService.getOrganizationsByUserId).mockResolvedValue([]);

    // Render the page
    const page = await CreateOrganizationPage();
    render(page);

    // Verify the component was rendered
    expect(screen.getByTestId("create-organization-component")).toBeInTheDocument();
  });

  test("renders CreateOrganization when isMultiOrgEnabled is true", async () => {
    // Mock session and services
    vi.mocked(nextAuth.getServerSession).mockResolvedValue(mockSession);
    vi.mocked(userService.getUser).mockResolvedValue(mockUser);
    vi.mocked(instanceService.gethasNoOrganizations).mockResolvedValue(false);
    vi.mocked(licenseCheck.getIsMultiOrgEnabled).mockResolvedValue(true);
    vi.mocked(organizationService.getOrganizationsByUserId).mockResolvedValue([]);

    // Render the page
    const page = await CreateOrganizationPage();
    render(page);

    // Verify the component was rendered
    expect(screen.getByTestId("create-organization-component")).toBeInTheDocument();
  });

  test("renders RemovedFromOrganization when user has no organizations", async () => {
    // Mock session and services
    vi.mocked(nextAuth.getServerSession).mockResolvedValue(mockSession);
    vi.mocked(userService.getUser).mockResolvedValue(mockUser);
    vi.mocked(instanceService.gethasNoOrganizations).mockResolvedValue(false);
    vi.mocked(licenseCheck.getIsMultiOrgEnabled).mockResolvedValue(false);
    vi.mocked(organizationService.getOrganizationsByUserId).mockResolvedValue([]);

    // Render the page
    const page = await CreateOrganizationPage();
    render(page);

    // Verify the component was rendered with correct props
    expect(screen.getByTestId("removed-from-organization-component")).toBeInTheDocument();
    expect(screen.getByTestId("user-id").textContent).toBe(mockUser.id);
    expect(screen.getByTestId("is-formbricks-cloud").textContent).toBe("false");
  });

  test("shows notFound when user has organizations", async () => {
    // Mock session and services
    vi.mocked(nextAuth.getServerSession).mockResolvedValue(mockSession);
    vi.mocked(userService.getUser).mockResolvedValue(mockUser);
    vi.mocked(instanceService.gethasNoOrganizations).mockResolvedValue(false);
    vi.mocked(licenseCheck.getIsMultiOrgEnabled).mockResolvedValue(false);
    vi.mocked(organizationService.getOrganizationsByUserId).mockResolvedValue([mockOrganization]);

    const notFoundMock = vi.fn();
    vi.mocked(nextNavigation.notFound).mockImplementation(notFoundMock as unknown as any);

    // Render the page
    await CreateOrganizationPage();

    // Verify notFound was called
    expect(notFoundMock).toHaveBeenCalled();
  });

  test("renders ClientLogout when user is not found", async () => {
    // Mock session and services
    vi.mocked(nextAuth.getServerSession).mockResolvedValue(mockSession);
    vi.mocked(userService.getUser).mockResolvedValue(null);

    // Render the page
    const page = await CreateOrganizationPage();
    render(page);

    // Verify the component was rendered
    expect(screen.getByTestId("client-logout-component")).toBeInTheDocument();
  });

  test("throws AuthenticationError when session is not available", async () => {
    // Mock session as null
    vi.mocked(nextAuth.getServerSession).mockResolvedValue(null);

    // Expect an error when rendering the page
    await expect(CreateOrganizationPage()).rejects.toThrow(AuthenticationError);
  });
});
