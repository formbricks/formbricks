import { WebhookModal } from "@/modules/integrations/webhooks/components/webhook-detail-modal";
import { Webhook } from "@prisma/client";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";

// Mock the Dialog components
vi.mock("@/modules/ui/components/dialog", () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) =>
    open ? (
      <div data-testid="dialog">
        {children}
        <button data-testid="dialog-close" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
    ) : null,
  DialogContent: ({
    children,
    disableCloseOnOutsideClick,
  }: {
    children: React.ReactNode;
    disableCloseOnOutsideClick?: boolean;
  }) => (
    <div data-testid="dialog-content" data-disable-close-on-outside-click={disableCloseOnOutsideClick}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogBody: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-body">{children}</div>
  ),
}));

// Mock the tab components
vi.mock("@/modules/integrations/webhooks/components/webhook-overview-tab", () => ({
  WebhookOverviewTab: ({ webhook }: { webhook: Webhook }) => (
    <div data-testid="webhook-overview-tab">Overview for {webhook.name}</div>
  ),
}));

vi.mock("@/modules/integrations/webhooks/components/webhook-settings-tab", () => ({
  WebhookSettingsTab: ({ webhook, setOpen }: { webhook: Webhook; setOpen: (v: boolean) => void }) => (
    <div data-testid="webhook-settings-tab">
      Settings for {webhook.name}
      <button onClick={() => setOpen(false)}>Close from settings</button>
    </div>
  ),
}));

// Mock useTranslate
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => {
      const translations = {
        "common.overview": "Overview",
        "common.settings": "Settings",
        "common.webhook": "Webhook",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  WebhookIcon: () => <span data-testid="webhook-icon">🪝</span>,
}));

const mockWebhook: Webhook = {
  id: "webhook-1",
  name: "Test Webhook",
  url: "https://example.com/webhook",
  source: "user",
  triggers: [],
  surveyIds: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  environmentId: "env-1",
};

const mockSurveys: TSurvey[] = [];

describe("WebhookModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders correctly when open", () => {
    const setOpen = vi.fn();
    render(
      <WebhookModal
        open={true}
        setOpen={setOpen}
        webhook={mockWebhook}
        surveys={mockSurveys}
        isReadOnly={false}
      />
    );

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Test Webhook");
    expect(screen.getByTestId("webhook-icon")).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByTestId("webhook-overview-tab")).toBeInTheDocument();
  });

  test("does not render when closed", () => {
    const setOpen = vi.fn();
    render(
      <WebhookModal
        open={false}
        setOpen={setOpen}
        webhook={mockWebhook}
        surveys={mockSurveys}
        isReadOnly={false}
      />
    );

    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  test("switches tabs correctly", async () => {
    const setOpen = vi.fn();
    const user = userEvent.setup();

    render(
      <WebhookModal
        open={true}
        setOpen={setOpen}
        webhook={mockWebhook}
        surveys={mockSurveys}
        isReadOnly={false}
      />
    );

    // Initially shows overview tab
    expect(screen.getByTestId("webhook-overview-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("webhook-settings-tab")).not.toBeInTheDocument();

    // Click settings tab
    const settingsTab = screen.getByText("Settings");
    await user.click(settingsTab);

    // Now shows settings tab
    expect(screen.queryByTestId("webhook-overview-tab")).not.toBeInTheDocument();
    expect(screen.getByTestId("webhook-settings-tab")).toBeInTheDocument();

    // Click overview tab again
    const overviewTab = screen.getByText("Overview");
    await user.click(overviewTab);

    // Back to overview tab
    expect(screen.getByTestId("webhook-overview-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("webhook-settings-tab")).not.toBeInTheDocument();
  });

  test("uses webhook as title when name is not provided", () => {
    const setOpen = vi.fn();
    const webhookWithoutName = { ...mockWebhook, name: "" };

    render(
      <WebhookModal
        open={true}
        setOpen={setOpen}
        webhook={webhookWithoutName}
        surveys={mockSurveys}
        isReadOnly={false}
      />
    );

    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Webhook");
  });

  test("resets to first tab when modal is reopened", async () => {
    const setOpen = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <WebhookModal
        open={true}
        setOpen={setOpen}
        webhook={mockWebhook}
        surveys={mockSurveys}
        isReadOnly={false}
      />
    );

    // Switch to settings tab
    const settingsTab = screen.getByText("Settings");
    await user.click(settingsTab);
    expect(screen.getByTestId("webhook-settings-tab")).toBeInTheDocument();

    // Close modal
    rerender(
      <WebhookModal
        open={false}
        setOpen={setOpen}
        webhook={mockWebhook}
        surveys={mockSurveys}
        isReadOnly={false}
      />
    );

    // Reopen modal
    rerender(
      <WebhookModal
        open={true}
        setOpen={setOpen}
        webhook={mockWebhook}
        surveys={mockSurveys}
        isReadOnly={false}
      />
    );

    // Should be back to overview tab
    expect(screen.getByTestId("webhook-overview-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("webhook-settings-tab")).not.toBeInTheDocument();
  });
});
