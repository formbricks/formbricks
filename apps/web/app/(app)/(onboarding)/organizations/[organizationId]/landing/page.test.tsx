import { getOrganizationsByUserId } from "@/lib/organization/service";
import { getUser } from "@/lib/user/service";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { getTranslate } from "@/tolgee/server";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { notFound, redirect } from "next/navigation";
import { afterEach, describe, expect, test, vi } from "vitest";
import Page from "./page";

vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  IS_PRODUCTION: false,
  IS_DEVELOPMENT: true,
  E2E_TESTING: false,
  WEBAPP_URL: "http://localhost:3000",
  SURVEY_URL: "http://localhost:3000/survey",
  ENCRYPTION_KEY: "mock-encryption-key",
  CRON_SECRET: "mock-cron-secret",
  DEFAULT_BRAND_COLOR: "#64748b",
  FB_LOGO_URL: "https://mock-logo-url.com/logo.png",
  PRIVACY_URL: "http://localhost:3000/privacy",
  TERMS_URL: "http://localhost:3000/terms",
  IMPRINT_URL: "http://localhost:3000/imprint",
  IMPRINT_ADDRESS: "Mock Address",
  PASSWORD_RESET_DISABLED: false,
  EMAIL_VERIFICATION_DISABLED: false,
  GOOGLE_OAUTH_ENABLED: false,
  GITHUB_OAUTH_ENABLED: false,
  AZURE_OAUTH_ENABLED: false,
  OIDC_OAUTH_ENABLED: false,
  SAML_OAUTH_ENABLED: false,
  SAML_XML_DIR: "./mock-saml-connection",
  SIGNUP_ENABLED: true,
  EMAIL_AUTH_ENABLED: true,
  INVITE_DISABLED: false,
  SLACK_CLIENT_SECRET: "mock-slack-secret",
  SLACK_CLIENT_ID: "mock-slack-id",
  SLACK_AUTH_URL: "https://mock-slack-auth-url.com",
  GOOGLE_SHEETS_CLIENT_ID: "mock-google-sheets-id",
  GOOGLE_SHEETS_CLIENT_SECRET: "mock-google-sheets-secret",
  GOOGLE_SHEETS_REDIRECT_URL: "http://localhost:3000/google-sheets-redirect",
  NOTION_OAUTH_CLIENT_ID: "mock-notion-id",
  NOTION_OAUTH_CLIENT_SECRET: "mock-notion-secret",
  NOTION_REDIRECT_URI: "http://localhost:3000/notion-redirect",
  NOTION_AUTH_URL: "https://mock-notion-auth-url.com",
  AIRTABLE_CLIENT_ID: "mock-airtable-id",
  SMTP_HOST: "mock-smtp-host",
  SMTP_PORT: "587",
  SMTP_SECURE_ENABLED: false,
  SMTP_USER: "mock-smtp-user",
  SMTP_PASSWORD: "mock-smtp-password",
  SMTP_AUTHENTICATED: true,
  SMTP_REJECT_UNAUTHORIZED_TLS: true,
  MAIL_FROM: "mock@mail.com",
  MAIL_FROM_NAME: "Mock Mail",
  NEXTAUTH_SECRET: "mock-nextauth-secret",
  ITEMS_PER_PAGE: 30,
  SURVEYS_PER_PAGE: 12,
  RESPONSES_PER_PAGE: 25,
  TEXT_RESPONSES_PER_PAGE: 5,
  INSIGHTS_PER_PAGE: 10,
  DOCUMENTS_PER_PAGE: 10,
  MAX_RESPONSES_FOR_INSIGHT_GENERATION: 500,
  MAX_OTHER_OPTION_LENGTH: 250,
  ENTERPRISE_LICENSE_KEY: "ABC",
  GITHUB_ID: "mock-github-id",
  GITHUB_SECRET: "mock-github-secret",
  GITHUB_OAUTH_URL: "https://mock-github-auth-url.com",
  AZURE_ID: "mock-azure-id",
  AZUREAD_CLIENT_ID: "mock-azure-client-id",
  AZUREAD_CLIENT_SECRET: "mock-azure-client-secret",
  GOOGLE_CLIENT_ID: "mock-google-client-id",
  GOOGLE_CLIENT_SECRET: "mock-google-client-secret",
  GOOGLE_OAUTH_URL: "https://mock-google-auth-url.com",
  AZURE_OAUTH_URL: "https://mock-azure-auth-url.com",
  OIDC_ID: "mock-oidc-id",
  OIDC_OAUTH_URL: "https://mock-oidc-auth-url.com",
  SAML_ID: "mock-saml-id",
  SAML_OAUTH_URL: "https://mock-saml-auth-url.com",
  SAML_METADATA_URL: "https://mock-saml-metadata-url.com",
  AZUREAD_TENANT_ID: "mock-azure-tenant-id",
  AZUREAD_OAUTH_URL: "https://mock-azuread-auth-url.com",
  OIDC_DISPLAY_NAME: "Mock OIDC",
  OIDC_CLIENT_ID: "mock-oidc-client-id",
  OIDC_CLIENT_SECRET: "mock-oidc-client-secret",
  OIDC_REDIRECT_URL: "http://localhost:3000/oidc-redirect",
  OIDC_AUTH_URL: "https://mock-oidc-auth-url.com",
  OIDC_ISSUER: "https://mock-oidc-issuer.com",
  OIDC_SIGNING_ALGORITHM: "RS256",
}));

vi.mock("@/app/(app)/(onboarding)/organizations/[organizationId]/landing/components/landing-sidebar", () => ({
  LandingSidebar: () => <div data-testid="landing-sidebar" />,
}));
vi.mock("@/modules/organization/lib/utils");
vi.mock("@/lib/user/service");
vi.mock("@/lib/organization/service");
vi.mock("@/modules/ee/license-check/lib/utils");
vi.mock("@/tolgee/server");
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => "REDIRECT_STUB"),
  notFound: vi.fn(() => "NOT_FOUND_STUB"),
}));

vi.mock("@/modules/ee/license-check/lib/license", () => ({
  getEnterpriseLicense: () =>
    Promise.resolve({
      active: true,
      features: { isMultiOrgEnabled: true },
      lastChecked: new Date(),
      isPendingDowngrade: false,
      fallbackLevel: "live",
    }),
}));

describe("Page component", () => {
  afterEach(() => {
    cleanup();
  });

  test("redirects to login if no user session", async () => {
    vi.mocked(getOrganizationAuth).mockResolvedValue({ session: {}, organization: {} } as any);

    const result = await Page({ params: { organizationId: "org1" } });

    expect(redirect).toHaveBeenCalledWith("/auth/login");
    expect(result).toBe("REDIRECT_STUB");
  });

  test("returns notFound if user does not exist", async () => {
    vi.mocked(getOrganizationAuth).mockResolvedValue({
      session: { user: { id: "user1" } },
      organization: {},
    } as any);
    vi.mocked(getUser).mockResolvedValue(null);

    const result = await Page({ params: { organizationId: "org1" } });

    expect(notFound).toHaveBeenCalled();
    expect(result).toBe("NOT_FOUND_STUB");
  });

  test("renders header and sidebar for authenticated user", async () => {
    vi.mocked(getOrganizationAuth).mockResolvedValue({
      session: { user: { id: "user1" } },
      organization: { id: "org1" },
    } as any);
    vi.mocked(getUser).mockResolvedValue({ id: "user1", name: "Test User" } as any);
    vi.mocked(getOrganizationsByUserId).mockResolvedValue([{ id: "org1", name: "Org One" } as any]);
    vi.mocked(getTranslate).mockResolvedValue((props: any) =>
      typeof props === "string" ? props : props.key || ""
    );

    const element = await Page({ params: { organizationId: "org1" } });
    render(element as React.ReactElement);

    expect(screen.getByTestId("landing-sidebar")).toBeInTheDocument();
    expect(screen.getByText("organizations.landing.no_projects_warning_title")).toBeInTheDocument();
    expect(screen.getByText("organizations.landing.no_projects_warning_subtitle")).toBeInTheDocument();
  });
});
