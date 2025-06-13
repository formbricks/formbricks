import { getEmailFromEmailToken } from "@/lib/jwt";
import { SignupWithoutVerificationSuccessPage } from "@/modules/auth/signup-without-verification-success/page";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
  T: ({ keyName, params }) => {
    if (params && params.email) {
      return `${keyName} ${params.email}`;
    }
    return keyName;
  },
}));

vi.mock("@/lib/constants", () => ({
  INTERCOM_SECRET_KEY: "test-secret-key",
  IS_INTERCOM_CONFIGURED: true,
  INTERCOM_APP_ID: "test-app-id",
  ENCRYPTION_KEY: "test-encryption-key",
  ENTERPRISE_LICENSE_KEY: "test-enterprise-license-key",
  GITHUB_ID: "test-github-id",
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
  IS_POSTHOG_CONFIGURED: true,
  POSTHOG_API_HOST: "test-posthog-api-host",
  POSTHOG_API_KEY: "test-posthog-api-key",
  FORMBRICKS_ENVIRONMENT_ID: "mock-formbricks-environment-id",
  IS_FORMBRICKS_ENABLED: true,
  SESSION_MAX_AGE: 1000,
  AVAILABLE_LOCALES: ["en-US", "de-DE", "pt-BR", "fr-FR", "zh-Hant-TW", "pt-PT"],
}));

vi.mock("@/modules/auth/components/back-to-login-button", () => ({
  BackToLoginButton: () => <div>Mocked BackToLoginButton</div>,
}));

vi.mock("@/modules/auth/components/form-wrapper", () => ({
  FormWrapper: ({ children }) => <div>{children}</div>,
}));

vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children }) => <div>{children}</div>,
}));

vi.mock("@/lib/jwt", () => ({
  getEmailFromEmailToken: vi.fn(),
}));


describe("SignupWithoutVerificationSuccessPage", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  test("renders the success page correctly", async () => {
    vi.mocked(getEmailFromEmailToken).mockReturnValue("test@example.com");

    const Page = await SignupWithoutVerificationSuccessPage({ searchParams: { token: "test-token" } });
    render(Page);

    expect(
      screen.getByText("auth.signup_without_verification_success.user_successfully_created")
    ).toBeInTheDocument();
    expect(
      screen.getByText("auth.signup_without_verification_success.user_successfully_created_info test@example.com")
    ).toBeInTheDocument();
    expect(screen.getByText("Mocked BackToLoginButton")).toBeInTheDocument();
  });
});
