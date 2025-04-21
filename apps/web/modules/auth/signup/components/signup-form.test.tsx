import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createUserAction } from "@/modules/auth/signup/actions";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createEmailTokenAction } from "../../../auth/actions";
import { SignupForm } from "./signup-form";

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
}));

// Set up a push mock for useRouter
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  useSearchParams: vi.fn(),
}));

vi.mock("react-turnstile", () => ({
  useTurnstile: () => ({
    reset: vi.fn(),
  }),
  default: (props: any) => (
    <div
      data-testid="turnstile"
      onClick={() => {
        if (props.onSuccess) {
          props.onSuccess("test-turnstile-token");
        }
      }}
      {...props}
    />
  ),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
    toast: {
      error: vi.fn(),
    },
  },
}));

vi.mock("@/modules/auth/signup/actions", () => ({
  createUserAction: vi.fn(),
}));

vi.mock("../../../auth/actions", () => ({
  createEmailTokenAction: vi.fn(),
}));

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn(),
}));

// Mock components

vi.mock("@/modules/ee/sso/components/sso-options", () => ({
  SSOOptions: () => <div data-testid="sso-options">SSOOptions</div>,
}));
vi.mock("@/modules/auth/signup/components/terms-privacy-links", () => ({
  TermsPrivacyLinks: () => <div data-testid="terms-privacy-links">TermsPrivacyLinks</div>,
}));
vi.mock("@/modules/ui/components/button", () => ({
  Button: (props: any) => <button {...props}>{props.children}</button>,
}));
vi.mock("@/modules/ui/components/input", () => ({
  Input: (props: any) => <input {...props} />,
}));
vi.mock("@/modules/ui/components/password-input", () => ({
  PasswordInput: (props: any) => <input type="password" {...props} />,
}));

const defaultProps = {
  webAppUrl: "http://localhost",
  privacyUrl: "http://localhost/privacy",
  termsUrl: "http://localhost/terms",
  emailAuthEnabled: true,
  googleOAuthEnabled: false,
  githubOAuthEnabled: false,
  azureOAuthEnabled: false,
  oidcOAuthEnabled: false,
  userLocale: "en-US",
  emailVerificationDisabled: false,
  isSsoEnabled: false,
  samlSsoEnabled: false,
  isTurnstileConfigured: false,
  samlTenant: "",
  samlProduct: "",
  defaultOrganizationId: "org1",
  defaultOrganizationRole: "member",
  turnstileSiteKey: "dummy", // not used since isTurnstileConfigured is false
} as const;

describe("SignupForm", () => {
  afterEach(() => {
    cleanup();
  });

  test("toggles the signup form on button click", () => {
    render(<SignupForm {...defaultProps} />);

    // Initially, the signup form is hidden.
    try {
      screen.getByTestId("signup-name");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }

    // Click the button to reveal the signup form.
    const toggleButton = screen.getByTestId("signup-show-login");
    fireEvent.click(toggleButton);

    // Now the input fields should appear.
    expect(screen.getByTestId("signup-name")).toBeInTheDocument();
    expect(screen.getByTestId("signup-email")).toBeInTheDocument();
    expect(screen.getByTestId("signup-password")).toBeInTheDocument();
  });

  test("submits the form successfully", async () => {
    // Set up mocks for the API actions.
    vi.mocked(createUserAction).mockResolvedValue({ data: true } as any);
    vi.mocked(createEmailTokenAction).mockResolvedValue({ data: "token123" });

    render(<SignupForm {...defaultProps} />);

    // Click the button to reveal the signup form.
    const toggleButton = screen.getByTestId("signup-show-login");
    fireEvent.click(toggleButton);

    const nameInput = screen.getByTestId("signup-name");
    const emailInput = screen.getByTestId("signup-email");
    const passwordInput = screen.getByTestId("signup-password");

    fireEvent.change(nameInput, { target: { value: "Test User" } });
    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "Password123" } });

    const submitButton = screen.getByTestId("signup-submit");
    fireEvent.submit(submitButton);

    await waitFor(() => {
      expect(createUserAction).toHaveBeenCalledWith({
        name: "Test User",
        email: "test@example.com",
        password: "Password123",
        userLocale: defaultProps.userLocale,
        inviteToken: "",
        emailVerificationDisabled: defaultProps.emailVerificationDisabled,
        defaultOrganizationId: defaultProps.defaultOrganizationId,
        defaultOrganizationRole: defaultProps.defaultOrganizationRole,
        turnstileToken: undefined,
      });
    });

    await waitFor(() => {
      expect(createEmailTokenAction).toHaveBeenCalledWith({ email: "test@example.com" });
    });

    // Since email verification is enabled (emailVerificationDisabled is false),
    // router.push should be called with the verification URL.
    expect(pushMock).toHaveBeenCalledWith("/auth/verification-requested?token=token123");
  });

  test("submits the form successfully when turnstile is configured", async () => {
    // Override props to enable Turnstile
    const props = {
      ...defaultProps,
      isTurnstileConfigured: true,
      turnstileSiteKey: "dummy",
      emailVerificationDisabled: true,
    };

    // Set up mocks for the API actions
    vi.mocked(createUserAction).mockResolvedValue({ data: true } as any);
    vi.mocked(createEmailTokenAction).mockResolvedValue({ data: "token123" });

    render(<SignupForm {...props} />);

    // Click the button to reveal the signup form
    const toggleButton = screen.getByTestId("signup-show-login");
    fireEvent.click(toggleButton);

    // Fill out the form fields
    fireEvent.change(screen.getByTestId("signup-name"), { target: { value: "Test User" } });
    fireEvent.change(screen.getByTestId("signup-email"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByTestId("signup-password"), { target: { value: "Password123" } });

    // Simulate receiving a turnstile token by clicking the Turnstile element.
    const turnstileElement = screen.getByTestId("turnstile");
    fireEvent.click(turnstileElement);

    // Submit the form.
    const submitButton = screen.getByTestId("signup-submit");
    fireEvent.submit(submitButton);
    await waitFor(() => {
      expect(createUserAction).toHaveBeenCalledWith({
        name: "Test User",
        email: "test@example.com",
        password: "Password123",
        userLocale: props.userLocale,
        inviteToken: "",
        emailVerificationDisabled: true,
        defaultOrganizationId: props.defaultOrganizationId,
        defaultOrganizationRole: props.defaultOrganizationRole,
        turnstileToken: "test-turnstile-token",
      });
    });

    await waitFor(() => {
      expect(createEmailTokenAction).toHaveBeenCalledWith({ email: "test@example.com" });
    });

    expect(pushMock).toHaveBeenCalledWith("/auth/signup-without-verification-success");
  });

  test("submits the form successfully when turnstile is configured, but createEmailTokenAction don't return data", async () => {
    // Override props to enable Turnstile
    const props = {
      ...defaultProps,
      isTurnstileConfigured: true,
      turnstileSiteKey: "dummy",
      emailVerificationDisabled: true,
    };

    // Set up mocks for the API actions
    vi.mocked(createUserAction).mockResolvedValue({ data: true } as any);
    vi.mocked(createEmailTokenAction).mockResolvedValue(undefined);
    vi.mocked(getFormattedErrorMessage).mockReturnValue("error");

    render(<SignupForm {...props} />);

    // Click the button to reveal the signup form
    const toggleButton = screen.getByTestId("signup-show-login");
    fireEvent.click(toggleButton);

    // Fill out the form fields
    fireEvent.change(screen.getByTestId("signup-name"), { target: { value: "Test User" } });
    fireEvent.change(screen.getByTestId("signup-email"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByTestId("signup-password"), { target: { value: "Password123" } });

    // Simulate receiving a turnstile token by clicking the Turnstile element.
    const turnstileElement = screen.getByTestId("turnstile");
    fireEvent.click(turnstileElement);

    // Submit the form.
    const submitButton = screen.getByTestId("signup-submit");
    fireEvent.submit(submitButton);
    await waitFor(() => {
      expect(createUserAction).toHaveBeenCalledWith({
        name: "Test User",
        email: "test@example.com",
        password: "Password123",
        userLocale: props.userLocale,
        inviteToken: "",
        emailVerificationDisabled: true,
        defaultOrganizationId: props.defaultOrganizationId,
        defaultOrganizationRole: props.defaultOrganizationRole,
        turnstileToken: "test-turnstile-token",
      });
    });

    // Since Turnstile is configured, but no token is received, an error message should be shown.
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("error");
    });
  });

  test("shows an error message if turnstile is configured, but no token is received", async () => {
    // Override props to enable Turnstile
    const props = {
      ...defaultProps,
      isTurnstileConfigured: true,
      turnstileSiteKey: "dummy",
      emailVerificationDisabled: true,
    };

    // Set up mocks for the API actions
    vi.mocked(createUserAction).mockResolvedValue({ data: true } as any);
    vi.mocked(createEmailTokenAction).mockResolvedValue({ data: "token123" });

    render(<SignupForm {...props} />);

    // Click the button to reveal the signup form
    const toggleButton = screen.getByTestId("signup-show-login");
    fireEvent.click(toggleButton);

    // Fill out the form fields
    fireEvent.change(screen.getByTestId("signup-name"), { target: { value: "Test User" } });
    fireEvent.change(screen.getByTestId("signup-email"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByTestId("signup-password"), { target: { value: "Password123" } });

    // Submit the form.
    const submitButton = screen.getByTestId("signup-submit");
    fireEvent.submit(submitButton);

    // Since Turnstile is configured, but no token is received, an error message should be shown.
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("auth.signup.please_verify_captcha");
    });
  });

  test("Invite token is in the search params", async () => {
    // Set up mocks for the API actions
    vi.mocked(createUserAction).mockResolvedValue({ data: true } as any);
    vi.mocked(createEmailTokenAction).mockResolvedValue({ data: "token123" });
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("inviteToken=token123") as any);

    render(<SignupForm {...defaultProps} />);

    // Click the button to reveal the signup form
    const toggleButton = screen.getByTestId("signup-show-login");
    fireEvent.click(toggleButton);

    // Fill out the form fields
    fireEvent.change(screen.getByTestId("signup-name"), { target: { value: "Test User" } });
    fireEvent.change(screen.getByTestId("signup-email"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByTestId("signup-password"), { target: { value: "Password123" } });

    // Submit the form.
    const submitButton = screen.getByTestId("signup-submit");
    fireEvent.submit(submitButton);

    // Check that the invite token is passed to the createUserAction
    await waitFor(() => {
      expect(createUserAction).toHaveBeenCalledWith({
        name: "Test User",
        email: "test@example.com",
        password: "Password123",
        userLocale: defaultProps.userLocale,
        inviteToken: "token123",
        emailVerificationDisabled: defaultProps.emailVerificationDisabled,
        defaultOrganizationId: defaultProps.defaultOrganizationId,
        defaultOrganizationRole: defaultProps.defaultOrganizationRole,
        turnstileToken: undefined,
      });
    });

    await waitFor(() => {
      expect(createEmailTokenAction).toHaveBeenCalledWith({ email: "test@example.com" });
    });

    expect(pushMock).toHaveBeenCalledWith("/auth/verification-requested?token=token123");
  });
});
