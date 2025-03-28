import * as licenseCheck from "@/modules/ee/license-check/lib/utils";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { SignupPage } from "./page";

// Mock dependencies

vi.mock("@formbricks/lib/constants", () => ({
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
  DEFAULT_ORGANIZATION_ROLE: "test-default-organization-role",
  IS_TURNSTILE_CONFIGURED: true,
  SAML_TENANT: "test-saml-tenant",
  SAML_PRODUCT: "test-saml-product",
  TURNSTILE_SITE_KEY: "test-turnstile-site-key",
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsMultiOrgEnabled: vi.fn(),
  getisSsoEnabled: vi.fn(),
  getIsSamlSsoEnabled: vi.fn(),
}));

vi.mock("@formbricks/lib/utils/locale", () => ({
  findMatchingLocale: vi.fn(),
}));

// Mock components

vi.mock("@/modules/auth/components/testimonial", () => ({
  Testimonial: () => <div data-testid="testimonial">Testimonial</div>,
}));
vi.mock("@/modules/auth/components/form-wrapper", () => ({
  FormWrapper: () => <div data-testid="form-wrapper">FormWrapper</div>,
}));

describe("SignupPage", () => {
  beforeEach(() => {
    (licenseCheck.getIsMultiOrgEnabled as any).mockResolvedValue(true);
    (licenseCheck.getisSsoEnabled as any).mockResolvedValue(false);
    (licenseCheck.getIsSamlSsoEnabled as any).mockResolvedValue(false);
    (findMatchingLocale as any).mockResolvedValue("en-US");
  });

  it("renders the signup page correctly when inviteToken is provided", async () => {
    const searchParamsPromise = Promise.resolve({
      inviteToken: "abc123",
      email: "test@example.com",
    });

    const page = await SignupPage({ searchParams: searchParamsPromise });
    render(page);

    expect(screen.getByTestId("testimonial")).toBeInTheDocument();
    expect(screen.getByTestId("form-wrapper")).toBeInTheDocument();
  });

  it("calls notFound when inviteToken is missing and multi-org is disabled", async () => {
    // For this test, simulate a missing inviteToken and disable multi-org.
    const searchParamsPromise = Promise.resolve({
      email: "test@example.com",
    });
    (licenseCheck.getIsMultiOrgEnabled as any).mockResolvedValue(false);

    await SignupPage({ searchParams: searchParamsPromise });

    expect(notFound).toHaveBeenCalled();
  });
});
