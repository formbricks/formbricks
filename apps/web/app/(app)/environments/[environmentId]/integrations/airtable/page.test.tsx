import { getSurveys } from "@/app/(app)/environments/[environmentId]/integrations/lib/surveys";
import { getAirtableTables } from "@/lib/airtable/service";
import { WEBAPP_URL } from "@/lib/constants";
import { getIntegrations } from "@/lib/integration/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { TEnvironmentAuth } from "@/modules/environments/types/environment-auth";
import { cleanup, render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationItem } from "@formbricks/types/integration";
import { TIntegrationAirtable, TIntegrationAirtableCredential } from "@formbricks/types/integration/airtable";
import { TSurvey } from "@formbricks/types/surveys/types";
import Page from "./page";

// Mock dependencies
vi.mock("@/app/(app)/environments/[environmentId]/integrations/airtable/components/AirtableWrapper", () => ({
  AirtableWrapper: vi.fn(() => <div>AirtableWrapper Mock</div>),
}));
vi.mock("@/app/(app)/environments/[environmentId]/integrations/lib/surveys");
vi.mock("@/lib/airtable/service");

let mockAirtableClientId: string | undefined = "test-client-id";

vi.mock("@/lib/constants", () => ({
  get AIRTABLE_CLIENT_ID() {
    return mockAirtableClientId;
  },
  WEBAPP_URL: "http://localhost:3000",
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
}));

vi.mock("@/lib/integration/service");
vi.mock("@/lib/utils/locale");
vi.mock("@/modules/environments/lib/utils");
vi.mock("@/modules/ui/components/go-back-button", () => ({
  GoBackButton: vi.fn(() => <div>GoBackButton Mock</div>),
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
vi.mock("next/navigation");

const mockEnvironmentId = "test-env-id";
const mockEnvironment = {
  id: mockEnvironmentId,
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "development",
} as unknown as TEnvironment;
const mockSurveys: TSurvey[] = [{ id: "survey1", name: "Survey 1" } as TSurvey];
const mockAirtableIntegration: TIntegrationAirtable = {
  type: "airtable",
  config: {
    key: { access_token: "test-token" } as unknown as TIntegrationAirtableCredential,
    data: [],
    email: "test@example.com",
  },
  environmentId: mockEnvironmentId,
  id: "int_airtable_123",
};
const mockAirtableTables: TIntegrationItem[] = [{ id: "table1", name: "Table 1" } as TIntegrationItem];
const mockLocale = "en-US";

const props = {
  params: {
    environmentId: mockEnvironmentId,
  },
};

describe("Airtable Integration Page", () => {
  beforeEach(() => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      environment: mockEnvironment,
      isReadOnly: false,
    } as unknown as TEnvironmentAuth);
    vi.mocked(getSurveys).mockResolvedValue(mockSurveys);
    vi.mocked(getIntegrations).mockResolvedValue([mockAirtableIntegration]);
    vi.mocked(getAirtableTables).mockResolvedValue(mockAirtableTables);
    vi.mocked(findMatchingLocale).mockResolvedValue(mockLocale);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("redirects if user is readOnly", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      environment: mockEnvironment,
      isReadOnly: true,
    } as unknown as TEnvironmentAuth);
    await render(await Page(props));
    expect(redirect).toHaveBeenCalledWith("./");
  });

  test("renders correctly when integration is configured", async () => {
    await render(await Page(props));

    expect(screen.getByText("environments.integrations.airtable.airtable_integration")).toBeInTheDocument();
    expect(screen.getByText("GoBackButton Mock")).toBeInTheDocument();
    expect(screen.getByText("AirtableWrapper Mock")).toBeInTheDocument();

    expect(vi.mocked(getEnvironmentAuth)).toHaveBeenCalledWith(mockEnvironmentId);
    expect(vi.mocked(getSurveys)).toHaveBeenCalledWith(mockEnvironmentId);
    expect(vi.mocked(getIntegrations)).toHaveBeenCalledWith(mockEnvironmentId);
    expect(vi.mocked(getAirtableTables)).toHaveBeenCalledWith(mockEnvironmentId);
    expect(vi.mocked(findMatchingLocale)).toHaveBeenCalled();

    const AirtableWrapper = vi.mocked(
      (
        await import(
          "@/app/(app)/environments/[environmentId]/integrations/airtable/components/AirtableWrapper"
        )
      ).AirtableWrapper
    );
    expect(AirtableWrapper).toHaveBeenCalledWith(
      {
        isEnabled: true,
        airtableIntegration: mockAirtableIntegration,
        airtableArray: mockAirtableTables,
        environmentId: mockEnvironmentId,
        surveys: mockSurveys,
        environment: mockEnvironment,
        webAppUrl: WEBAPP_URL,
        locale: mockLocale,
      },
      undefined
    );
  });

  test("renders correctly when integration exists but is not configured (no key)", async () => {
    const integrationWithoutKey = {
      ...mockAirtableIntegration,
      config: { ...mockAirtableIntegration.config, key: undefined },
    } as unknown as TIntegrationAirtable;
    vi.mocked(getIntegrations).mockResolvedValue([integrationWithoutKey]);

    await render(await Page(props));

    expect(screen.getByText("environments.integrations.airtable.airtable_integration")).toBeInTheDocument();
    expect(screen.getByText("AirtableWrapper Mock")).toBeInTheDocument();

    expect(vi.mocked(getAirtableTables)).not.toHaveBeenCalled(); // Should not fetch tables if no key

    const AirtableWrapper = vi.mocked(
      (
        await import(
          "@/app/(app)/environments/[environmentId]/integrations/airtable/components/AirtableWrapper"
        )
      ).AirtableWrapper
    );
    // Update assertion to match the actual call
    expect(AirtableWrapper).toHaveBeenCalledWith(
      {
        isEnabled: true, // isEnabled is true because AIRTABLE_CLIENT_ID is set in beforeEach
        airtableIntegration: integrationWithoutKey,
        airtableArray: [], // Should be empty as getAirtableTables is not called
        environmentId: mockEnvironmentId,
        surveys: mockSurveys,
        environment: mockEnvironment,
        webAppUrl: WEBAPP_URL,
        locale: mockLocale,
      },
      undefined // Change second argument to undefined
    );
  });

  test("renders correctly when integration is disabled (no client ID)", async () => {
    mockAirtableClientId = undefined; // Simulate disabled integration

    await render(await Page(props));

    expect(screen.getByText("environments.integrations.airtable.airtable_integration")).toBeInTheDocument();
    expect(screen.getByText("AirtableWrapper Mock")).toBeInTheDocument();

    const AirtableWrapper = vi.mocked(
      (
        await import(
          "@/app/(app)/environments/[environmentId]/integrations/airtable/components/AirtableWrapper"
        )
      ).AirtableWrapper
    );
    expect(AirtableWrapper).toHaveBeenCalledWith(
      expect.objectContaining({
        isEnabled: false, // Should be false
      }),
      undefined
    );
  });
});
