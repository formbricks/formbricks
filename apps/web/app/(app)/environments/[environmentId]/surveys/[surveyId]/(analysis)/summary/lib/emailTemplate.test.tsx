import { getPublicDomain } from "@/lib/getPublicUrl";
import { getProjectByEnvironmentId } from "@/lib/project/service";
import { getSurvey } from "@/lib/survey/service";
import { getStyling } from "@/lib/utils/styling";
import { getPreviewEmailTemplateHtml } from "@/modules/email/components/preview-email-template";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TProject } from "@formbricks/types/project";
import { TSurvey, TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { getEmailTemplateHtml } from "./emailTemplate";

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
}));

vi.mock("@/lib/getPublicUrl", () => ({
  getPublicDomain: vi.fn().mockReturnValue("https://public-domain.com"),
}));

vi.mock("@/lib/project/service");
vi.mock("@/lib/survey/service");
vi.mock("@/lib/utils/styling");
vi.mock("@/modules/email/components/preview-email-template");
vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

const mockSurveyId = "survey123";
const mockLocale = "en";
const doctype =
  '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">';

const mockSurvey = {
  id: mockSurveyId,
  name: "Test Survey",
  environmentId: "env456",
  type: "app",
  status: "inProgress",
  questions: [
    {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Question?" },
    } as unknown as TSurveyQuestion,
  ],
  styling: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  languages: [],
  triggers: [],
  recontactDays: null,
  displayOption: "displayOnce",
  displayPercentage: null,
  welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
  surveyClosedMessage: null,
  singleUse: null,
  resultShareKey: null,
  variables: [],
  segment: null,
  autoClose: null,
  delay: 0,
  autoComplete: null,
  runOnDate: null,
  closeOnDate: null,
} as unknown as TSurvey;

const mockProject = {
  id: "proj789",
  name: "Test Project",
  environments: [{ id: "env456", type: "production" } as unknown as TEnvironment],
  styling: {
    allowStyleOverwrite: true,
    brandColor: { light: "#007BFF", dark: "#007BFF" },
    highlightBorderColor: null,
    cardBackgroundColor: { light: "#FFFFFF", dark: "#000000" },
    cardBorderColor: { light: "#FFFFFF", dark: "#000000" },
    cardShadowColor: { light: "#FFFFFF", dark: "#000000" },
    questionColor: { light: "#FFFFFF", dark: "#000000" },
    inputColor: { light: "#FFFFFF", dark: "#000000" },
    inputBorderColor: { light: "#FFFFFF", dark: "#000000" },
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  linkSurveyBranding: true,
  placement: "bottomRight",
  clickOutsideClose: true,
  darkOverlay: false,
  recontactDays: 30,
  logo: null,
} as unknown as TProject;

const mockComputedStyling = {
  brandColor: "#007BFF",
  questionColor: "#000000",
  inputColor: "#000000",
  inputBorderColor: "#000000",
  cardBackgroundColor: "#FFFFFF",
  cardBorderColor: "#EEEEEE",
  cardShadowColor: "#AAAAAA",
  highlightBorderColor: null,
  thankYouCardIconColor: "#007BFF",
  thankYouCardIconBgColor: "#DDDDDD",
} as any;

const mockSurveyDomain = "https://app.formbricks.com";
const mockRawHtml = `${doctype}<html><body>Test Email Content for ${mockSurvey.name}</body></html>`;
const mockCleanedHtml = `<html><body>Test Email Content for ${mockSurvey.name}</body></html>`;

describe("getEmailTemplateHtml", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(getSurvey).mockResolvedValue(mockSurvey);
    vi.mocked(getProjectByEnvironmentId).mockResolvedValue(mockProject);
    vi.mocked(getStyling).mockReturnValue(mockComputedStyling);
    vi.mocked(getPublicDomain).mockReturnValue(mockSurveyDomain);
    vi.mocked(getPreviewEmailTemplateHtml).mockResolvedValue(mockRawHtml);
  });

  test("should return cleaned HTML when all services provide data", async () => {
    const html = await getEmailTemplateHtml(mockSurveyId, mockLocale);

    expect(html).toBe(mockCleanedHtml);
    expect(getSurvey).toHaveBeenCalledWith(mockSurveyId);
    expect(getProjectByEnvironmentId).toHaveBeenCalledWith(mockSurvey.environmentId);
    expect(getStyling).toHaveBeenCalledWith(mockProject, mockSurvey);
    expect(getPublicDomain).toHaveBeenCalledTimes(1);
    const expectedSurveyUrl = `${mockSurveyDomain}/s/${mockSurvey.id}`;
    expect(getPreviewEmailTemplateHtml).toHaveBeenCalledWith(
      mockSurvey,
      expectedSurveyUrl,
      mockComputedStyling,
      mockLocale,
      expect.any(Function)
    );
  });

  test("should throw error if survey is not found", async () => {
    vi.mocked(getSurvey).mockResolvedValue(null);
    await expect(getEmailTemplateHtml(mockSurveyId, mockLocale)).rejects.toThrow("Survey not found");
  });

  test("should throw error if project is not found", async () => {
    vi.mocked(getProjectByEnvironmentId).mockResolvedValue(null);
    await expect(getEmailTemplateHtml(mockSurveyId, mockLocale)).rejects.toThrow("Project not found");
  });
});
