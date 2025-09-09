import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AppConnectionPage } from "./page";

vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: ({ children }: any) => <div data-testid="page-content-wrapper">{children}</div>,
}));
vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: ({ pageTitle, children }: any) => (
    <div data-testid="page-header">
      {pageTitle}
      {children}
    </div>
  ),
}));
vi.mock("@/modules/projects/settings/components/project-config-navigation", () => ({
  ProjectConfigNavigation: ({ environmentId, activeId }: any) => (
    <div data-testid="project-config-navigation">
      {environmentId} {activeId}
    </div>
  ),
}));
vi.mock("@/modules/ui/components/environment-notice", () => ({
  EnvironmentNotice: ({ environmentId, subPageUrl }: any) => (
    <div data-testid="environment-notice">
      {environmentId} {subPageUrl}
    </div>
  ),
}));
vi.mock("@/app/(app)/environments/[environmentId]/settings/components/SettingsCard", () => ({
  SettingsCard: ({ title, description, children }: any) => (
    <div data-testid="settings-card">
      {title} {description} {children}
    </div>
  ),
}));
vi.mock("@/app/(app)/environments/[environmentId]/components/WidgetStatusIndicator", () => ({
  WidgetStatusIndicator: ({ environment }: any) => (
    <div data-testid="widget-status-indicator">{environment.id}</div>
  ),
}));
vi.mock("@/modules/projects/settings/(setup)/components/setup-instructions", () => ({
  SetupInstructions: ({ environmentId, publicDomain }: any) => (
    <div data-testid="setup-instructions">
      {environmentId} {publicDomain}
    </div>
  ),
}));

vi.mock("../components/action-settings-card", () => ({
  ActionSettingsCard: () => <div data-testid="action-settings-card">action-settings-card</div>,
}));

vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  AlertButton: ({ children }: any) => <div data-testid="alert-button">{children}</div>,
  AlertDescription: ({ children }: any) => <div data-testid="alert-description">{children}</div>,
  AlertTitle: ({ children }: any) => <div data-testid="alert-title">{children}</div>,
}));

vi.mock("@/modules/ui/components/id-badge", () => ({
  IdBadge: ({ id }: any) => <div data-testid="id-badge">{id}</div>,
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, target }: any) => (
    <a href={href} target={target} data-testid="link">
      {children}
    </a>
  ),
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(async (environmentId: string) => ({
    environment: { id: environmentId, projectId: "project-123" },
    isReadOnly: false,
  })),
}));

vi.mock("@/lib/environment/service", () => ({
  getEnvironments: vi.fn(async (projectId: string) => [
    { id: "env-123", projectId },
    { id: "env-456", projectId },
  ]),
}));

vi.mock("@/lib/actionClass/service", () => ({
  getActionClasses: vi.fn(async () => []),
}));

vi.mock("@/lib/getPublicUrl", () => ({
  getPublicDomain: vi.fn(() => "https://example.com"),
}));

vi.mock("@/lib/utils/locale", () => ({
  findMatchingLocale: vi.fn(async () => "en"),
}));

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
  SENTRY_RELEASE: "mock-sentry-release",
  SENTRY_ENVIRONMENT: "mock-sentry-environment",
  SESSION_MAX_AGE: 1000,
}));

vi.mock("@/lib/env", () => ({
  env: {
    PUBLIC_URL: "https://example.com",
  },
}));

describe("AppConnectionPage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders all sections and passes correct props", async () => {
    const params = { environmentId: "env-123" };
    const props = { params };
    const { findByTestId, findAllByTestId } = render(await AppConnectionPage(props));
    expect(await findByTestId("page-content-wrapper")).toBeInTheDocument();
    expect(await findByTestId("page-header")).toHaveTextContent("common.project_configuration");
    expect(await findByTestId("project-config-navigation")).toHaveTextContent("env-123 app-connection");
    expect(await findByTestId("environment-notice")).toHaveTextContent("env-123 /project/app-connection");

    // Check that ActionSettingsCard is rendered
    expect(await findByTestId("action-settings-card")).toBeInTheDocument();
    expect(await findByTestId("action-settings-card")).toHaveTextContent("action-settings-card");

    const cards = await findAllByTestId("settings-card");
    expect(cards.length).toBe(2);
    expect(cards[0]).toHaveTextContent("environments.project.app-connection.environment_id");
    expect(cards[0]).toHaveTextContent("environments.project.app-connection.environment_id_description");
    expect(cards[0]).toHaveTextContent("env-123"); // IdBadge
    expect(cards[1]).toHaveTextContent("environments.project.app-connection.app_connection");
    expect(cards[1]).toHaveTextContent("environments.project.app-connection.app_connection_description");
    expect(cards[1]).toHaveTextContent("env-123"); // WidgetStatusIndicator
  });
});
