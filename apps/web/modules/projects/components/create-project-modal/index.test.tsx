import { createProjectAction } from "@/app/(app)/environments/[environmentId]/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { getTeamsByOrganizationIdAction } from "@/modules/projects/settings/actions";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CreateProjectModal } from "./index";

// Mock dependencies
vi.mock("@/app/(app)/environments/[environmentId]/actions", () => ({
  createProjectAction: vi.fn(),
}));

vi.mock("@/modules/projects/settings/actions", () => ({
  getTeamsByOrganizationIdAction: vi.fn(),
}));

vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn(),
}));

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Mock UI components
vi.mock("@/modules/ui/components/dialog", () => ({
  Dialog: ({ open, onOpenChange, children }: any) =>
    open ? (
      <div data-testid="dialog" onClick={() => onOpenChange(false)}>
        {children}
      </div>
    ) : null,
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: any) => <p data-testid="dialog-description">{children}</p>,
  DialogBody: ({ children }: any) => <div data-testid="dialog-body">{children}</div>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
}));

// Create a mutable form mock that can be modified per test
let currentFormMock: any;

const createFormMock = (options: { shouldCallOnSubmit?: boolean; isSubmitting?: boolean } = {}) => ({
  handleSubmit: vi.fn((onSubmit) => (e: any) => {
    e.preventDefault();
    if (options.shouldCallOnSubmit !== false) {
      onSubmit({ name: "Test Project", teamIds: [] });
    }
  }),
  formState: { isSubmitting: options.isSubmitting || false },
  reset: vi.fn(),
  watch: vi.fn(),
  getValues: vi.fn(() => ({ teamIds: [] })),
  setValue: vi.fn(),
  control: {},
});

vi.mock("react-hook-form", () => ({
  useForm: () => currentFormMock,
}));

vi.mock("@/modules/ui/components/form", () => ({
  FormProvider: ({ children }: any) => <div data-testid="form-provider">{children}</div>,
  FormField: ({ render, name }: any) => {
    const field = {
      value: name === "name" ? "Test Project" : [],
      onChange: vi.fn(),
    };
    return render({ field, fieldState: {} });
  },
  FormItem: ({ children }: any) => <div data-testid="form-item">{children}</div>,
  FormLabel: ({ children }: any) => <label data-testid="form-label">{children}</label>,
  FormControl: ({ children }: any) => <div data-testid="form-control">{children}</div>,
  FormError: ({ children }: any) => <span data-testid="form-error">{children}</span>,
}));

vi.mock("@/modules/ui/components/input", () => ({
  Input: (props: any) => <input data-testid="input" {...props} />,
}));

vi.mock("@/modules/ui/components/multi-select", () => ({
  MultiSelect: ({ value, options, onChange, placeholder }: any) => (
    <select
      data-testid="multi-select"
      data-placeholder={placeholder}
      multiple
      value={value}
      onChange={(e) => onChange(Array.from(e.target.selectedOptions, (option) => option.value))}>
      {options.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, type, loading, variant, ...props }: any) => (
    <button
      data-testid={`button-${type || "button"}`}
      data-variant={variant}
      data-loading={loading}
      onClick={onClick}
      type={type}
      {...props}>
      {children}
    </button>
  ),
}));

describe("CreateProjectModal", () => {
  const mockOrganizationTeams = [
    { id: "team-1", name: "Development Team" },
    { id: "team-2", name: "Marketing Team" },
  ];

  const mockProject = {
    id: "project-123",
    name: "Test Project",
    createdAt: new Date(),
    updatedAt: new Date(),
    organizationId: "org-123",
    recontactDays: 7,
    inAppSurveyBranding: true,
    linkSurveyBranding: true,
    config: { channel: "website" as const, industry: "saas" as const },
    placement: "bottomRight" as const,
    clickOutsideClose: true,
    darkOverlay: false,
    brandColor: "#000000",
    highlightBorderColor: "#000000",
    styling: { allowStyleOverwrite: true },
    logo: null,
    languages: [],
    environments: [
      {
        id: "env-123",
        type: "production" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: "project-123",
        appSetupCompleted: false,
      },
    ],
  };

  const defaultProps = {
    open: true,
    setOpen: vi.fn(),
    organizationId: "org-123",
    canDoRoleManagement: true,
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Reset form mock to default
    currentFormMock = createFormMock();

    // Mock successful teams fetch
    vi.mocked(getTeamsByOrganizationIdAction).mockResolvedValue({
      data: mockOrganizationTeams,
    } as any);
  });

  afterEach(() => {
    cleanup();
  });

  test("renders modal when open is true", async () => {
    render(<CreateProjectModal {...defaultProps} />);

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("common.create_project");
    expect(screen.getByTestId("dialog-description")).toHaveTextContent("common.project_creation_description");
    expect(screen.getByTestId("input")).toBeInTheDocument();
  });

  test("does not render when open is false", () => {
    render(<CreateProjectModal {...defaultProps} open={false} />);

    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  test("fetches organization teams on mount", async () => {
    render(<CreateProjectModal {...defaultProps} />);

    await waitFor(() => {
      expect(getTeamsByOrganizationIdAction).toHaveBeenCalledWith({
        organizationId: "org-123",
      });
    });
  });

  test("shows team selection when canDoRoleManagement is true and teams exist", async () => {
    render(<CreateProjectModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId("multi-select")).toBeInTheDocument();
    });

    const multiSelect = screen.getByTestId("multi-select");
    expect(multiSelect).toHaveAttribute("data-placeholder", "common.select_teams");

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("Development Team");
    expect(options[1]).toHaveTextContent("Marketing Team");
  });

  test("hides team selection when canDoRoleManagement is false", async () => {
    render(<CreateProjectModal {...defaultProps} canDoRoleManagement={false} />);

    await waitFor(() => {
      expect(screen.queryByTestId("multi-select")).not.toBeInTheDocument();
    });
  });

  test("hides team selection when no teams exist", async () => {
    vi.mocked(getTeamsByOrganizationIdAction).mockResolvedValue({
      data: [],
    } as any);

    render(<CreateProjectModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.queryByTestId("multi-select")).not.toBeInTheDocument();
    });
  });

  test("handles teams fetch error", async () => {
    const errorMessage = "Failed to fetch teams";
    vi.mocked(getTeamsByOrganizationIdAction).mockResolvedValue({
      serverError: "Failed to fetch teams",
    } as any);
    vi.mocked(getFormattedErrorMessage).mockReturnValue(errorMessage);

    render(<CreateProjectModal {...defaultProps} />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(errorMessage);
    });
  });

  test("submits form with project name only when no teams selected", async () => {
    const user = userEvent.setup();

    vi.mocked(createProjectAction).mockResolvedValue({ data: mockProject } as any);

    render(<CreateProjectModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId("input")).toBeInTheDocument();
    });

    const submitButton = screen.getByTestId("button-submit");
    await user.click(submitButton);

    await waitFor(() => {
      expect(createProjectAction).toHaveBeenCalledWith({
        organizationId: "org-123",
        data: {
          name: "Test Project",
          teamIds: [],
        },
      });
    });
  });

  test("submits form with selected teams", async () => {
    const user = userEvent.setup();

    // Update form mock to return teams
    currentFormMock = createFormMock();
    currentFormMock.handleSubmit = vi.fn((onSubmit) => (e: any) => {
      e.preventDefault();
      onSubmit({ name: "Test Project", teamIds: ["team-1", "team-2"] });
    });

    vi.mocked(createProjectAction).mockResolvedValue({ data: mockProject } as any);

    render(<CreateProjectModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId("input")).toBeInTheDocument();
      expect(screen.getByTestId("multi-select")).toBeInTheDocument();
    });

    const submitButton = screen.getByTestId("button-submit");
    await user.click(submitButton);

    await waitFor(() => {
      expect(createProjectAction).toHaveBeenCalledWith({
        organizationId: "org-123",
        data: {
          name: "Test Project",
          teamIds: ["team-1", "team-2"],
        },
      });
    });
  });

  test("shows success message and redirects on successful creation", async () => {
    const user = userEvent.setup();

    vi.mocked(createProjectAction).mockResolvedValue({ data: mockProject } as any);

    render(<CreateProjectModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId("input")).toBeInTheDocument();
    });

    const submitButton = screen.getByTestId("button-submit");
    await user.click(submitButton);

    await waitFor(() => {
      expect(createProjectAction).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Project created successfully");
      expect(defaultProps.setOpen).toHaveBeenCalledWith(false);
      expect(mockPush).toHaveBeenCalledWith("/environments/env-123/surveys");
    });
  });

  test("shows error message on creation failure", async () => {
    const user = userEvent.setup();
    const errorMessage = "Project creation failed";

    vi.mocked(createProjectAction).mockResolvedValue({
      serverError: "Creation failed",
    } as any);
    vi.mocked(getFormattedErrorMessage).mockReturnValue(errorMessage);

    render(<CreateProjectModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId("input")).toBeInTheDocument();
    });

    const submitButton = screen.getByTestId("button-submit");
    await user.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(errorMessage);
    });
  });

  test("closes modal and resets form when cancel button clicked", async () => {
    const user = userEvent.setup();

    render(<CreateProjectModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId("input")).toBeInTheDocument();
    });

    const cancelButton = screen.getByTestId("button-button");
    await user.click(cancelButton);

    expect(defaultProps.setOpen).toHaveBeenCalledWith(false);
  });

  test("shows loading state during form submission", async () => {
    // Mock loading state
    currentFormMock = createFormMock({ isSubmitting: true });

    vi.mocked(createProjectAction).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: mockProject }), 100))
    );

    render(<CreateProjectModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId("input")).toBeInTheDocument();
    });

    // Check that loading state is shown
    const submitButton = screen.getByTestId("button-submit");
    expect(submitButton).toHaveAttribute("data-loading", "true");
  });

  test("handles form validation errors", async () => {
    const user = userEvent.setup();

    // Mock form with validation error - don't call onSubmit
    currentFormMock = createFormMock({ shouldCallOnSubmit: false });

    render(<CreateProjectModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId("input")).toBeInTheDocument();
    });

    const submitButton = screen.getByTestId("button-submit");
    await user.click(submitButton);

    // Form should not submit if validation fails
    expect(createProjectAction).not.toHaveBeenCalled();
  });

  test("closes modal when dialog background is clicked", async () => {
    const user = userEvent.setup();

    render(<CreateProjectModal {...defaultProps} />);

    const dialog = screen.getByTestId("dialog");
    await user.click(dialog);

    expect(defaultProps.setOpen).toHaveBeenCalledWith(false);
  });
});
