import { getSurveys } from "@/app/(app)/environments/[environmentId]/integrations/lib/surveys";
import { SlackWrapper } from "@/app/(app)/environments/[environmentId]/integrations/slack/components/SlackWrapper";
import Page from "@/app/(app)/environments/[environmentId]/integrations/slack/page";
import { getIntegrationByType } from "@/lib/integration/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { TEnvironmentAuth } from "@/modules/environments/types/environment-auth";
import { cleanup, render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationSlack, TIntegrationSlackCredential } from "@formbricks/types/integration/slack";
import { TSurvey } from "@formbricks/types/surveys/types";

// Mock dependencies
vi.mock("@/app/(app)/environments/[environmentId]/integrations/lib/surveys", () => ({
  getSurveys: vi.fn(),
}));

vi.mock("@/app/(app)/environments/[environmentId]/integrations/slack/components/SlackWrapper", () => ({
  SlackWrapper: vi.fn(({ isEnabled, environment, surveys, slackIntegration, webAppUrl, locale }) => (
    <div data-testid="slack-wrapper">
      Mock SlackWrapper: isEnabled={isEnabled.toString()}, envId={environment.id}, surveys=
      {surveys.length}, integrationId={slackIntegration?.id}, webAppUrl={webAppUrl}, locale={locale}
    </div>
  )),
}));

vi.mock("@/lib/constants", () => ({
  IS_PRODUCTION: true,
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
  SENTRY_DSN: "mock-sentry-dsn",
  SLACK_CLIENT_ID: "test-slack-client-id",
  SLACK_CLIENT_SECRET: "test-slack-client-secret",
  WEBAPP_URL: "http://test.formbricks.com",
}));

vi.mock("@/lib/integration/service", () => ({
  getIntegrationByType: vi.fn(),
}));

vi.mock("@/lib/utils/locale", () => ({
  findMatchingLocale: vi.fn(),
}));

vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(),
}));

vi.mock("@/modules/ui/components/go-back-button", () => ({
  GoBackButton: vi.fn(({ url }) => <div data-testid="go-back-button">Go Back: {url}</div>),
}));

vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: vi.fn(({ children }) => <div>{children}</div>),
}));

vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: vi.fn(({ pageTitle }) => <h1 data-testid="page-header">{pageTitle}</h1>),
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Mock data
const environmentId = "test-env-id";
const mockEnvironment = {
  id: environmentId,
  createdAt: new Date(),
  type: "development",
} as unknown as TEnvironment;
const mockSurveys: TSurvey[] = [
  {
    id: "survey1",
    name: "Survey 1",
    createdAt: new Date(),
    updatedAt: new Date(),
    environmentId: environmentId,
    status: "inProgress",
    type: "link",
    questions: [],
    triggers: [],
    recontactDays: null,
    displayOption: "displayOnce",
    autoClose: null,
    delay: 0,
    autoComplete: null,
    surveyClosedMessage: null,
    singleUse: null,
    welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
    hiddenFields: { enabled: false },
    languages: [],
    styling: null,
    segment: null,
    displayPercentage: null,
    closeOnDate: null,
    runOnDate: null,
  } as unknown as TSurvey,
];
const mockSlackIntegration = {
  id: "slack-int-id",
  type: "slack",
  config: {
    data: [],
    key: "test-key" as unknown as TIntegrationSlackCredential,
  },
} as unknown as TIntegrationSlack;
const mockLocale = "en-US";
const mockParams = { params: { environmentId } };

describe("SlackIntegrationPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.mocked(getSurveys).mockResolvedValue(mockSurveys);
    vi.mocked(getIntegrationByType).mockResolvedValue(mockSlackIntegration);
    vi.mocked(findMatchingLocale).mockResolvedValue(mockLocale);
  });

  test("renders correctly when user is not read-only", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      isReadOnly: false,
      environment: mockEnvironment,
    } as unknown as TEnvironmentAuth);

    const tree = await Page(mockParams);
    render(tree);

    expect(screen.getByTestId("page-header")).toHaveTextContent(
      "environments.integrations.slack.slack_integration"
    );
    expect(screen.getByTestId("go-back-button")).toHaveTextContent(
      `Go Back: http://test.formbricks.com/environments/${environmentId}/integrations`
    );
    expect(screen.getByTestId("slack-wrapper")).toBeInTheDocument();

    // Check props passed to SlackWrapper
    expect(vi.mocked(SlackWrapper)).toHaveBeenCalledWith(
      {
        isEnabled: true, // Since SLACK_CLIENT_ID and SLACK_CLIENT_SECRET are mocked
        environment: mockEnvironment,
        surveys: mockSurveys,
        slackIntegration: mockSlackIntegration,
        webAppUrl: "http://test.formbricks.com",
        locale: mockLocale,
      },
      undefined
    );

    expect(vi.mocked(redirect)).not.toHaveBeenCalled();
  });

  test("redirects when user is read-only", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      isReadOnly: true,
      environment: mockEnvironment,
    } as unknown as TEnvironmentAuth);

    // Need to actually call the component function to trigger the redirect logic
    await Page(mockParams);

    expect(vi.mocked(redirect)).toHaveBeenCalledWith("./");
    expect(vi.mocked(SlackWrapper)).not.toHaveBeenCalled();
  });

  test("renders correctly when Slack integration is not configured", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      isReadOnly: false,
      environment: mockEnvironment,
    } as unknown as TEnvironmentAuth);
    vi.mocked(getIntegrationByType).mockResolvedValue(null); // Simulate no integration found

    const tree = await Page(mockParams);
    render(tree);

    expect(screen.getByTestId("page-header")).toHaveTextContent(
      "environments.integrations.slack.slack_integration"
    );
    expect(screen.getByTestId("slack-wrapper")).toBeInTheDocument();

    // Check props passed to SlackWrapper when integration is null
    expect(vi.mocked(SlackWrapper)).toHaveBeenCalledWith(
      {
        isEnabled: true,
        environment: mockEnvironment,
        surveys: mockSurveys,
        slackIntegration: null, // Expecting null here
        webAppUrl: "http://test.formbricks.com",
        locale: mockLocale,
      },
      undefined
    );

    expect(vi.mocked(redirect)).not.toHaveBeenCalled();
  });
});
