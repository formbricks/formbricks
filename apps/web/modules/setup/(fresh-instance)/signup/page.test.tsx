import { getIsSamlSsoEnabled, getisSsoEnabled } from "@/modules/ee/license-check/lib/utils";
import { getTranslate } from "@/tolgee/server";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
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
  getisSsoEnabled: vi.fn(),
  getIsSamlSsoEnabled: vi.fn(),
}));

vi.mock("@formbricks/lib/utils/locale", () => ({
  findMatchingLocale: vi.fn(),
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: vi.fn(),
}));

// Mock the SignupForm component to simplify our test assertions
vi.mock("@/modules/auth/signup/components/signup-form", () => ({
  SignupForm: (props) => (
    <div data-testid="signup-form" data-turnstile-key={props.turnstileSiteKey}>
      SignupForm
    </div>
  ),
}));

describe("SignupPage", () => {
  beforeEach(() => {
    vi.mocked(getisSsoEnabled).mockResolvedValue(true);
    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(false);
    vi.mocked(findMatchingLocale).mockResolvedValue("en-US");
    vi.mocked(getTranslate).mockResolvedValue((key) => key);
  });

  test("renders the signup page correctly", async () => {
    const page = await SignupPage();
    render(page);

    expect(screen.getByTestId("signup-form")).toBeInTheDocument();
    expect(screen.getByTestId("signup-form")).toHaveAttribute(
      "data-turnstile-key",
      "test-turnstile-site-key"
    );
  });
});
