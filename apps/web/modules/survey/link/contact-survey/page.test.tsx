import { verifyContactSurveyToken } from "@/modules/ee/contacts/lib/contact-survey-link";
import { getSurvey } from "@/modules/survey/lib/survey";
import { renderSurvey } from "@/modules/survey/link/components/survey-renderer";
import { getExistingContactResponse } from "@/modules/survey/link/lib/data";
import { getBasicSurveyMetadata } from "@/modules/survey/link/lib/metadata-utils";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ContactSurveyPage, generateMetadata } from "./page";

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
}));

vi.mock("@/lib/env", () => ({
  env: {
    PUBLIC_URL: "https://public-domain.com",
  },
}));

vi.mock("@/modules/ee/contacts/lib/contact-survey-link");
vi.mock("@/modules/survey/link/lib/metadata-utils");
vi.mock("@/modules/survey/link/lib/data", () => ({
  getExistingContactResponse: vi.fn(() => vi.fn()),
}));
vi.mock("@/modules/survey/lib/survey");
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));
vi.mock("@/modules/survey/link/components/survey-inactive", () => ({
  SurveyInactive: ({ status }: { status: string }) => <div>{status}</div>,
}));
vi.mock("@/modules/survey/link/components/survey-renderer", () => ({
  renderSurvey: vi.fn(() => <div>Rendered Survey</div>),
}));

describe("contact-survey page", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  test("generateMetadata returns default when token invalid", async () => {
    vi.mocked(verifyContactSurveyToken).mockReturnValue({ ok: false } as any);
    const meta = await generateMetadata({
      params: Promise.resolve({ jwt: "token" }),
      searchParams: Promise.resolve({}),
    });
    expect(meta).toEqual({ title: "Survey", description: "Complete this survey" });
  });

  test("generateMetadata returns default when verify throws", async () => {
    vi.mocked(verifyContactSurveyToken).mockImplementation(() => {
      throw new Error("boom");
    });
    const meta = await generateMetadata({
      params: Promise.resolve({ jwt: "token" }),
      searchParams: Promise.resolve({}),
    });
    expect(meta).toEqual({ title: "Survey", description: "Complete this survey" });
  });

  test("generateMetadata returns basic metadata when token valid", async () => {
    vi.mocked(verifyContactSurveyToken).mockReturnValue({ ok: true, data: { surveyId: "123" } } as any);
    vi.mocked(getBasicSurveyMetadata).mockResolvedValue({ title: "T", description: "D" } as any);
    const meta = await generateMetadata({
      params: Promise.resolve({ jwt: "token" }),
      searchParams: Promise.resolve({}),
    });
    expect(meta).toEqual({ title: "T", description: "D" });
  });

  test("ContactSurveyPage shows link invalid when token invalid", async () => {
    vi.mocked(verifyContactSurveyToken).mockReturnValue({ ok: false } as any);
    render(
      await ContactSurveyPage({
        params: Promise.resolve({ jwt: "tk" }),
        searchParams: Promise.resolve({}),
      })
    );
    expect(screen.getByText("link invalid")).toBeInTheDocument();
  });

  test("ContactSurveyPage shows response submitted when existing response", async () => {
    vi.mocked(verifyContactSurveyToken).mockReturnValue({
      ok: true,
      data: { surveyId: "s", contactId: "c" },
    });
    vi.mocked(getExistingContactResponse).mockReturnValue(() => Promise.resolve({ any: "x" } as any));
    render(
      await ContactSurveyPage({
        params: Promise.resolve({ jwt: "tk" }),
        searchParams: Promise.resolve({}),
      })
    );
    expect(screen.getByText("response submitted")).toBeInTheDocument();
  });

  test("ContactSurveyPage throws notFound when survey missing", async () => {
    vi.mocked(verifyContactSurveyToken).mockReturnValue({
      ok: true,
      data: { surveyId: "s", contactId: "c" },
    });
    vi.mocked(getExistingContactResponse).mockReturnValue(() => Promise.resolve(null));
    vi.mocked(getSurvey).mockResolvedValue(null as any);
    await expect(
      ContactSurveyPage({
        params: Promise.resolve({ jwt: "tk" }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow("notFound");
  });

  test("ContactSurveyPage renders survey when valid", async () => {
    vi.mocked(verifyContactSurveyToken).mockReturnValue({
      ok: true,
      data: { surveyId: "s", contactId: "c" },
    });
    vi.mocked(getExistingContactResponse).mockReturnValue(() => Promise.resolve(null));
    vi.mocked(getSurvey).mockResolvedValue({ id: "s" } as any);
    const node = await ContactSurveyPage({
      params: Promise.resolve({ jwt: "tk" }),
      searchParams: Promise.resolve({ preview: "true" }),
    });
    render(node);
    expect(renderSurvey).toHaveBeenCalledWith({
      survey: { id: "s" },
      searchParams: { preview: "true" },
      contactId: "c",
      isPreview: true,
    });
    expect(screen.getByText("Rendered Survey")).toBeInTheDocument();
  });
});
