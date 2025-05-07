import { SurveyAnalysisNavigation } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyAnalysisNavigation";
import { SummaryPage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryPage";
import SurveyPage from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/page";
import { DEFAULT_LOCALE, DOCUMENTS_PER_PAGE, WEBAPP_URL } from "@/lib/constants";
import { getSurveyDomain } from "@/lib/getSurveyUrl";
import { getResponseCountBySurveyId } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { getUser } from "@/lib/user/service";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { TEnvironmentAuth } from "@/modules/environments/types/environment-auth";
import { cleanup, render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";

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
  IS_PRODUCTION: false,
  SENTRY_DSN: "mock-sentry-dsn",
  WEBAPP_URL: "http://localhost:3000",
  RESPONSES_PER_PAGE: 10,
  DOCUMENTS_PER_PAGE: 10,
}));

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyAnalysisNavigation",
  () => ({
    SurveyAnalysisNavigation: vi.fn(() => <div data-testid="survey-analysis-navigation"></div>),
  })
);

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SummaryPage",
  () => ({
    SummaryPage: vi.fn(() => <div data-testid="summary-page"></div>),
  })
);

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SurveyAnalysisCTA",
  () => ({
    SurveyAnalysisCTA: vi.fn(() => <div data-testid="survey-analysis-cta"></div>),
  })
);

vi.mock("@/lib/getSurveyUrl", () => ({
  getSurveyDomain: vi.fn(),
}));

vi.mock("@/lib/response/service", () => ({
  getResponseCountBySurveyId: vi.fn(),
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: vi.fn(),
}));

vi.mock("@/lib/user/service", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(),
}));

vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: vi.fn(({ children }) => <div data-testid="page-content-wrapper">{children}</div>),
}));

vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: vi.fn(({ children }) => <div data-testid="page-header">{children}</div>),
}));

vi.mock("@/modules/ui/components/settings-id", () => ({
  SettingsId: vi.fn(() => <div data-testid="settings-id"></div>),
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

const mockEnvironmentId = "test-environment-id";
const mockSurveyId = "test-survey-id";
const mockUserId = "test-user-id";

const mockEnvironment = {
  id: mockEnvironmentId,
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "development",
  appSetupCompleted: false,
} as unknown as TEnvironment;

const mockSurvey = {
  id: mockSurveyId,
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Survey",
  type: "app",
  environmentId: mockEnvironmentId,
  status: "draft",
  questions: [],
  displayOption: "displayOnce",
  autoClose: null,
  triggers: [],
  welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
  autoComplete: null,
  closeOnDate: null,
  delay: 0,
  displayPercentage: null,
  languages: [],
  resultShareKey: null,
  runOnDate: null,
  singleUse: null,
  surveyClosedMessage: null,
  segment: null,
  styling: null,
  variables: [],
  hiddenFields: { enabled: true, fieldIds: [] },
} as unknown as TSurvey;

const mockUser = {
  id: mockUserId,
  name: "Test User",
  email: "test@example.com",
  emailVerified: new Date(),
  imageUrl: "",
  twoFactorEnabled: false,
  identityProvider: "email",
  createdAt: new Date(),
  updatedAt: new Date(),
  onboardingCompleted: true,
  role: "project_manager",
  locale: "en-US",
  objective: "other",
} as unknown as TUser;

const mockSession = {
  user: {
    id: mockUserId,
    name: mockUser.name,
    email: mockUser.email,
    image: mockUser.imageUrl,
    role: mockUser.role,
    plan: "free",
    status: "active",
    objective: "other",
  },
  expires: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour from now
} as any;

describe("SurveyPage", () => {
  beforeEach(() => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      session: mockSession,
      environment: mockEnvironment,
      isReadOnly: false,
    } as unknown as TEnvironmentAuth);
    vi.mocked(getSurvey).mockResolvedValue(mockSurvey);
    vi.mocked(getUser).mockResolvedValue(mockUser);
    vi.mocked(getResponseCountBySurveyId).mockResolvedValue(10);
    vi.mocked(getSurveyDomain).mockReturnValue("test.domain.com");
    vi.mocked(notFound).mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  test("renders correctly with valid data", async () => {
    const params = Promise.resolve({ environmentId: mockEnvironmentId, surveyId: mockSurveyId });
    render(await SurveyPage({ params }));

    expect(screen.getByTestId("page-content-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("page-header")).toBeInTheDocument();
    expect(screen.getByTestId("survey-analysis-navigation")).toBeInTheDocument();
    expect(screen.getByTestId("summary-page")).toBeInTheDocument();
    expect(screen.getByTestId("settings-id")).toBeInTheDocument();

    expect(vi.mocked(getEnvironmentAuth)).toHaveBeenCalledWith(mockEnvironmentId);
    expect(vi.mocked(getSurvey)).toHaveBeenCalledWith(mockSurveyId);
    expect(vi.mocked(getUser)).toHaveBeenCalledWith(mockUserId);
    expect(vi.mocked(getResponseCountBySurveyId)).toHaveBeenCalledWith(mockSurveyId);
    expect(vi.mocked(getSurveyDomain)).toHaveBeenCalled();

    expect(vi.mocked(SurveyAnalysisNavigation).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        environmentId: mockEnvironmentId,
        survey: mockSurvey,
        activeId: "summary",
        initialTotalResponseCount: 10,
      })
    );

    expect(vi.mocked(SummaryPage).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        environment: mockEnvironment,
        survey: mockSurvey,
        surveyId: mockSurveyId,
        webAppUrl: WEBAPP_URL,
        user: mockUser,
        totalResponseCount: 10,
        documentsPerPage: DOCUMENTS_PER_PAGE,
        isReadOnly: false,
        locale: mockUser.locale ?? DEFAULT_LOCALE,
      })
    );
  });

  test("calls notFound if surveyId is not present in params", async () => {
    const params = Promise.resolve({ environmentId: mockEnvironmentId, surveyId: undefined }) as any;
    render(await SurveyPage({ params }));
    expect(vi.mocked(notFound)).toHaveBeenCalled();
  });

  test("throws error if survey is not found", async () => {
    vi.mocked(getSurvey).mockResolvedValue(null);
    const params = Promise.resolve({ environmentId: mockEnvironmentId, surveyId: mockSurveyId });
    try {
      // We need to await the component itself because it's an async component
      const SurveyPageComponent = await SurveyPage({ params });
      render(SurveyPageComponent);
    } catch (e: any) {
      expect(e.message).toBe("common.survey_not_found");
    }
    // Ensure notFound was not called for this specific error
    expect(vi.mocked(notFound)).not.toHaveBeenCalled();
  });

  test("throws error if user is not found", async () => {
    vi.mocked(getUser).mockResolvedValue(null);
    const params = Promise.resolve({ environmentId: mockEnvironmentId, surveyId: mockSurveyId });
    try {
      const SurveyPageComponent = await SurveyPage({ params });
      render(SurveyPageComponent);
    } catch (e: any) {
      expect(e.message).toBe("common.user_not_found");
    }
    expect(vi.mocked(notFound)).not.toHaveBeenCalled();
  });
});
