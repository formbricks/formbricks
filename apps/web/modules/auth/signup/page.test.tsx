import { getIsValidInviteToken } from "@/modules/auth/signup/lib/invite";
import {
  getIsMultiOrgEnabled,
  getIsSamlSsoEnabled,
  getisSsoEnabled,
} from "@/modules/ee/license-check/lib/utils";
import { cleanup, render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyInviteToken } from "@formbricks/lib/jwt";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
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

vi.mock("@formbricks/lib/jwt", () => ({
  verifyInviteToken: vi.fn(),
}));

vi.mock("@formbricks/lib/utils/locale", () => ({
  findMatchingLocale: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

// Mock environment variables and constants
vi.mock("@formbricks/lib/constants", () => ({
  SIGNUP_ENABLED: true,
  EMAIL_AUTH_ENABLED: true,
  EMAIL_VERIFICATION_DISABLED: false,
  GOOGLE_OAUTH_ENABLED: true,
  GITHUB_OAUTH_ENABLED: true,
  AZURE_OAUTH_ENABLED: true,
  OIDC_OAUTH_ENABLED: true,
  OIDC_DISPLAY_NAME: "OpenID",
  SAML_OAUTH_ENABLED: true,
  SAML_TENANT: "test-tenant",
  SAML_PRODUCT: "test-product",
  IS_TURNSTILE_CONFIGURED: true,
  WEBAPP_URL: "http://localhost:3000",
  TERMS_URL: "http://localhost:3000/terms",
  PRIVACY_URL: "http://localhost:3000/privacy",
  DEFAULT_ORGANIZATION_ID: "test-org-id",
  DEFAULT_ORGANIZATION_ROLE: "admin",
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

  it("renders the signup page with all components when signup is enabled", async () => {
    // Mock the license check functions to return true
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
    vi.mocked(getisSsoEnabled).mockResolvedValue(true);
    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(true);
    vi.mocked(findMatchingLocale).mockResolvedValue("en");
    vi.mocked(verifyInviteToken).mockReturnValue({ inviteId: "test-invite-id" });
    vi.mocked(getIsValidInviteToken).mockResolvedValue(true);

    const result = await SignupPage({ searchParams: mockSearchParams });
    render(result);

    // Verify that all components are rendered
    expect(screen.getByTestId("testimonial")).toBeInTheDocument();
    expect(screen.getByTestId("form-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("signup-form")).toBeInTheDocument();
  });

  it("calls notFound when signup is disabled and no valid invite token is provided", async () => {
    // Mock the license check functions to return false
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
    vi.mocked(verifyInviteToken).mockImplementation(() => {
      throw new Error("Invalid token");
    });

    await SignupPage({ searchParams: {} });

    expect(notFound).toHaveBeenCalled();
  });

  it("calls notFound when invite token is invalid", async () => {
    // Mock the license check functions to return false
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
    vi.mocked(verifyInviteToken).mockImplementation(() => {
      throw new Error("Invalid token");
    });

    await SignupPage({ searchParams: { inviteToken: "invalid-token" } });

    expect(notFound).toHaveBeenCalled();
  });

  it("calls notFound when invite token is valid but invite is not found", async () => {
    // Mock the license check functions to return false
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(false);
    vi.mocked(verifyInviteToken).mockReturnValue({ inviteId: "test-invite-id" });
    vi.mocked(getIsValidInviteToken).mockResolvedValue(false);

    await SignupPage({ searchParams: { inviteToken: "test-token" } });

    expect(notFound).toHaveBeenCalled();
  });

  it("renders the page with email from search params", async () => {
    // Mock the license check functions to return true
    vi.mocked(getIsMultiOrgEnabled).mockResolvedValue(true);
    vi.mocked(getisSsoEnabled).mockResolvedValue(true);
    vi.mocked(getIsSamlSsoEnabled).mockResolvedValue(true);
    vi.mocked(findMatchingLocale).mockResolvedValue("en");
    vi.mocked(verifyInviteToken).mockReturnValue({ inviteId: "test-invite-id" });
    vi.mocked(getIsValidInviteToken).mockResolvedValue(true);

    const result = await SignupPage({ searchParams: { email: "test@example.com" } });
    render(result);

    // Verify that the form is rendered with the email from search params
    expect(screen.getByTestId("signup-form")).toBeInTheDocument();
  });
});
