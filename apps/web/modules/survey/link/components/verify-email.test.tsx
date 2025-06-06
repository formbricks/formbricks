import { isSurveyResponsePresentAction, sendLinkSurveyEmailAction } from "@/modules/survey/link/actions";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { VerifyEmail } from "./verify-email";

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
  IS_RECAPTCHA_CONFIGURED: true,
  IMPRINT_URL: "https://imprint.com",
  PRIVACY_URL: "https://privacy.com",
  RECAPTCHA_SITE_KEY: "mock-recaptcha-site-key",
  FB_LOGO_URL: "https://logo.com",
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: 587,
  SMTP_USERNAME: "user@example.com",
  SMTP_PASSWORD: "password",
  SESSION_MAX_AGE: 1000,
  REDIS_URL: "test-redis-url",
  AUDIT_LOG_ENABLED: true,
}));

vi.mock("@/modules/survey/link/actions");

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
  Toaster: vi.fn(() => <div data-testid="toaster" />),
}));

describe("VerifyEmail", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  const baseProps = {
    survey: {
      id: "1",
      isSingleResponsePerEmailEnabled: false,
      name: "Test Survey",
      styling: {},
      questions: [{ headline: { default: "Q1" } }],
    } as unknown as TSurvey,
    languageCode: "default",
    styling: {},
    locale: "en",
  } as any;

  test("renders input and buttons", () => {
    render(<VerifyEmail {...baseProps} />);
    expect(screen.getByPlaceholderText("engineering@acme.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /verify_email_before_submission_button/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /just_curious/i })).toBeInTheDocument();
  });

  test("shows already received error when single response enabled", async () => {
    const props = {
      ...baseProps,
      survey: { ...baseProps.survey, isSingleResponsePerEmailEnabled: true },
    };
    vi.mocked(isSurveyResponsePresentAction).mockResolvedValue({ data: true });
    render(<VerifyEmail {...props} />);
    await userEvent.type(screen.getByPlaceholderText("engineering@acme.com"), "test@acme.com");
    await userEvent.click(screen.getByRole("button", { name: /verify_email_before_submission_button/i }));
    expect(await screen.findByText("s.response_already_received")).toBeInTheDocument();
  });

  test("shows success message on email sent", async () => {
    vi.mocked(sendLinkSurveyEmailAction).mockResolvedValue({ data: { success: true } });
    render(<VerifyEmail {...baseProps} />);
    await userEvent.type(screen.getByPlaceholderText("engineering@acme.com"), "test@acme.com");
    await userEvent.click(screen.getByRole("button", { name: /verify_email_before_submission_button/i }));
    expect(await screen.findByText(/s.survey_sent_to/)).toBeInTheDocument();
    expect(screen.getByText(/check_inbox_or_spam/)).toBeInTheDocument();
  });

  test("toggles preview questions", async () => {
    render(<VerifyEmail {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: /just_curious/i }));
    expect(screen.getByText(/question_preview/i)).toBeInTheDocument();
    expect(screen.getByText("1. Q1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /want_to_respond/i }));
    expect(screen.getByPlaceholderText("engineering@acme.com")).toBeInTheDocument();
  });
});
