import { TSurvey } from "@/modules/survey/list/types/surveys";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CopySurveyModal } from "./copy-survey-modal";

// Mock dependencies
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: (key: string) => key }),
}));

vi.mock("@/modules/ui/components/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-title">{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-description">{children}</div>
  ),
  DialogBody: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-body">{children}</div>
  ),
}));

// Mock SurveyCopyOptions component
vi.mock("./survey-copy-options", () => ({
  default: ({ survey, environmentId, onCancel, setOpen }) => (
    <div data-testid="mock-survey-copy-options">
      <div>Survey ID: {survey.id}</div>
      <div>Environment ID: {environmentId}</div>
      <button data-testid="cancel-button" onClick={onCancel}>
        Cancel
      </button>
      <button data-testid="close-button" onClick={() => setOpen(false)}>
        Close
      </button>
    </div>
  ),
}));

describe("CopySurveyModal", () => {
  const mockSurvey = {
    id: "survey-123",
    name: "Test Survey",
    environmentId: "env-456",
    type: "link",
    status: "draft",
  } as unknown as TSurvey;

  const mockSetOpen = vi.fn();

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders dialog when open is true", () => {
    render(<CopySurveyModal open={true} setOpen={mockSetOpen} survey={mockSurvey} />);

    // Check if the dialog is rendered with correct structure
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-header")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-description")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-body")).toBeInTheDocument();

    // Check if the header content is rendered
    expect(screen.getByText("environments.surveys.copy_survey")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.copy_survey_description")).toBeInTheDocument();
  });

  test("doesn't render dialog when open is false", () => {
    render(<CopySurveyModal open={false} setOpen={mockSetOpen} survey={mockSurvey} />);

    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("environments.surveys.copy_survey")).not.toBeInTheDocument();
  });

  test("renders SurveyCopyOptions with correct props", () => {
    render(<CopySurveyModal open={true} setOpen={mockSetOpen} survey={mockSurvey} />);

    // Check if SurveyCopyOptions is rendered with correct props
    const surveyCopyOptions = screen.getByTestId("mock-survey-copy-options");
    expect(surveyCopyOptions).toBeInTheDocument();
    expect(screen.getByText(`Survey ID: ${mockSurvey.id}`)).toBeInTheDocument();
    expect(screen.getByText(`Environment ID: ${mockSurvey.environmentId}`)).toBeInTheDocument();
  });

  test("passes setOpen to SurveyCopyOptions", async () => {
    const user = userEvent.setup();

    render(<CopySurveyModal open={true} setOpen={mockSetOpen} survey={mockSurvey} />);

    // Click the close button in SurveyCopyOptions
    await user.click(screen.getByTestId("close-button"));

    // Verify setOpen was called with false
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });

  test("passes onCancel function that closes the dialog", async () => {
    const user = userEvent.setup();

    render(<CopySurveyModal open={true} setOpen={mockSetOpen} survey={mockSurvey} />);

    // Click the cancel button in SurveyCopyOptions
    await user.click(screen.getByTestId("cancel-button"));

    // Verify setOpen was called with false
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });
});
