import { getSurveys } from "@/app/(app)/environments/[environmentId]/integrations/lib/surveys";
import Page from "@/app/(app)/environments/[environmentId]/integrations/notion/page";
import { getIntegrationByType } from "@/lib/integration/service";
import { getNotionDatabases } from "@/lib/notion/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { TEnvironmentAuth } from "@/modules/environments/types/environment-auth";
import { cleanup, render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationNotion, TIntegrationNotionDatabase } from "@formbricks/types/integration/notion";
import { TSurvey } from "@formbricks/types/surveys/types";

// Mock dependencies
vi.mock("@/app/(app)/environments/[environmentId]/integrations/notion/components/NotionWrapper", () => ({
  NotionWrapper: vi.fn(
    ({ enabled, environment, surveys, notionIntegration, webAppUrl, databasesArray, locale }) => (
      <div>
        <span>Mocked NotionWrapper</span>
        <span data-testid="enabled">{enabled.toString()}</span>
        <span data-testid="environmentId">{environment.id}</span>
        <span data-testid="surveyCount">{surveys?.length ?? 0}</span>
        <span data-testid="integrationId">{notionIntegration?.id}</span>
        <span data-testid="webAppUrl">{webAppUrl}</span>
        <span data-testid="databaseCount">{databasesArray?.length ?? 0}</span>
        <span data-testid="locale">{locale}</span>
      </div>
    )
  ),
}));
vi.mock("@/app/(app)/environments/[environmentId]/integrations/lib/surveys", () => ({
  getSurveys: vi.fn(),
}));

let mockNotionClientId: string | undefined = "test-client-id";
let mockNotionClientSecret: string | undefined = "test-client-secret";
let mockNotionAuthUrl: string | undefined = "https://notion.com/auth";
let mockNotionRedirectUri: string | undefined = "https://app.formbricks.com/redirect";

vi.mock("@/lib/constants", () => ({
  get NOTION_OAUTH_CLIENT_ID() {
    return mockNotionClientId;
  },
  get NOTION_OAUTH_CLIENT_SECRET() {
    return mockNotionClientSecret;
  },
  get NOTION_AUTH_URL() {
    return mockNotionAuthUrl;
  },
  get NOTION_REDIRECT_URI() {
    return mockNotionRedirectUri;
  },
  WEBAPP_URL: "test-webapp-url",
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
}));
vi.mock("@/lib/integration/service", () => ({
  getIntegrationByType: vi.fn(),
}));
vi.mock("@/lib/notion/service", () => ({
  getNotionDatabases: vi.fn(),
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
    segment: null,
    singleUse: null,
    styling: null,
    surveyClosedMessage: null,
    welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
    autoComplete: null,
    runOnDate: null,
  } as unknown as TSurvey,
];

const mockNotionIntegration = {
  id: "integration1",
  type: "notion",
  config: {
    data: [],
    key: { bot_id: "bot-id-123" },
    email: "test@example.com",
  },
} as unknown as TIntegrationNotion;

const mockDatabases: TIntegrationNotionDatabase[] = [
  { id: "db1", name: "Database 1", properties: {} },
  { id: "db2", name: "Database 2", properties: {} },
];

const mockProps = {
  params: { environmentId: "test-env-id" },
};

describe("NotionIntegrationPage", () => {
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
    vi.mocked(getIntegrationByType).mockResolvedValue(mockNotionIntegration);
    vi.mocked(getNotionDatabases).mockResolvedValue(mockDatabases);
    vi.mocked(findMatchingLocale).mockResolvedValue("en-US");
    mockNotionClientId = "test-client-id";
    mockNotionClientSecret = "test-client-secret";
    mockNotionAuthUrl = "https://notion.com/auth";
    mockNotionRedirectUri = "https://app.formbricks.com/redirect";
  });

  test("renders the page with NotionWrapper when enabled and not read-only", async () => {
    const PageComponent = await Page(mockProps);
    render(PageComponent);

    expect(screen.getByText("environments.integrations.notion.notion_integration")).toBeInTheDocument();
    expect(screen.getByText("Mocked NotionWrapper")).toBeInTheDocument();
    expect(screen.getByTestId("enabled")).toHaveTextContent("true");
    expect(screen.getByTestId("environmentId")).toHaveTextContent(mockEnvironment.id);
    expect(screen.getByTestId("surveyCount")).toHaveTextContent(mockSurveys.length.toString());
    expect(screen.getByTestId("integrationId")).toHaveTextContent(mockNotionIntegration.id);
    expect(screen.getByTestId("webAppUrl")).toHaveTextContent("test-webapp-url");
    expect(screen.getByTestId("databaseCount")).toHaveTextContent(mockDatabases.length.toString());
    expect(screen.getByTestId("locale")).toHaveTextContent("en-US");
    expect(screen.getByTestId("go-back")).toHaveTextContent(
      `test-webapp-url/environments/${mockProps.params.environmentId}/integrations`
    );
    expect(vi.mocked(redirect)).not.toHaveBeenCalled();
    expect(vi.mocked(getNotionDatabases)).toHaveBeenCalledWith(mockEnvironment.id);
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

  test("passes enabled=false to NotionWrapper when constants are missing", async () => {
    mockNotionClientId = undefined; // Simulate missing constant

    const PageComponent = await Page(mockProps);
    render(PageComponent);

    expect(screen.getByTestId("enabled")).toHaveTextContent("false");
  });

  test("handles case where no Notion integration exists", async () => {
    vi.mocked(getIntegrationByType).mockResolvedValue(null); // No integration

    const PageComponent = await Page(mockProps);
    render(PageComponent);

    expect(screen.getByText("Mocked NotionWrapper")).toBeInTheDocument();
    expect(screen.getByTestId("integrationId")).toBeEmptyDOMElement(); // No integration ID passed
    expect(screen.getByTestId("databaseCount")).toHaveTextContent("0"); // No databases fetched
    expect(vi.mocked(getNotionDatabases)).not.toHaveBeenCalled();
  });

  test("handles case where integration exists but has no key (bot_id)", async () => {
    const integrationWithoutKey = {
      ...mockNotionIntegration,
      config: { ...mockNotionIntegration.config, key: undefined },
    } as unknown as TIntegrationNotion;
    vi.mocked(getIntegrationByType).mockResolvedValue(integrationWithoutKey);

    const PageComponent = await Page(mockProps);
    render(PageComponent);

    expect(screen.getByText("Mocked NotionWrapper")).toBeInTheDocument();
    expect(screen.getByTestId("integrationId")).toHaveTextContent(integrationWithoutKey.id);
    expect(screen.getByTestId("databaseCount")).toHaveTextContent("0"); // No databases fetched
    expect(vi.mocked(getNotionDatabases)).not.toHaveBeenCalled();
  });
});
