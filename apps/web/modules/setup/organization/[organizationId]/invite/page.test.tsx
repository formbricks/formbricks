import * as constants from "@/lib/constants";
import * as roleAccess from "@/lib/organization/auth";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as nextAuth from "next-auth";
import * as nextNavigation from "next/navigation";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AuthenticationError } from "@formbricks/types/errors";
import { InvitePage } from "./page";

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

// Mock the InviteMembers component
vi.mock("@/modules/setup/organization/[organizationId]/invite/components/invite-members", () => ({
  InviteMembers: vi.fn(({ IS_SMTP_CONFIGURED, organizationId }) => (
    <div data-testid="invite-members-component">
      <div data-testid="smtp-configured">{IS_SMTP_CONFIGURED.toString()}</div>
      <div data-testid="organization-id">{organizationId}</div>
    </div>
  )),
}));

// Mock getServerSession from next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

// Mock verifyUserRoleAccess
vi.mock("@/lib/organization/auth", () => ({
  verifyUserRoleAccess: vi.fn(),
}));

// Mock getTranslate
vi.mock("@/tolgee/server", () => ({
  getTranslate: () => vi.fn(),
}));

describe("InvitePage", () => {
  const organizationId = "org-123";
  const mockParams = Promise.resolve({ organizationId });
  const mockSession = {
    user: {
      id: "user-123",
      name: "Test User",
      email: "test@example.com",
    },
  };

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders InviteMembers component when user has access", async () => {
    // Mock SMTP configuration values
    vi.spyOn(constants, "SMTP_HOST", "get").mockReturnValue("smtp.example.com");
    vi.spyOn(constants, "SMTP_PORT", "get").mockReturnValue("587");
    vi.spyOn(constants, "SMTP_USER", "get").mockReturnValue("user@example.com");
    vi.spyOn(constants, "SMTP_PASSWORD", "get").mockReturnValue("password");

    // Mock session and role access
    vi.mocked(nextAuth.getServerSession).mockResolvedValue(mockSession);
    vi.mocked(roleAccess.verifyUserRoleAccess).mockResolvedValue({
      hasCreateOrUpdateMembersAccess: true,
    } as unknown as any);

    // Render the page
    const page = await InvitePage({ params: mockParams });
    render(page);

    // Verify the component was rendered with correct props
    expect(screen.getByTestId("invite-members-component")).toBeInTheDocument();
    expect(screen.getByTestId("smtp-configured").textContent).toBe("true");
    expect(screen.getByTestId("organization-id").textContent).toBe(organizationId);
  });

  test("shows notFound when user lacks permissions", async () => {
    // Mock session and role access
    vi.mocked(nextAuth.getServerSession).mockResolvedValue(mockSession);
    vi.mocked(roleAccess.verifyUserRoleAccess).mockResolvedValue({
      hasCreateOrUpdateMembersAccess: false,
    } as unknown as any);

    const notFoundMock = vi.fn();
    vi.mocked(nextNavigation.notFound).mockImplementation(notFoundMock as unknown as any);

    // Render the page
    await InvitePage({ params: mockParams });

    // Verify notFound was called
    expect(notFoundMock).toHaveBeenCalled();
  });

  test("passes false to IS_SMTP_CONFIGURED when SMTP is not fully configured", async () => {
    // Mock partial SMTP configuration (missing password)
    vi.spyOn(constants, "SMTP_HOST", "get").mockReturnValue("smtp.example.com");
    vi.spyOn(constants, "SMTP_PORT", "get").mockReturnValue("587");
    vi.spyOn(constants, "SMTP_USER", "get").mockReturnValue("user@example.com");
    vi.spyOn(constants, "SMTP_PASSWORD", "get").mockReturnValue("");

    // Mock session and role access
    vi.mocked(nextAuth.getServerSession).mockResolvedValue(mockSession);
    vi.mocked(roleAccess.verifyUserRoleAccess).mockResolvedValue({
      hasCreateOrUpdateMembersAccess: true,
    } as unknown as any);

    // Render the page
    const page = await InvitePage({ params: mockParams });
    render(page);

    // Verify IS_SMTP_CONFIGURED is false
    expect(screen.getByTestId("smtp-configured").textContent).toBe("false");
  });

  test("throws AuthenticationError when session is not available", async () => {
    // Mock session as null
    vi.mocked(nextAuth.getServerSession).mockResolvedValue(null);

    // Expect an error when rendering the page
    await expect(InvitePage({ params: mockParams })).rejects.toThrow(AuthenticationError);
  });
});
