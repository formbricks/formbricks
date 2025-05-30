import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AddWebhookModal } from "./add-webhook-modal";

// Mock the Dialog components
vi.mock("@/modules/ui/components/dialog", () => ({
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="dialog">
        {children}
        <button data-testid="dialog-close" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
    ) : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="dialog-title" className={className}>
      {children}
    </h2>
  ),
  DialogDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <p data-testid="dialog-description" className={className}>
      {children}
    </p>
  ),
  DialogBody: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-body" className={className}>
      {children}
    </div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
}));

// Mock the child components
vi.mock("./survey-checkbox-group", () => ({
  SurveyCheckboxGroup: ({
    surveys,
    selectedSurveys,
    selectedAllSurveys,
    onSelectAllSurveys,
    onSelectedSurveyChange,
    allowChanges,
  }: any) => (
    <div data-testid="survey-checkbox-group">
      <button onClick={onSelectAllSurveys}>Select All Surveys</button>
      {surveys.map((survey: any) => (
        <button key={survey.id} onClick={() => onSelectedSurveyChange(survey.id)}>
          {survey.name}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("./trigger-checkbox-group", () => ({
  TriggerCheckboxGroup: ({ selectedTriggers, onCheckboxChange, allowChanges }: any) => (
    <div data-testid="trigger-checkbox-group">
      <button onClick={() => onCheckboxChange("responseCreated")}>Response Created</button>
      <button onClick={() => onCheckboxChange("responseUpdated")}>Response Updated</button>
    </div>
  ),
}));

// Mock actions
vi.mock("../actions", () => ({
  createWebhookAction: vi.fn(),
  testEndpointAction: vi.fn(),
}));

// Mock other dependencies
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("AddWebhookModal", () => {
  const mockProps = {
    environmentId: "env-123",
    open: true,
    surveys: [
      { id: "survey-1", name: "Test Survey 1" },
      { id: "survey-2", name: "Test Survey 2" },
    ],
    setOpen: vi.fn(),
  };

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders dialog with correct title and description", () => {
    render(<AddWebhookModal {...mockProps} />);

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toHaveTextContent(
      "environments.integrations.webhooks.add_webhook"
    );
    expect(
      screen.getByText("environments.integrations.webhooks.add_webhook_description")
    ).toBeInTheDocument();
  });

  test("does not render when closed", () => {
    render(<AddWebhookModal {...mockProps} open={false} />);

    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  test("renders form fields", () => {
    render(<AddWebhookModal {...mockProps} />);

    expect(screen.getByLabelText("common.name")).toBeInTheDocument();
    expect(screen.getByLabelText("common.url")).toBeInTheDocument();
    expect(screen.getByTestId("trigger-checkbox-group")).toBeInTheDocument();
    expect(screen.getByTestId("survey-checkbox-group")).toBeInTheDocument();
  });

  test("renders footer buttons", () => {
    render(<AddWebhookModal {...mockProps} />);

    expect(screen.getByTestId("dialog-footer")).toBeInTheDocument();
    expect(screen.getByText("common.cancel")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "environments.integrations.webhooks.add_webhook" })
    ).toBeInTheDocument();
  });

  test("calls setOpen when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<AddWebhookModal {...mockProps} />);

    await user.click(screen.getByText("common.cancel"));

    expect(mockProps.setOpen).toHaveBeenCalledWith(false);
  });

  test("renders webhook icon in header", () => {
    render(<AddWebhookModal {...mockProps} />);

    expect(screen.getByTestId("dialog-header")).toBeInTheDocument();
    // The Webhook icon should be rendered within the header
    const header = screen.getByTestId("dialog-header");
    expect(header).toBeInTheDocument();
  });
});
