import { getEmailFromEmailToken } from "@/lib/jwt";
import { VerificationRequestedPage } from "@/modules/auth/verification-requested/page";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/jwt", () => ({
  getEmailFromEmailToken: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

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

vi.mock("@/modules/auth/components/form-wrapper", () => ({
  FormWrapper: ({ children }) => <div>{children}</div>,
}));

vi.mock("@/modules/auth/verification-requested/components/request-verification-email", () => ({
  RequestVerificationEmail: ({ email }) => <div>Mocked RequestVerificationEmail: {email}</div>,
}));

vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children }) => <div>{children}</div>,
}));

describe("VerificationRequestedPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders the page with valid email", async () => {
    const mockEmail = "test@example.com";
    vi.mocked(getEmailFromEmailToken).mockReturnValue(mockEmail);

    const searchParams = { token: "valid-token" };
    const Page = await VerificationRequestedPage({ searchParams });
    render(Page);

    expect(
      screen.getByText("auth.verification-requested.please_confirm_your_email_address")
    ).toBeInTheDocument();
    expect(screen.getAllByText(/test@example\.com/)).toHaveLength(2);
    expect(
      screen.getByText(
        "auth.verification-requested.verification_email_successfully_sent_info test@example.com"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Mocked RequestVerificationEmail: ${mockEmail.toLowerCase()}`)
    ).toBeInTheDocument();
  });

  test("renders invalid email message when email parsing fails", async () => {
    vi.mocked(getEmailFromEmailToken).mockReturnValue("invalid-email");

    const searchParams = { token: "valid-token" };
    const Page = await VerificationRequestedPage({ searchParams });
    render(Page);

    expect(screen.getByText("auth.verification-requested.invalid_email_address")).toBeInTheDocument();
  });

  test("renders invalid token message when token is invalid", async () => {
    const mockError = new Error("Invalid token");
    const { logger } = await import("@formbricks/logger");

    vi.mocked(getEmailFromEmailToken).mockImplementation(() => {
      throw mockError;
    });

    const searchParams = { token: "invalid-token" };
    const Page = await VerificationRequestedPage({ searchParams });
    render(Page);

    expect(logger.error).toHaveBeenCalledWith(mockError, "Invalid token");
    expect(screen.getByText("auth.verification-requested.invalid_token")).toBeInTheDocument();
  });

  test("calls logger.error when token parsing throws an error", async () => {
    const mockError = new Error("JWT malformed");
    const { logger } = await import("@formbricks/logger");

    vi.mocked(getEmailFromEmailToken).mockImplementation(() => {
      throw mockError;
    });

    const searchParams = { token: "malformed-token" };
    await VerificationRequestedPage({ searchParams });

    expect(logger.error).toHaveBeenCalledWith(mockError, "Invalid token");
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
