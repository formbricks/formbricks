import { authorize } from "@/app/(app)/environments/[environmentId]/integrations/notion/lib/notion";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegrationNotion, TIntegrationNotionCredential } from "@formbricks/types/integration/notion";
import { TSurvey } from "@formbricks/types/surveys/types";
import { NotionWrapper } from "./NotionWrapper";

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
  GOOGLE_SHEETS_CLIENT_SECRET: "test-client-secret",
  GOOGLE_SHEETS_REDIRECT_URL: "test-redirect-url",
  SESSION_MAX_AGE: 1000,
}));

// Mock child components
vi.mock("@/app/(app)/environments/[environmentId]/integrations/notion/components/ManageIntegration", () => ({
  ManageIntegration: vi.fn(({ setIsConnected }) => (
    <div data-testid="manage-integration">
      <button onClick={() => setIsConnected(false)}>Disconnect</button>
    </div>
  )),
}));
vi.mock("@/modules/ui/components/connect-integration", () => ({
  ConnectIntegration: vi.fn(
    (
      { handleAuthorization, isEnabled } // Reverted back to isEnabled
    ) => (
      <div data-testid="connect-integration">
        <button onClick={handleAuthorization} disabled={!isEnabled}>
          {" "}
          {/* Reverted back to isEnabled */}
          Connect
        </button>
      </div>
    )
  ),
}));

// Mock library function
vi.mock("@/app/(app)/environments/[environmentId]/integrations/notion/lib/notion", () => ({
  authorize: vi.fn(),
}));

// Mock image import
vi.mock("@/images/notion-logo.svg", () => ({
  default: "notion-logo-path",
}));

// Mock window.location.replace
Object.defineProperty(window, "location", {
  value: {
    replace: vi.fn(),
  },
  writable: true,
});

const environmentId = "test-env-id";
const webAppUrl = "https://app.formbricks.com";
const environment = { id: environmentId } as TEnvironment;
const surveys: TSurvey[] = [];
const databases = [];
const locale = "en-US" as const;

const mockNotionIntegration: TIntegrationNotion = {
  id: "int-notion-123",
  type: "notion",
  environmentId: environmentId,
  config: {
    key: { access_token: "test-token" } as TIntegrationNotionCredential,
    data: [],
  },
};

const baseProps = {
  environment,
  surveys,
  databasesArray: databases, // Renamed databases to databasesArray to match component prop
  webAppUrl,
  locale,
};

describe("NotionWrapper", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders ConnectIntegration disabled when enabled is false", () => {
    // Changed description slightly
    render(<NotionWrapper {...baseProps} enabled={false} notionIntegration={undefined} />); // Changed isEnabled to enabled
    expect(screen.getByTestId("connect-integration")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
    expect(screen.queryByTestId("manage-integration")).not.toBeInTheDocument();
  });

  test("renders ConnectIntegration enabled when enabled is true and not connected (no integration)", () => {
    // Changed description slightly
    render(<NotionWrapper {...baseProps} enabled={true} notionIntegration={undefined} />); // Changed isEnabled to enabled
    expect(screen.getByTestId("connect-integration")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeEnabled();
    expect(screen.queryByTestId("manage-integration")).not.toBeInTheDocument();
  });

  test("renders ConnectIntegration enabled when enabled is true and not connected (integration without key)", () => {
    // Changed description slightly
    const integrationWithoutKey = {
      ...mockNotionIntegration,
      config: { data: [] },
    } as unknown as TIntegrationNotion;
    render(<NotionWrapper {...baseProps} enabled={true} notionIntegration={integrationWithoutKey} />); // Changed isEnabled to enabled
    expect(screen.getByTestId("connect-integration")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeEnabled();
    expect(screen.queryByTestId("manage-integration")).not.toBeInTheDocument();
  });

  test("calls authorize and redirects when Connect button is clicked", async () => {
    const mockAuthorize = vi.mocked(authorize);
    const redirectUrl = "https://notion.com/auth";
    mockAuthorize.mockResolvedValue(redirectUrl);

    render(<NotionWrapper {...baseProps} enabled={true} notionIntegration={undefined} />); // Changed isEnabled to enabled

    const connectButton = screen.getByRole("button", { name: "Connect" });
    await userEvent.click(connectButton);

    expect(mockAuthorize).toHaveBeenCalledWith(environmentId, webAppUrl);
    await waitFor(() => {
      expect(window.location.replace).toHaveBeenCalledWith(redirectUrl);
    });
  });
});
