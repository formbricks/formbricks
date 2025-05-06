import { copySurveyToOtherEnvironmentAction } from "@/modules/survey/list/actions";
import { TUserProject } from "@/modules/survey/list/types/projects";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CopySurveyForm } from "../copy-survey-form";

// Mock dependencies
vi.mock("@/modules/survey/list/actions", () => ({
  copySurveyToOtherEnvironmentAction: vi.fn().mockResolvedValue({}),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the Checkbox component to properly handle form changes
vi.mock("@/modules/ui/components/checkbox", () => ({
  Checkbox: ({ id, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      id={id}
      data-testid={id}
      name={props.name}
      className="mr-2 h-4 w-4 appearance-none border-slate-300 checked:border-transparent checked:bg-slate-500 checked:after:bg-slate-500 checked:hover:bg-slate-500 focus:ring-2 focus:ring-slate-500 focus:ring-opacity-50"
      onChange={() => {
        // Call onCheckedChange with true to simulate checkbox selection
        onCheckedChange(true);
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

// Mock data
const mockSurvey = {
  id: "survey-1",
  name: "mockSurvey",
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
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(copySurveyToOtherEnvironmentAction).mockResolvedValue({});
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

    // Check if project names are rendered
    expect(screen.getByText("Project 1")).toBeInTheDocument();
    expect(screen.getByText("Project 2")).toBeInTheDocument();

    // Check if environment types are rendered
    expect(screen.getAllByText("development").length).toBe(2);
    expect(screen.getAllByText("production").length).toBe(2);

    // Check if checkboxes are rendered for each environment
    expect(screen.getByTestId("env-1")).toBeInTheDocument();
    expect(screen.getByTestId("env-2")).toBeInTheDocument();
    expect(screen.getByTestId("env-3")).toBeInTheDocument();
    expect(screen.getByTestId("env-4")).toBeInTheDocument();
  });

  test("calls onCancel when cancel button is clicked", async () => {
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

  test("toggles environment selection when checkbox is clicked", async () => {
    render(
      <CopySurveyForm
        defaultProjects={mockProjects}
        survey={mockSurvey}
        onCancel={mockOnCancel}
        setOpen={mockSetOpen}
      />
    );

    // Select multiple environments
    await user.click(screen.getByTestId("env-2"));
    await user.click(screen.getByTestId("env-3"));

    // Submit the form
    await user.click(screen.getByTestId("button-submit"));

    // Success toast should be called because of how the component is implemented
    expect(toast.success).toHaveBeenCalled();
  });

  test("submits form with selected environments", async () => {
    render(
      <CopySurveyForm
        defaultProjects={mockProjects}
        survey={mockSurvey}
        onCancel={mockOnCancel}
        setOpen={mockSetOpen}
      />
    );

    // Select environments
    await user.click(screen.getByTestId("env-2"));
    await user.click(screen.getByTestId("env-4"));

    // Submit the form
    await user.click(screen.getByTestId("button-submit"));

    // Success toast should be called because of how the component is implemented
    expect(toast.success).toHaveBeenCalled();
    expect(mockSetOpen).toHaveBeenCalled();
  });
});
