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
vi.mock("@/modules/projects/settings/(setup)/components/environment-id-field", () => ({
  EnvironmentIdField: ({ environmentId }: any) => (
    <div data-testid="environment-id-field">{environmentId}</div>
  ),
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(async (environmentId: string) => ({ environment: { id: environmentId } })),
}));

let mockWebappUrl = "https://example.com";

vi.mock("@/lib/constants", () => ({
  get WEBAPP_URL() {
    return mockWebappUrl;
  },
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
    const cards = await findAllByTestId("settings-card");
    expect(cards.length).toBe(3);
    expect(cards[0]).toHaveTextContent("environments.project.app-connection.app_connection");
    expect(cards[0]).toHaveTextContent("environments.project.app-connection.app_connection_description");
    expect(cards[0]).toHaveTextContent("env-123"); // WidgetStatusIndicator
    expect(cards[1]).toHaveTextContent("environments.project.app-connection.how_to_setup");
    expect(cards[1]).toHaveTextContent("environments.project.app-connection.how_to_setup_description");
    expect(cards[1]).toHaveTextContent("env-123"); // SetupInstructions
    expect(cards[2]).toHaveTextContent("environments.project.app-connection.environment_id");
    expect(cards[2]).toHaveTextContent("environments.project.app-connection.environment_id_description");
    expect(cards[2]).toHaveTextContent("env-123"); // EnvironmentIdField
  });
});
