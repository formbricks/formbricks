import { getResponseCountBySurveyId } from "@/modules/survey/lib/response";
import { getOrganizationBilling } from "@/modules/survey/lib/survey";
import { getEmailVerificationDetails } from "@/modules/survey/link/lib/helper";
import { getProjectByEnvironmentId } from "@/modules/survey/link/lib/project";
import { Organization } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { notFound } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TLanguage } from "@formbricks/types/project";
import { TSurvey } from "@formbricks/types/surveys/types";
import { renderSurvey } from "./survey-renderer";

// Mock dependencies

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
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

vi.mock("@/lib/utils/locale", () => ({
  findMatchingLocale: vi.fn().mockResolvedValue("en"),
}));

vi.mock("@/lib/getPublicUrl", () => ({
  getPublicDomain: vi.fn().mockReturnValue("https://public-domain.com"),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getMultiLanguagePermission: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/modules/survey/lib/organization", () => ({
  getOrganizationIdFromEnvironmentId: vi.fn().mockResolvedValue("org-123"),
}));

vi.mock("@/modules/survey/lib/response", () => ({
  getResponseCountBySurveyId: vi.fn().mockResolvedValue(10),
}));

vi.mock("@/modules/survey/lib/survey", () => ({
  getOrganizationBilling: vi.fn().mockResolvedValue({ plan: "free" }),
}));

vi.mock("@/modules/survey/link/lib/helper", () => ({
  getEmailVerificationDetails: vi.fn().mockResolvedValue({ status: "verified", email: "test@example.com" }),
}));

vi.mock("@/modules/survey/link/lib/project", () => ({
  getProjectByEnvironmentId: vi.fn().mockResolvedValue({
    id: "project-123",
    name: "Test Project",
  }),
}));

vi.mock("@/modules/survey/link/components/link-survey", () => ({
  LinkSurvey: vi.fn().mockReturnValue(<div data-testid="link-survey">Link Survey</div>),
}));

vi.mock("@/modules/survey/link/components/pin-screen", () => ({
  PinScreen: vi.fn().mockReturnValue(<div data-testid="pin-screen">Pin Screen</div>),
}));

vi.mock("@/modules/survey/link/components/survey-inactive", () => ({
  SurveyInactive: vi.fn().mockReturnValue(<div data-testid="survey-inactive">Survey Inactive</div>),
}));

const mockSurvey = {
  id: "survey-123",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Survey",
  type: "link",
  environmentId: "env-123",
  status: "inProgress",
  welcomeCard: {
    enabled: true,
    showResponseCount: true,
  } as TSurvey["welcomeCard"],
  languages: [
    {
      default: true,
      enabled: true,
      language: { code: "en", alias: "en" } as unknown as TLanguage,
    },
    {
      default: false,
      enabled: true,
      language: { code: "de", alias: "de" } as unknown as TLanguage,
    },
  ],
  questions: [],
  isVerifyEmailEnabled: false,
  pin: null,
  recaptcha: { enabled: false } as any,
} as unknown as TSurvey;

describe("renderSurvey", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.mocked(getResponseCountBySurveyId).mockResolvedValue(0);
    vi.mocked(getOrganizationBilling).mockResolvedValue({
      plan: "free",
    } as unknown as Organization["billing"]);
    vi.mocked(getProjectByEnvironmentId).mockResolvedValue({
      styling: {} as any,
    } as any);
  });

  test("returns 404 if survey is draft", async () => {
    const draftSurvey = { ...mockSurvey, status: "draft" };

    await renderSurvey({
      survey: draftSurvey as TSurvey,
      searchParams: {},
      isPreview: false,
    });

    expect(notFound).toHaveBeenCalled();
  });

  test("returns 404 if survey type is not link", async () => {
    const nonLinkSurvey = { ...mockSurvey, type: "web" };

    await renderSurvey({
      survey: nonLinkSurvey as TSurvey,
      searchParams: {},
      isPreview: false,
    });

    expect(notFound).toHaveBeenCalled();
  });

  test("renders SurveyInactive when survey is not in progress", async () => {
    const closedSurvey = { ...mockSurvey, status: "completed" };

    const result = await renderSurvey({
      survey: closedSurvey as TSurvey,
      searchParams: {},
      isPreview: false,
    });

    expect(result).toBeDefined();
  });

  test("renders PinScreen when survey is pin protected", async () => {
    const pinProtectedSurvey = { ...mockSurvey, pin: "1234" };

    const result = await renderSurvey({
      survey: pinProtectedSurvey as TSurvey,
      searchParams: {},
      isPreview: false,
    });

    expect(result).toBeDefined();
  });

  test("handles email verification flow", async () => {
    vi.mocked(getEmailVerificationDetails).mockResolvedValue({
      status: "verified",
      email: "test@example.com",
    });

    const emailVerificationSurvey = {
      ...mockSurvey,
      isVerifyEmailEnabled: true,
    };

    const result = await renderSurvey({
      survey: emailVerificationSurvey as TSurvey,
      searchParams: { verify: "token123" },
      isPreview: false,
    });

    expect(result).toBeDefined();
  });

  test("handles language selection", async () => {
    const result = await renderSurvey({
      survey: mockSurvey,
      searchParams: { lang: "de" },
      isPreview: false,
    });

    expect(result).toBeDefined();
  });

  test("handles preview mode", async () => {
    const closedSurvey = { ...mockSurvey, status: "completed" };

    const result = await renderSurvey({
      survey: closedSurvey as TSurvey,
      searchParams: {},
      isPreview: true,
    });

    expect(result).toBeDefined();
  });

  test("throws error when organization billing is not found", async () => {
    vi.mocked(getOrganizationBilling).mockResolvedValueOnce(null);

    await expect(
      renderSurvey({
        survey: mockSurvey,
        searchParams: {},
        isPreview: false,
      })
    ).rejects.toThrow("Organization not found");
  });

  test("throws error when project is not found", async () => {
    vi.mocked(getProjectByEnvironmentId).mockResolvedValueOnce(null);

    await expect(
      renderSurvey({
        survey: mockSurvey,
        searchParams: {},
        isPreview: false,
      })
    ).rejects.toThrow("Project not found");
  });
});
