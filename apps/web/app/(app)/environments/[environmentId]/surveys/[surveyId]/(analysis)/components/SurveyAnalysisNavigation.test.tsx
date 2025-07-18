import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import {
  getResponseCountAction,
  revalidateSurveyIdPath,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { SurveyAnalysisNavigation } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/components/SurveyAnalysisNavigation";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TLanguage } from "@formbricks/types/project";
import {
  TSurvey,
  TSurveyLanguage,
  TSurveyQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";

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
  FB_LOGO_URL: "mock-fb-logo-url",
  SMTP_HOST: "mock-smtp-host",
  SMTP_PORT: 587,
  SMTP_USER: "mock-smtp-user",
  SMTP_PASSWORD: "mock-smtp-password",
  SESSION_MAX_AGE: 1000,
  REDIS_URL: undefined,
  AUDIT_LOG_ENABLED: true,
}));

vi.mock("@/lib/env", () => ({
  env: {
    PUBLIC_URL: "https://public-domain.com",
  },
}));

vi.mock("@/app/(app)/environments/[environmentId]/components/ResponseFilterContext");
vi.mock("@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions");
vi.mock("@/app/lib/surveys/surveys");
vi.mock("@/app/share/[sharingKey]/actions");
vi.mock("@/modules/ui/components/secondary-navigation", () => ({
  SecondaryNavigation: vi.fn(() => <div data-testid="secondary-navigation" />),
}));
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useParams: vi.fn(),
  useSearchParams: vi.fn(),
}));

const mockUsePathname = vi.mocked(usePathname);
const mockUseParams = vi.mocked(useParams);
const mockUseSearchParams = vi.mocked(useSearchParams);
const mockUseResponseFilter = vi.mocked(useResponseFilter);
const mockGetResponseCountAction = vi.mocked(getResponseCountAction);
const mockRevalidateSurveyIdPath = vi.mocked(revalidateSurveyIdPath);
const mockGetFormattedFilters = vi.mocked(getFormattedFilters);
const MockSecondaryNavigation = vi.mocked(SecondaryNavigation);

const mockSurveyLanguages: TSurveyLanguage[] = [
  { language: { code: "en-US" } as unknown as TLanguage, default: true, enabled: true },
];

const mockSurvey = {
  id: "surveyId123",
  name: "Test Survey",
  type: "app",
  environmentId: "envId123",
  status: "inProgress",
  questions: [
    {
      id: "question1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Question 1" },
      required: false,
      logic: [],
      isDraft: false,
      imageUrl: "",
      subheader: { default: "" },
    } as unknown as TSurveyQuestion,
  ],
  hiddenFields: { enabled: false, fieldIds: [] },
  displayOption: "displayOnce",
  autoClose: null,
  triggers: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  languages: mockSurveyLanguages,
  variables: [],
  singleUse: null,
  styling: null,
  surveyClosedMessage: null,
  welcomeCard: { enabled: false, headline: { default: "" } } as unknown as TSurvey["welcomeCard"],
  segment: null,
  resultShareKey: null,
  closeOnDate: null,
  delay: 0,
  autoComplete: null,
  recontactDays: null,
  runOnDate: null,
  displayPercentage: null,
  createdBy: null,
} as unknown as TSurvey;

const defaultProps = {
  environmentId: "testEnvId",
  survey: mockSurvey,
  activeId: "summary",
};

describe("SurveyAnalysisNavigation", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  test("calls revalidateSurveyIdPath on navigation item click", async () => {
    mockUsePathname.mockReturnValue(
      `/environments/${defaultProps.environmentId}/surveys/${mockSurvey.id}/summary`
    );
    mockUseParams.mockReturnValue({ environmentId: defaultProps.environmentId, surveyId: mockSurvey.id });
    mockUseSearchParams.mockReturnValue({ get: vi.fn().mockReturnValue(null) } as any);
    mockUseResponseFilter.mockReturnValue({ selectedFilter: "all", dateRange: {} } as any);
    mockGetFormattedFilters.mockReturnValue([] as any);
    mockGetResponseCountAction.mockResolvedValue({ data: 5 });

    render(<SurveyAnalysisNavigation {...defaultProps} />);
    await waitFor(() => expect(MockSecondaryNavigation).toHaveBeenCalled());

    const lastCallArgs = MockSecondaryNavigation.mock.calls[MockSecondaryNavigation.mock.calls.length - 1][0];

    if (!lastCallArgs.navigation || lastCallArgs.navigation.length < 2) {
      throw new Error("Navigation items not found");
    }

    act(() => {
      (lastCallArgs.navigation[0] as any).onClick();
    });
    expect(mockRevalidateSurveyIdPath).toHaveBeenCalledWith(
      defaultProps.environmentId,
      defaultProps.survey.id
    );
    vi.mocked(mockRevalidateSurveyIdPath).mockClear();

    act(() => {
      (lastCallArgs.navigation[1] as any).onClick();
    });
    expect(mockRevalidateSurveyIdPath).toHaveBeenCalledWith(
      defaultProps.environmentId,
      defaultProps.survey.id
    );
  });

  test("renders navigation correctly for sharing page", () => {
    mockUsePathname.mockReturnValue(
      `/environments/${defaultProps.environmentId}/surveys/${mockSurvey.id}/summary`
    );
    mockUseParams.mockReturnValue({ sharingKey: "test-sharing-key" });
    mockUseResponseFilter.mockReturnValue({ selectedFilter: "all", dateRange: {} } as any);
    mockGetFormattedFilters.mockReturnValue([] as any);
    mockGetResponseCountAction.mockResolvedValue({ data: 5 });

    render(<SurveyAnalysisNavigation {...defaultProps} />);

    expect(MockSecondaryNavigation).toHaveBeenCalled();
    const lastCallArgs = MockSecondaryNavigation.mock.calls[MockSecondaryNavigation.mock.calls.length - 1][0];
    expect(lastCallArgs.navigation[0].href).toContain("/share/test-sharing-key");
  });

  test("displays correct response count string in label for various scenarios", async () => {
    mockUsePathname.mockReturnValue(
      `/environments/${defaultProps.environmentId}/surveys/${mockSurvey.id}/responses`
    );
    mockUseParams.mockReturnValue({ environmentId: defaultProps.environmentId, surveyId: mockSurvey.id });
    mockUseSearchParams.mockReturnValue({ get: vi.fn().mockReturnValue(null) } as any);
    mockUseResponseFilter.mockReturnValue({ selectedFilter: "all", dateRange: {} } as any);
    mockGetFormattedFilters.mockReturnValue([] as any);

    // Scenario 1: total = 10, filtered = null (initial state)
    render(<SurveyAnalysisNavigation {...defaultProps} />);
    expect(MockSecondaryNavigation.mock.calls[0][0].navigation[1].label).toBe("common.responses");
    cleanup();
    vi.resetAllMocks(); // Reset mocks for next case

    // Scenario 2: total = 15, filtered = 15
    mockUsePathname.mockReturnValue(
      `/environments/${defaultProps.environmentId}/surveys/${mockSurvey.id}/responses`
    );
    mockUseParams.mockReturnValue({ environmentId: defaultProps.environmentId, surveyId: mockSurvey.id });
    mockUseSearchParams.mockReturnValue({ get: vi.fn().mockReturnValue(null) } as any);
    mockUseResponseFilter.mockReturnValue({ selectedFilter: "all", dateRange: {} } as any);
    mockGetFormattedFilters.mockReturnValue([] as any);
    mockGetResponseCountAction.mockImplementation(async (args) => {
      if (args && "filterCriteria" in args) return { data: 15, error: null, success: true };
      return { data: 15, error: null, success: true };
    });
    render(<SurveyAnalysisNavigation {...defaultProps} />);
    await waitFor(() => {
      const lastCallArgs =
        MockSecondaryNavigation.mock.calls[MockSecondaryNavigation.mock.calls.length - 1][0];
      expect(lastCallArgs.navigation[1].label).toBe("common.responses");
    });
    cleanup();
    vi.resetAllMocks();

    // Scenario 3: total = 10, filtered = 15 (filtered > total)
    mockUsePathname.mockReturnValue(
      `/environments/${defaultProps.environmentId}/surveys/${mockSurvey.id}/responses`
    );
    mockUseParams.mockReturnValue({ environmentId: defaultProps.environmentId, surveyId: mockSurvey.id });
    mockUseSearchParams.mockReturnValue({ get: vi.fn().mockReturnValue(null) } as any);
    mockUseResponseFilter.mockReturnValue({ selectedFilter: "all", dateRange: {} } as any);
    mockGetFormattedFilters.mockReturnValue([] as any);
    mockGetResponseCountAction.mockImplementation(async (args) => {
      if (args && "filterCriteria" in args) return { data: 15, error: null, success: true };
      return { data: 10, error: null, success: true };
    });
    render(<SurveyAnalysisNavigation {...defaultProps} />);
    await waitFor(() => {
      const lastCallArgs =
        MockSecondaryNavigation.mock.calls[MockSecondaryNavigation.mock.calls.length - 1][0];
      expect(lastCallArgs.navigation[1].label).toBe("common.responses");
    });
  });
});
