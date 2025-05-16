import { TSurvey } from "@/modules/survey/list/types/surveys";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CopySurveyModal } from "./copy-survey-modal";

// Mock dependencies
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: (key: string) => key }),
}));

vi.mock("@/modules/ui/components/modal", () => ({
  Modal: ({ children, open, setOpen, noPadding, restrictOverflow }) =>
    open ? (
      <div data-testid="mock-modal" data-no-padding={noPadding} data-restrict-overflow={restrictOverflow}>
        <button data-testid="modal-close-button" onClick={() => setOpen(false)}>
          Close Modal
        </button>
        {children}
      </div>
    ) : null,
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

  test("renders modal when open is true", () => {
    render(<CopySurveyModal open={true} setOpen={mockSetOpen} survey={mockSurvey} />);

    // Check if the modal is rendered with correct props
    const modal = screen.getByTestId("mock-modal");
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveAttribute("data-no-padding", "true");
    expect(modal).toHaveAttribute("data-restrict-overflow", "true");

    // Check if the header content is rendered
    expect(screen.getByText("environments.surveys.copy_survey")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.copy_survey_description")).toBeInTheDocument();
  });

  test("doesn't render modal when open is false", () => {
    render(<CopySurveyModal open={false} setOpen={mockSetOpen} survey={mockSurvey} />);

    expect(screen.queryByTestId("mock-modal")).not.toBeInTheDocument();
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

  test("passes onCancel function that closes the modal", async () => {
    const user = userEvent.setup();

    render(<CopySurveyModal open={true} setOpen={mockSetOpen} survey={mockSurvey} />);

    // Click the cancel button in SurveyCopyOptions
    await user.click(screen.getByTestId("cancel-button"));

    // Verify setOpen was called with false
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });
});
