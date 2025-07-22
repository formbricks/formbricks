import { ResponseFilterProvider } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { SurveyAnalysisNavigation } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyAnalysisNavigation";
import { ResponsePage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponsePage";
import Page from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/page";
import { SurveyAnalysisCTA } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SurveyAnalysisCTA";
import { getDisplayCountBySurveyId } from "@/lib/display/service";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getResponseCountBySurveyId } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { getTagsByEnvironmentId } from "@/lib/tag/service";
import { getUser } from "@/lib/user/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { TEnvironmentAuth } from "@/modules/environments/types/environment-auth";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { TUser, TUserLocale } from "@formbricks/types/user";

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyAnalysisNavigation",
  () => ({
    SurveyAnalysisNavigation: vi.fn(() => <div data-testid="survey-analysis-navigation"></div>),
  })
);

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/ResponsePage",
  () => ({
    ResponsePage: vi.fn(() => <div data-testid="response-page"></div>),
  })
);

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SurveyAnalysisCTA",
  () => ({
    SurveyAnalysisCTA: vi.fn(() => <div data-testid="survey-analysis-cta"></div>),
  })
);

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
  SESSION_MAX_AGE: 1000,
}));

vi.mock("@/lib/getPublicUrl", () => ({
  getPublicDomain: vi.fn(),
}));

vi.mock("@/lib/response/service", () => ({
  getResponseCountBySurveyId: vi.fn(),
}));

vi.mock("@/lib/display/service", () => ({
  getDisplayCountBySurveyId: vi.fn(),
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: vi.fn(),
}));

vi.mock("@/lib/tag/service", () => ({
  getTagsByEnvironmentId: vi.fn(),
}));

vi.mock("@/lib/user/service", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/lib/utils/locale", () => ({
  findMatchingLocale: vi.fn(),
}));

vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(),
}));

vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: vi.fn(({ children }) => <div data-testid="page-content-wrapper">{children}</div>),
}));

vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: vi.fn(({ pageTitle, children, cta }) => (
    <div data-testid="page-header">
      <h1 data-testid="page-title">{pageTitle}</h1>
      {cta}
      {children}
    </div>
  )),
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({
    environmentId: "test-env-id",
    surveyId: "test-survey-id",
    sharingKey: null,
  }),
}));

const mockEnvironmentId = "test-env-id";
const mockSurveyId = "test-survey-id";
const mockUserId = "test-user-id";

const mockSurvey: TSurvey = {
  id: mockSurveyId,
  name: "Test Survey",
  environmentId: mockEnvironmentId,
  status: "inProgress",
  type: "web",
  questions: [],
  thankYouCard: { enabled: false },
  endings: [],
  languages: [],
  triggers: [],
  recontactDays: null,
  displayOption: "displayOnce",
  autoClose: null,
  styling: null,
} as unknown as TSurvey;

const mockUser = {
  id: mockUserId,
  name: "Test User",
  email: "test@example.com",
  role: "project_manager",
  createdAt: new Date(),
  updatedAt: new Date(),
  locale: "en-US",
} as unknown as TUser;

const mockEnvironment = {
  id: mockEnvironmentId,
  type: "production",
  createdAt: new Date(),
  updatedAt: new Date(),
  appSetupCompleted: true,
} as unknown as TEnvironment;

const mockTags: TTag[] = [{ id: "tag1", name: "Tag 1", environmentId: mockEnvironmentId } as unknown as TTag];
const mockLocale: TUserLocale = "en-US";
const mockPublicDomain = "http://customdomain.com";

const mockParams = {
  environmentId: mockEnvironmentId,
  surveyId: mockSurveyId,
};

describe("ResponsesPage", () => {
  beforeEach(() => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      session: { user: { id: mockUserId } } as any,
      environment: mockEnvironment,
      isReadOnly: false,
    } as TEnvironmentAuth);
    vi.mocked(getSurvey).mockResolvedValue(mockSurvey);
    vi.mocked(getUser).mockResolvedValue(mockUser);
    vi.mocked(getTagsByEnvironmentId).mockResolvedValue(mockTags);
    vi.mocked(getResponseCountBySurveyId).mockResolvedValue(10);
    vi.mocked(getDisplayCountBySurveyId).mockResolvedValue(5);
    vi.mocked(findMatchingLocale).mockResolvedValue(mockLocale);
    vi.mocked(getPublicDomain).mockReturnValue(mockPublicDomain);
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  test("renders correctly with all data", async () => {
    const props = { params: mockParams };
    const jsx = await Page(props);
    render(<ResponseFilterProvider>{jsx}</ResponseFilterProvider>);

    await screen.findByTestId("page-content-wrapper");
    expect(screen.getByTestId("page-header")).toBeInTheDocument();
    expect(screen.getByTestId("page-title")).toHaveTextContent(mockSurvey.name);
    expect(screen.getByTestId("survey-analysis-cta")).toBeInTheDocument();
    expect(screen.getByTestId("survey-analysis-navigation")).toBeInTheDocument();
    expect(screen.getByTestId("response-page")).toBeInTheDocument();

    expect(vi.mocked(SurveyAnalysisCTA)).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: mockEnvironment,
        survey: mockSurvey,
        isReadOnly: false,
        user: mockUser,
        publicDomain: mockPublicDomain,
        responseCount: 10,
        displayCount: 5,
      }),
      undefined
    );

    expect(vi.mocked(SurveyAnalysisNavigation)).toHaveBeenCalledWith(
      expect.objectContaining({
        environmentId: mockEnvironmentId,
        survey: mockSurvey,
        activeId: "responses",
      }),
      undefined
    );

    expect(vi.mocked(ResponsePage)).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: mockEnvironment,
        survey: mockSurvey,
        surveyId: mockSurveyId,
        publicDomain: mockPublicDomain,
        environmentTags: mockTags,
        user: mockUser,
        responsesPerPage: 10,
        locale: mockLocale,
        isReadOnly: false,
      }),
      undefined
    );
  });

  test("throws error if survey not found", async () => {
    vi.mocked(getSurvey).mockResolvedValue(null);
    const props = { params: mockParams };
    await expect(Page(props)).rejects.toThrow("common.survey_not_found");
  });

  test("throws error if user not found", async () => {
    vi.mocked(getUser).mockResolvedValue(null);
    const props = { params: mockParams };
    await expect(Page(props)).rejects.toThrow("common.user_not_found");
  });
});
