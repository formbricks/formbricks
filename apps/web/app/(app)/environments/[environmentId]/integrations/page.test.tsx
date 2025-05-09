import { getWebhookCountBySource } from "@/app/(app)/environments/[environmentId]/integrations/lib/webhook";
import Page from "@/app/(app)/environments/[environmentId]/integrations/page";
import { getIntegrations } from "@/lib/integration/service";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { TEnvironmentAuth } from "@/modules/environments/types/environment-auth";
import { cleanup, render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TIntegration } from "@formbricks/types/integration";

// Mock dependencies
vi.mock("@/app/(app)/environments/[environmentId]/integrations/lib/webhook", () => ({
  getWebhookCountBySource: vi.fn(),
}));

vi.mock("@/lib/integration/service", () => ({
  getIntegrations: vi.fn(),
}));

vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(),
}));

vi.mock("@/modules/ui/components/integration-card", () => ({
  Card: ({ label, description, statusText, disabled }) => (
    <div data-testid={`card-${label}`}>
      <h1>{label}</h1>
      <p>{description}</p>
      <span>{statusText}</span>
      {disabled && <span>Disabled</span>}
    </div>
  ),
}));

vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: ({ children }) => <div>{children}</div>,
}));

vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: ({ pageTitle }) => <h1>{pageTitle}</h1>,
}));

vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }) => <img alt={alt} />,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

const mockEnvironment = {
  id: "test-env-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "development",
  appSetupCompleted: true,
} as unknown as TEnvironment;

const mockIntegrations: TIntegration[] = [
  {
    id: "google-sheets-id",
    type: "googleSheets",
    environmentId: "test-env-id",
    config: { data: [], email: "test@example.com" } as unknown as TIntegration["config"],
  },
  {
    id: "slack-id",
    type: "slack",
    environmentId: "test-env-id",
    config: { data: [] } as unknown as TIntegration["config"],
  },
];

const mockParams = { environmentId: "test-env-id" };
const mockProps = { params: mockParams };

describe("Integrations Page", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.mocked(getWebhookCountBySource).mockResolvedValue(0);
    vi.mocked(getIntegrations).mockResolvedValue([]);
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      environment: mockEnvironment,
      isReadOnly: false,
      isBilling: false,
    } as unknown as TEnvironmentAuth);
  });

  test("renders the page header and integration cards", async () => {
    vi.mocked(getWebhookCountBySource).mockImplementation(async (envId, source) => {
      if (source === "zapier") return 1;
      if (source === "user") return 2;
      return 0;
    });
    vi.mocked(getIntegrations).mockResolvedValue(mockIntegrations);

    const PageComponent = await Page(mockProps);
    render(PageComponent);

    expect(screen.getByText("common.integrations")).toBeInTheDocument(); // Page Header
    expect(screen.getByTestId("card-Javascript SDK")).toBeInTheDocument();
    expect(
      screen.getByText("environments.integrations.website_or_app_integration_description")
    ).toBeInTheDocument();
    expect(screen.getAllByText("common.connected")[0]).toBeInTheDocument(); // JS SDK status

    expect(screen.getByTestId("card-Zapier")).toBeInTheDocument();
    expect(screen.getByText("environments.integrations.zapier_integration_description")).toBeInTheDocument();
    expect(screen.getByText("1 zap")).toBeInTheDocument(); // Zapier status

    expect(screen.getByTestId("card-Webhooks")).toBeInTheDocument();
    expect(screen.getByText("environments.integrations.webhook_integration_description")).toBeInTheDocument();
    expect(screen.getByText("2 webhooks")).toBeInTheDocument(); // Webhook status

    expect(screen.getByTestId("card-Google Sheets")).toBeInTheDocument();
    expect(
      screen.getByText("environments.integrations.google_sheet_integration_description")
    ).toBeInTheDocument();
    expect(screen.getAllByText("common.connected")[1]).toBeInTheDocument(); // Google Sheets status

    expect(screen.getByTestId("card-Airtable")).toBeInTheDocument();
    expect(
      screen.getByText("environments.integrations.airtable_integration_description")
    ).toBeInTheDocument();
    expect(screen.getAllByText("common.not_connected")[0]).toBeInTheDocument(); // Airtable status

    expect(screen.getByTestId("card-Slack")).toBeInTheDocument();
    expect(screen.getByText("environments.integrations.slack_integration_description")).toBeInTheDocument();
    expect(screen.getAllByText("common.connected")[2]).toBeInTheDocument(); // Slack status

    expect(screen.getByTestId("card-n8n")).toBeInTheDocument();
    expect(screen.getByText("environments.integrations.n8n_integration_description")).toBeInTheDocument();
    expect(screen.getAllByText("common.not_connected")[1]).toBeInTheDocument(); // n8n status

    expect(screen.getByTestId("card-Make.com")).toBeInTheDocument();
    expect(screen.getByText("environments.integrations.make_integration_description")).toBeInTheDocument();
    expect(screen.getAllByText("common.not_connected")[2]).toBeInTheDocument(); // Make status

    expect(screen.getByTestId("card-Notion")).toBeInTheDocument();
    expect(screen.getByText("environments.integrations.notion_integration_description")).toBeInTheDocument();
    expect(screen.getAllByText("common.not_connected")[3]).toBeInTheDocument(); // Notion status

    expect(screen.getByTestId("card-Activepieces")).toBeInTheDocument();
    expect(
      screen.getByText("environments.integrations.activepieces_integration_description")
    ).toBeInTheDocument();
    expect(screen.getAllByText("common.not_connected")[4]).toBeInTheDocument(); // Activepieces status
  });

  test("renders disabled cards when isReadOnly is true", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      environment: mockEnvironment,
      isReadOnly: true,
      isBilling: false,
    } as unknown as TEnvironmentAuth);

    const PageComponent = await Page(mockProps);
    render(PageComponent);

    // JS SDK and Webhooks should not be disabled
    expect(screen.getByTestId("card-Javascript SDK")).not.toHaveTextContent("Disabled");
    expect(screen.getByTestId("card-Webhooks")).not.toHaveTextContent("Disabled");

    // Other cards should be disabled
    expect(screen.getByTestId("card-Zapier")).toHaveTextContent("Disabled");
    expect(screen.getByTestId("card-Google Sheets")).toHaveTextContent("Disabled");
    expect(screen.getByTestId("card-Airtable")).toHaveTextContent("Disabled");
    expect(screen.getByTestId("card-Slack")).toHaveTextContent("Disabled");
    expect(screen.getByTestId("card-n8n")).toHaveTextContent("Disabled");
    expect(screen.getByTestId("card-Make.com")).toHaveTextContent("Disabled");
    expect(screen.getByTestId("card-Notion")).toHaveTextContent("Disabled");
    expect(screen.getByTestId("card-Activepieces")).toHaveTextContent("Disabled");
  });

  test("redirects when isBilling is true", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      environment: mockEnvironment,
      isReadOnly: false,
      isBilling: true,
    } as unknown as TEnvironmentAuth);

    await Page(mockProps);

    expect(vi.mocked(redirect)).toHaveBeenCalledWith(
      `/environments/${mockParams.environmentId}/settings/billing`
    );
  });

  test("renders correct status text for single integration", async () => {
    vi.mocked(getWebhookCountBySource).mockImplementation(async (envId, source) => {
      if (source === "n8n") return 1;
      if (source === "make") return 1;
      if (source === "activepieces") return 1;
      return 0;
    });

    const PageComponent = await Page(mockProps);
    render(PageComponent);

    expect(screen.getByTestId("card-n8n")).toHaveTextContent("1 common.integration");
    expect(screen.getByTestId("card-Make.com")).toHaveTextContent("1 common.integration");
    expect(screen.getByTestId("card-Activepieces")).toHaveTextContent("1 common.integration");
  });

  test("renders correct status text for multiple integrations", async () => {
    vi.mocked(getWebhookCountBySource).mockImplementation(async (envId, source) => {
      if (source === "n8n") return 3;
      if (source === "make") return 4;
      if (source === "activepieces") return 5;
      return 0;
    });

    const PageComponent = await Page(mockProps);
    render(PageComponent);

    expect(screen.getByTestId("card-n8n")).toHaveTextContent("3 common.integrations");
    expect(screen.getByTestId("card-Make.com")).toHaveTextContent("4 common.integrations");
    expect(screen.getByTestId("card-Activepieces")).toHaveTextContent("5 common.integrations");
  });

  test("renders not connected status when widgetSetupCompleted is false", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      environment: { ...mockEnvironment, appSetupCompleted: false },
      isReadOnly: false,
      isBilling: false,
    } as unknown as TEnvironmentAuth);

    const PageComponent = await Page(mockProps);
    render(PageComponent);

    expect(screen.getByTestId("card-Javascript SDK")).toHaveTextContent("common.not_connected");
  });
});
