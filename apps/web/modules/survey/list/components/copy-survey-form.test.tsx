import { copySurveyToOtherEnvironmentAction } from "@/modules/survey/list/actions";
import { TUserProject } from "@/modules/survey/list/types/projects";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CopySurveyForm } from "./copy-survey-form";

// Mock dependencies
vi.mock("@/modules/survey/list/actions", () => ({
  copySurveyToOtherEnvironmentAction: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string, params?: any) => {
      if (key === "environments.surveys.copy_survey_partially_success") {
        return `Partially successful: ${params?.success} success, ${params?.error} error`;
      }
      return key;
    },
  }),
}));

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn((result) => {
    if (result?.serverError) return result.serverError;
    if (result?.validationErrors) return "Validation error";
    return "Unknown error";
  }),
}));

// Mock the form components to make them testable
vi.mock("@/modules/ui/components/form", () => ({
  FormProvider: ({ children }: any) => <div data-testid="form-provider">{children}</div>,
  FormField: ({ children, render }: any) => (
    <div data-testid="form-field">{render({ field: { value: [], onChange: vi.fn() } })}</div>
  ),
  FormItem: ({ children }: any) => <div data-testid="form-item">{children}</div>,
  FormControl: ({ children }: any) => <div data-testid="form-control">{children}</div>,
}));

vi.mock("@/modules/ui/components/checkbox", () => ({
  Checkbox: ({ id, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      id={id}
      data-testid={id}
      onChange={(e) => {
        onCheckedChange && onCheckedChange(e.target.checked);
      }}
      {...props}
    />
  ),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, type, variant, ...rest }: any) => (
    <button
      data-testid={`button-${type || "button"}`}
      onClick={onClick}
      type={type || "button"}
      data-variant={variant}
      {...rest}>
      {children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/label", () => ({
  Label: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
}));

// Create a mock submit handler
let mockSubmitHandler: any = null;

// Mock react-hook-form
vi.mock("react-hook-form", () => ({
  useForm: () => ({
    control: {},
    handleSubmit: (fn: any) => {
      mockSubmitHandler = fn;
      return (e: any) => {
        e.preventDefault();
        // Simulate form data with selected environments
        const mockFormData = {
          projects: [
            {
              project: "project-1",
              environments: ["env-2"], // Only env-2 selected
            },
            {
              project: "project-2",
              environments: ["env-3"], // Only env-3 selected
            },
          ],
        };
        return fn(mockFormData);
      };
    },
  }),
  useFieldArray: () => ({
    fields: [{ project: "project-1" }, { project: "project-2" }],
  }),
}));

// Mock data
const mockSurvey = {
  id: "survey-1",
  name: "Test Survey",
  type: "link",
  createdAt: new Date(),
  updatedAt: new Date(),
  environmentId: "env-1",
  status: "draft",
  singleUse: null,
  responseCount: 0,
  creator: null,
} as any;

const mockProjects = [
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
] satisfies TUserProject[];

describe("CopySurveyForm", () => {
  const mockSetOpen = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnSurveysCopied = vi.fn();

  // Get references to the mocked functions
  const mockCopySurveyAction = vi.mocked(copySurveyToOtherEnvironmentAction);
  const mockToastSuccess = vi.mocked(toast.success);
  const mockToastError = vi.mocked(toast.error);

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmitHandler = null;
  });

  afterEach(() => {
    cleanup();
  });

  test("renders the form with correct project and environment options", () => {
    render(
      <CopySurveyForm
        defaultProjects={mockProjects}
        survey={mockSurvey}
        onCancel={mockOnCancel}
        setOpen={mockSetOpen}
      />
    );

    expect(screen.getByText("Project 1")).toBeInTheDocument();
    expect(screen.getByText("Project 2")).toBeInTheDocument();
    expect(screen.getAllByText("development").length).toBe(1);
    expect(screen.getAllByText("production").length).toBe(2);
  });

  test("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <CopySurveyForm
        defaultProjects={mockProjects}
        survey={mockSurvey}
        onCancel={mockOnCancel}
        setOpen={mockSetOpen}
      />
    );

    const cancelButton = screen.getByText("common.cancel");
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  describe("onSubmit function", () => {
    test("should handle successful operations", async () => {
      mockCopySurveyAction.mockResolvedValue({
        data: { id: "new-survey-1", environmentId: "env-2" },
      });

      render(
        <CopySurveyForm
          defaultProjects={mockProjects}
          survey={mockSurvey}
          onCancel={mockOnCancel}
          setOpen={mockSetOpen}
        />
      );

      // Call the submit handler directly
      const mockFormData = {
        projects: [
          {
            project: "project-1",
            environments: ["env-2"],
          },
          {
            project: "project-2",
            environments: ["env-3"],
          },
        ],
      };

      await mockSubmitHandler(mockFormData);

      await waitFor(() => {
        expect(mockCopySurveyAction).toHaveBeenCalledTimes(2);
        expect(mockCopySurveyAction).toHaveBeenCalledWith({
          environmentId: "env-1",
          surveyId: "survey-1",
          targetEnvironmentId: "env-2",
        });
        expect(mockCopySurveyAction).toHaveBeenCalledWith({
          environmentId: "env-1",
          surveyId: "survey-1",
          targetEnvironmentId: "env-3",
        });
        expect(mockToastSuccess).toHaveBeenCalledWith("environments.surveys.copy_survey_success");
        expect(mockSetOpen).toHaveBeenCalledWith(false);
      });
    });

    test("should handle partial success with mixed results", async () => {
      mockCopySurveyAction
        .mockResolvedValueOnce({ data: { id: "new-survey-1", environmentId: "env-2" } })
        .mockResolvedValueOnce({ serverError: "Failed to copy" });

      render(
        <CopySurveyForm
          defaultProjects={mockProjects}
          survey={mockSurvey}
          onCancel={mockOnCancel}
          setOpen={mockSetOpen}
        />
      );

      const mockFormData = {
        projects: [
          {
            project: "project-1",
            environments: ["env-2"],
          },
          {
            project: "project-2",
            environments: ["env-3"],
          },
        ],
      };

      await mockSubmitHandler(mockFormData);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "Partially successful: 1 success, 1 error",
          expect.objectContaining({
            icon: expect.anything(),
          })
        );
        expect(mockToastError).toHaveBeenCalledWith(
          "[Project 2] - [development] - Failed to copy",
          expect.objectContaining({
            duration: 2000,
          })
        );
        expect(mockSetOpen).toHaveBeenCalledWith(false);
      });
    });

    test("should handle all failed operations", async () => {
      mockCopySurveyAction
        .mockResolvedValueOnce({ serverError: "Server error 1" })
        .mockResolvedValueOnce({ validationErrors: { surveyId: { _errors: ["Invalid survey ID"] } } });

      render(
        <CopySurveyForm
          defaultProjects={mockProjects}
          survey={mockSurvey}
          onCancel={mockOnCancel}
          setOpen={mockSetOpen}
        />
      );

      const mockFormData = {
        projects: [
          {
            project: "project-1",
            environments: ["env-2"],
          },
          {
            project: "project-2",
            environments: ["env-3"],
          },
        ],
      };

      await mockSubmitHandler(mockFormData);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "[Project 1] - [production] - Server error 1",
          expect.objectContaining({
            duration: 2000,
          })
        );
        expect(mockToastError).toHaveBeenCalledWith(
          "[Project 2] - [development] - Validation error",
          expect.objectContaining({
            duration: 4000,
          })
        );
        expect(mockToastSuccess).not.toHaveBeenCalled();
        expect(mockSetOpen).toHaveBeenCalledWith(false);
      });
    });

    test("should handle exceptions during form submission", async () => {
      mockCopySurveyAction.mockRejectedValue(new Error("Network error"));

      render(
        <CopySurveyForm
          defaultProjects={mockProjects}
          survey={mockSurvey}
          onCancel={mockOnCancel}
          setOpen={mockSetOpen}
        />
      );

      const mockFormData = {
        projects: [
          {
            project: "project-1",
            environments: ["env-2"],
          },
        ],
      };

      await mockSubmitHandler(mockFormData);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("environments.surveys.copy_survey_error");
        expect(mockSetOpen).toHaveBeenCalledWith(false);
      });
    });

    test("should handle staggered error toast durations", async () => {
      mockCopySurveyAction
        .mockResolvedValueOnce({ serverError: "Error 1" })
        .mockResolvedValueOnce({ serverError: "Error 2" })
        .mockResolvedValueOnce({ serverError: "Error 3" });

      render(
        <CopySurveyForm
          defaultProjects={mockProjects}
          survey={mockSurvey}
          onCancel={mockOnCancel}
          setOpen={mockSetOpen}
        />
      );

      const mockFormData = {
        projects: [
          {
            project: "project-1",
            environments: ["env-2"],
          },
          {
            project: "project-2",
            environments: ["env-3", "env-4"],
          },
        ],
      };

      await mockSubmitHandler(mockFormData);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "[Project 1] - [production] - Error 1",
          expect.objectContaining({ duration: 2000 })
        );
        expect(mockToastError).toHaveBeenCalledWith(
          "[Project 2] - [development] - Error 2",
          expect.objectContaining({ duration: 4000 })
        );
        expect(mockToastError).toHaveBeenCalledWith(
          "[Project 2] - [production] - Error 3",
          expect.objectContaining({ duration: 6000 })
        );
      });
    });

    test("should not call onSurveysCopied when it's not provided", async () => {
      mockCopySurveyAction.mockResolvedValue({
        data: { id: "new-survey-1", environmentId: "env-1" },
      });

      render(
        <CopySurveyForm
          defaultProjects={mockProjects}
          survey={mockSurvey}
          onCancel={mockOnCancel}
          setOpen={mockSetOpen}
          // onSurveysCopied not provided
        />
      );

      const mockFormData = {
        projects: [
          {
            project: "project-1",
            environments: ["env-2"],
          },
        ],
      };

      await mockSubmitHandler(mockFormData);

      await waitFor(() => {
        expect(mockSetOpen).toHaveBeenCalledWith(false);
        // Should not throw an error even when onSurveysCopied is not provided
      });
    });
  });
});
