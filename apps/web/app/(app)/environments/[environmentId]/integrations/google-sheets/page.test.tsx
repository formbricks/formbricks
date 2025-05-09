import Page from "@/app/(app)/environments/[environmentId]/integrations/google-sheets/page";
import { getSurveys } from "@/app/(app)/environments/[environmentId]/integrations/lib/surveys";
import { getIntegrations } from "@/lib/integration/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { TEnvironmentAuth } from "@/modules/environments/types/environment-auth";
import { cleanup, render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import {
  TIntegrationGoogleSheets,
  TIntegrationGoogleSheetsCredential,
} from "@formbricks/types/integration/google-sheet";
import { TSurvey } from "@formbricks/types/surveys/types";

// Mock dependencies
vi.mock(
  "@/app/(app)/environments/[environmentId]/integrations/google-sheets/components/GoogleSheetWrapper",
  () => ({
    GoogleSheetWrapper: vi.fn(
      ({ isEnabled, environment, surveys, googleSheetIntegration, webAppUrl, locale }) => (
        <div>
          <span>Mocked GoogleSheetWrapper</span>
          <span data-testid="isEnabled">{isEnabled.toString()}</span>
          <span data-testid="environmentId">{environment.id}</span>
          <span data-testid="surveyCount">{surveys?.length ?? 0}</span>
          <span data-testid="integrationId">{googleSheetIntegration?.id}</span>
          <span data-testid="webAppUrl">{webAppUrl}</span>
          <span data-testid="locale">{locale}</span>
        </div>
      )
    ),
  })
);
vi.mock("@/app/(app)/environments/[environmentId]/integrations/lib/surveys", () => ({
  getSurveys: vi.fn(),
}));

let mockGoogleSheetClientId: string | undefined = "test-client-id";

vi.mock("@/lib/constants", () => ({
  get GOOGLE_SHEETS_CLIENT_ID() {
    return mockGoogleSheetClientId;
  },
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
  GOOGLE_SHEETS_CLIENT_SECRET: "test-client-secret",
  GOOGLE_SHEETS_REDIRECT_URL: "test-redirect-url",
}));
vi.mock("@/lib/integration/service", () => ({
  getIntegrations: vi.fn(),
}));
vi.mock("@/lib/utils/locale", () => ({
  findMatchingLocale: vi.fn(),
}));
vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(),
}));
vi.mock("@/modules/ui/components/go-back-button", () => ({
  GoBackButton: vi.fn(({ url }) => <div data-testid="go-back">{url}</div>),
}));
vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: vi.fn(({ children }) => <div>{children}</div>),
}));
vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: vi.fn(({ pageTitle }) => <h1>{pageTitle}</h1>),
}));
vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

const mockEnvironment = {
  id: "test-env-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  appSetupCompleted: false,
  type: "development",
} as unknown as TEnvironment;

const mockSurveys: TSurvey[] = [
  {
    id: "survey1",
    name: "Survey 1",
    createdAt: new Date(),
    updatedAt: new Date(),
    environmentId: "test-env-id",
    status: "inProgress",
    type: "app",
    questions: [],
    triggers: [],
    recontactDays: null,
    autoClose: null,
    closeOnDate: null,
    delay: 0,
    displayOption: "displayOnce",
    displayPercentage: null,
    languages: [],
    pin: null,
    resultShareKey: null,
    segment: null,
    singleUse: null,
    styling: null,
    surveyClosedMessage: null,
    welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
    autoComplete: null,
    runOnDate: null,
  } as unknown as TSurvey,
];

const mockGoogleSheetIntegration = {
  id: "integration1",
  type: "googleSheets",
  config: {
    data: [],
    key: {
      refresh_token: "refresh",
      access_token: "access",
      expiry_date: Date.now() + 3600000,
    } as unknown as TIntegrationGoogleSheetsCredential,
    email: "test@example.com",
  },
} as unknown as TIntegrationGoogleSheets;

const mockProps = {
  params: { environmentId: "test-env-id" },
};

describe("GoogleSheetsIntegrationPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      environment: mockEnvironment,
      isReadOnly: false,
    } as TEnvironmentAuth);
    vi.mocked(getSurveys).mockResolvedValue(mockSurveys);
    vi.mocked(getIntegrations).mockResolvedValue([mockGoogleSheetIntegration]);
    vi.mocked(findMatchingLocale).mockResolvedValue("en-US");
  });

  test("renders the page with GoogleSheetWrapper when enabled and not read-only", async () => {
    const PageComponent = await Page(mockProps);
    render(PageComponent);

    expect(
      screen.getByText("environments.integrations.google_sheets.google_sheets_integration")
    ).toBeInTheDocument();
    expect(screen.getByText("Mocked GoogleSheetWrapper")).toBeInTheDocument();
    expect(screen.getByTestId("isEnabled")).toHaveTextContent("true");
    expect(screen.getByTestId("environmentId")).toHaveTextContent(mockEnvironment.id);
    expect(screen.getByTestId("surveyCount")).toHaveTextContent(mockSurveys.length.toString());
    expect(screen.getByTestId("integrationId")).toHaveTextContent(mockGoogleSheetIntegration.id);
    expect(screen.getByTestId("webAppUrl")).toHaveTextContent("test-webapp-url");
    expect(screen.getByTestId("locale")).toHaveTextContent("en-US");
    expect(screen.getByTestId("go-back")).toHaveTextContent(
      `test-webapp-url/environments/${mockProps.params.environmentId}/integrations`
    );
    expect(vi.mocked(redirect)).not.toHaveBeenCalled();
  });

  test("calls redirect when user is read-only", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      environment: mockEnvironment,
      isReadOnly: true,
    } as TEnvironmentAuth);

    const PageComponent = await Page(mockProps);
    render(PageComponent);

    expect(vi.mocked(redirect)).toHaveBeenCalledWith("./");
  });

  test("passes isEnabled=false to GoogleSheetWrapper when constants are missing", async () => {
    mockGoogleSheetClientId = undefined;

    const { default: PageWithMissingConstants } = (await import(
      "@/app/(app)/environments/[environmentId]/integrations/google-sheets/page"
    )) as { default: typeof Page };
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      environment: mockEnvironment,
      isReadOnly: false,
    } as TEnvironmentAuth);
    vi.mocked(getSurveys).mockResolvedValue(mockSurveys);
    vi.mocked(getIntegrations).mockResolvedValue([mockGoogleSheetIntegration]);
    vi.mocked(findMatchingLocale).mockResolvedValue("en-US");

    const PageComponent = await PageWithMissingConstants(mockProps);
    render(PageComponent);

    expect(screen.getByTestId("isEnabled")).toHaveTextContent("false");
  });

  test("handles case where no Google Sheet integration exists", async () => {
    vi.mocked(getIntegrations).mockResolvedValue([]); // No integrations

    const PageComponent = await Page(mockProps);
    render(PageComponent);

    expect(screen.getByText("Mocked GoogleSheetWrapper")).toBeInTheDocument();
    expect(screen.getByTestId("integrationId")).toBeEmptyDOMElement(); // No integration ID passed
  });
});
