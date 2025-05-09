import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { getProjectsByEnvironmentIdAction } from "@/modules/survey/list/actions";
import { TUserProject } from "@/modules/survey/list/types/projects";
import { TSurvey } from "@/modules/survey/list/types/surveys";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import SurveyCopyOptions from "./survey-copy-options";

// Mock dependencies
vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn((error) => error?.message || "An error occurred"),
}));

vi.mock("@/modules/survey/list/actions", () => ({
  getProjectsByEnvironmentIdAction: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock("lucide-react", () => ({
  Loader2: () => <div data-testid="loading-spinner">Loading...</div>,
}));

// Mock CopySurveyForm component
vi.mock("./copy-survey-form", () => ({
  CopySurveyForm: ({ defaultProjects, survey, onCancel, setOpen }) => (
    <div data-testid="copy-survey-form">
      <div>Projects count: {defaultProjects.length}</div>
      <div>Survey ID: {survey.id}</div>
      <button data-testid="cancel-button" onClick={onCancel}>
        Cancel
      </button>
      <button data-testid="close-button" onClick={() => setOpen(false)}>
        Close
      </button>
    </div>
  ),
}));

describe("SurveyCopyOptions", () => {
  const mockSurvey = {
    id: "survey-1",
    name: "Test Survey",
    environmentId: "env-1",
  } as unknown as TSurvey;

  const mockOnCancel = vi.fn();
  const mockSetOpen = vi.fn();
  const mockProjects: TUserProject[] = [
    {
      id: "project-1",
      name: "Project 1",
      environments: [
        { id: "env-1", type: "development" },
        { id: "env-2", type: "production" },
      ],
    },
    {
      id: "project-2",
      name: "Project 2",
      environments: [
        { id: "env-3", type: "development" },
        { id: "env-4", type: "production" },
      ],
    },
  ];

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders loading spinner when projects are being fetched", () => {
    // Mock the action to not resolve so component stays in loading state
    vi.mocked(getProjectsByEnvironmentIdAction).mockReturnValue(new Promise(() => {}));

    render(
      <SurveyCopyOptions
        survey={mockSurvey}
        environmentId="env-1"
        onCancel={mockOnCancel}
        setOpen={mockSetOpen}
      />
    );

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    expect(screen.queryByTestId("copy-survey-form")).not.toBeInTheDocument();
  });

  test("renders CopySurveyForm when projects are loaded successfully", async () => {
    // Mock successful response
    vi.mocked(getProjectsByEnvironmentIdAction).mockResolvedValue({
      data: mockProjects,
    });

    render(
      <SurveyCopyOptions
        survey={mockSurvey}
        environmentId="env-1"
        onCancel={mockOnCancel}
        setOpen={mockSetOpen}
      />
    );

    // Initially should show loading spinner
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();

    // After data loading, should show the form
    await waitFor(() => {
      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument();
      expect(screen.getByTestId("copy-survey-form")).toBeInTheDocument();
    });

    // Check if props are passed correctly
    expect(screen.getByText(`Projects count: ${mockProjects.length}`)).toBeInTheDocument();
    expect(screen.getByText(`Survey ID: ${mockSurvey.id}`)).toBeInTheDocument();
  });

  test("shows error toast when project fetch fails", async () => {
    // Mock error response
    const mockError = new Error("Failed to fetch projects");
    vi.mocked(getProjectsByEnvironmentIdAction).mockResolvedValue({
      error: mockError,
    });
    vi.mocked(getFormattedErrorMessage).mockReturnValue("Failed to fetch projects");

    render(
      <SurveyCopyOptions
        survey={mockSurvey}
        environmentId="env-1"
        onCancel={mockOnCancel}
        setOpen={mockSetOpen}
      />
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to fetch projects");
      // Form should still render but with empty projects
      expect(screen.getByTestId("copy-survey-form")).toBeInTheDocument();
      expect(screen.getByText("Projects count: 0")).toBeInTheDocument();
    });
  });

  test("passes onCancel function to CopySurveyForm", async () => {
    // Mock successful response
    vi.mocked(getProjectsByEnvironmentIdAction).mockResolvedValue({
      data: mockProjects,
    });

    render(
      <SurveyCopyOptions
        survey={mockSurvey}
        environmentId="env-1"
        onCancel={mockOnCancel}
        setOpen={mockSetOpen}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("copy-survey-form")).toBeInTheDocument();
    });

    // Click the cancel button in CopySurveyForm
    screen.getByTestId("cancel-button").click();

    // Verify onCancel was called
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  test("passes setOpen function to CopySurveyForm", async () => {
    // Mock successful response
    vi.mocked(getProjectsByEnvironmentIdAction).mockResolvedValue({
      data: mockProjects,
    });

    render(
      <SurveyCopyOptions
        survey={mockSurvey}
        environmentId="env-1"
        onCancel={mockOnCancel}
        setOpen={mockSetOpen}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("copy-survey-form")).toBeInTheDocument();
    });

    // Click the close button in CopySurveyForm
    screen.getByTestId("close-button").click();

    // Verify setOpen was called with false
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });
});
