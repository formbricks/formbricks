import { verifyInviteToken } from "@/lib/jwt";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getIsValidInviteToken } from "@/modules/auth/signup/lib/invite";
import {
  getIsMultiOrgEnabled,
  getIsSamlSsoEnabled,
  getisSsoEnabled,
} from "@/modules/ee/license-check/lib/utils";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SignupPage } from "./page";

// Mock the necessary dependencies
vi.mock("@/modules/auth/components/testimonial", () => ({
  Testimonial: () => <div data-testid="testimonial">Testimonial</div>,
}));

vi.mock("@/modules/auth/components/form-wrapper", () => ({
  FormWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="form-wrapper">{children}</div>
  ),
}));

vi.mock("@/modules/auth/signup/components/signup-form", () => ({
  SignupForm: () => <div data-testid="signup-form">SignupForm</div>,
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsMultiOrgEnabled: vi.fn(),
  getIsSamlSsoEnabled: vi.fn(),
  getisSsoEnabled: vi.fn(),
}));

vi.mock("@/modules/auth/signup/lib/invite", () => ({
  getIsValidInviteToken: vi.fn(),
}));

vi.mock("@/lib/jwt", () => ({
  verifyInviteToken: vi.fn(),
}));

vi.mock("@/lib/utils/locale", () => ({
  findMatchingLocale: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

// Mock environment variables and constants
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
}));

describe("SignupPage", () => {
  const mockSearchParams = {
    inviteToken: "test-token",
    email: "test@example.com",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders the signup page with all components when signup is enabled", async () => {
    // Mock the license check functions to return true
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
    vi.mocked(getisSsoEnabled).mockResolvedValue(true);
    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(true);
    vi.mocked(findMatchingLocale).mockResolvedValue("en-US");
    vi.mocked(verifyInviteToken).mockReturnValue({
      inviteId: "test-invite-id",
      email: "test@example.com",
    });
    vi.mocked(getIsValidInviteToken).mockResolvedValue(true);

    const result = await SignupPage({ searchParams: mockSearchParams });
    render(result);

    // Verify that all components are rendered
    expect(screen.getByTestId("testimonial")).toBeInTheDocument();
    expect(screen.getByTestId("form-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("signup-form")).toBeInTheDocument();
  });

  test("calls notFound when signup is disabled and no valid invite token is provided", async () => {
    // Mock the license check functions to return false
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
    vi.mocked(verifyInviteToken).mockImplementation(() => {
      throw new Error("Invalid token");
    });

    await SignupPage({ searchParams: {} });

    expect(notFound).toHaveBeenCalled();
  });

  test("calls notFound when invite token is invalid", async () => {
    // Mock the license check functions to return false
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
    vi.mocked(verifyInviteToken).mockImplementation(() => {
      throw new Error("Invalid token");
    });

    await SignupPage({ searchParams: { inviteToken: "invalid-token" } });

    expect(notFound).toHaveBeenCalled();
  });

  test("calls notFound when invite token is valid but invite is not found", async () => {
    // Mock the license check functions to return false
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
    vi.mocked(verifyInviteToken).mockReturnValue({
      inviteId: "test-invite-id",
      email: "test@example.com",
    });
    vi.mocked(getIsValidInviteToken).mockResolvedValue(false);

    await SignupPage({ searchParams: { inviteToken: "test-token" } });

    expect(notFound).toHaveBeenCalled();
  });

  test("renders the page with email from search params", async () => {
    // Mock the license check functions to return true
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
    vi.mocked(getisSsoEnabled).mockResolvedValue(true);
    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(true);
    vi.mocked(findMatchingLocale).mockResolvedValue("en-US");
    vi.mocked(verifyInviteToken).mockReturnValue({
      inviteId: "test-invite-id",
      email: "test@example.com",
    });
    vi.mocked(getIsValidInviteToken).mockResolvedValue(true);

    const result = await SignupPage({ searchParams: { email: "test@example.com" } });
    render(result);

    // Verify that the form is rendered with the email from search params
    expect(screen.getByTestId("signup-form")).toBeInTheDocument();
  });
});
