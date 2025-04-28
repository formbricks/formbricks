import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TProject } from "@formbricks/types/project";
import { AddApiKeyModal } from "./add-api-key-modal";

// Mock the translate hook
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key, // Return the key as is for testing
  }),
}));

// Base project definition (customize as needed)
const baseProject = {
  id: "project1",
  name: "Project 1",
  createdAt: new Date(),
  updatedAt: new Date(),
  organizationId: "org1",
  styling: {
    allowStyleOverwrite: true,
    brandColor: { light: "#000000" },
  },
  recontactDays: 0,
  inAppSurveyBranding: false,
  linkSurveyBranding: false,
  config: {
    channel: "link" as const,
    industry: "saas" as const,
  },
  placement: "bottomLeft" as const,
  clickOutsideClose: true,
  darkOverlay: false,
  languages: [],
};

const mockProjects: TProject[] = [
  {
    ...baseProject,
    environments: [
      {
        id: "env1",
        type: "production",
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: "project1",
        appSetupCompleted: true,
      },
      {
        id: "env2",
        type: "development",
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: "project1",
        appSetupCompleted: true,
      },
    ],
  } as TProject,
  {
    ...baseProject,
    id: "project2",
    name: "Project 2",
    environments: [
      {
        id: "env3",
        type: "production",
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: "project2",
        appSetupCompleted: true,
      },
      {
        id: "env4",
        type: "development",
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: "project2",
        appSetupCompleted: true,
      },
    ],
  } as TProject,
];

describe("AddApiKeyModal", () => {
  const mockSetOpen = vi.fn();
  const mockOnSubmit = vi.fn();

  const defaultProps = {
    open: true,
    setOpen: mockSetOpen,
    onSubmit: mockOnSubmit,
    projects: mockProjects,
    isCreatingAPIKey: false,
  };

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders the modal with initial state", () => {
    render(<AddApiKeyModal {...defaultProps} />);
    const modalTitle = screen.getByText("environments.project.api_keys.add_api_key", {
      selector: "div.text-xl",
    });

    expect(modalTitle).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. GitHub, PostHog, Slack")).toBeInTheDocument();
    expect(screen.getByText("environments.project.api_keys.project_access")).toBeInTheDocument();
  });

  test("handles label input", async () => {
    render(<AddApiKeyModal {...defaultProps} />);
    const labelInput = screen.getByPlaceholderText("e.g. GitHub, PostHog, Slack") as HTMLInputElement;

    await userEvent.type(labelInput, "Test API Key");
    expect(labelInput.value).toBe("Test API Key");
  });

  test("handles permission changes", async () => {
    render(<AddApiKeyModal {...defaultProps} />);

    const addButton = screen.getByRole("button", { name: /add_permission/i });
    await userEvent.click(addButton);

    // Open project dropdown for the first permission row
    const projectDropdowns = screen.getAllByRole("button", { name: /Project 1/i });
    await userEvent.click(projectDropdowns[0]);

    // Wait for dropdown content and select 'Project 2'
    const project2Option = await screen.findByRole("menuitem", { name: "Project 2" });
    await userEvent.click(project2Option);

    // Verify project selection by checking the updated button text
    const updatedButton = await screen.findByRole("button", { name: "Project 2" });
    expect(updatedButton).toBeInTheDocument();
  });

  test("adds and removes permissions", async () => {
    render(<AddApiKeyModal {...defaultProps} />);

    // Add new permission
    const addButton = screen.getByRole("button", { name: /add_permission/i });
    await userEvent.click(addButton);

    await userEvent.click(addButton);

    // Verify new permission row is added
    const deleteButtons = screen.getAllByRole("button", { name: "" }); // Trash icons
    expect(deleteButtons).toHaveLength(2);

    // Remove the new permission
    await userEvent.click(deleteButtons[1]);

    // Check that only the original permission row remains
    expect(screen.getAllByRole("button", { name: "" })).toHaveLength(1);
  });

  test("submits form with correct data", async () => {
    render(<AddApiKeyModal {...defaultProps} />);

    // Fill in label
    const labelInput = screen.getByPlaceholderText("e.g. GitHub, PostHog, Slack") as HTMLInputElement;
    await userEvent.type(labelInput, "Test API Key");

    const addButton = screen.getByRole("button", { name: /add_permission/i });
    await userEvent.click(addButton);

    // Click submit
    const submitButton = screen.getByRole("button", {
      name: "environments.project.api_keys.add_api_key",
    });
    await userEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith({
      label: "Test API Key",
      environmentPermissions: [
        {
          environmentId: "env1",
          permission: "read",
        },
      ],
      organizationAccess: {
        accessControl: {
          read: false,
          write: false,
        },
      },
    });
  });

  test("submits form with correct data including organization access toggles", async () => {
    render(<AddApiKeyModal {...defaultProps} />);

    // Fill in label
    const labelInput = screen.getByPlaceholderText("e.g. GitHub, PostHog, Slack");
    await userEvent.type(labelInput, "Test API Key");

    // Toggle the first switch (read) under organizationAccess
    const readSwitch = screen.getByTestId("organization-access-accessControl-read"); // first is read, second is write
    await userEvent.click(readSwitch); // toggle 'read' to true

    // Submit form
    const submitButton = screen.getByRole("button", {
      name: "environments.project.api_keys.add_api_key",
    });
    await userEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith({
      label: "Test API Key",
      environmentPermissions: [],
      organizationAccess: {
        accessControl: {
          read: true,
          write: false,
        },
      },
    });
  });

  test("disables submit button when label is empty and there are not environment permissions", async () => {
    render(<AddApiKeyModal {...defaultProps} />);
    const submitButton = screen.getByRole("button", {
      name: "environments.project.api_keys.add_api_key",
    });
    const labelInput = screen.getByPlaceholderText("e.g. GitHub, PostHog, Slack");

    // Initially disabled
    expect(submitButton).toBeDisabled();

    const addButton = screen.getByRole("button", { name: /add_permission/i });
    await userEvent.click(addButton);

    // After typing, it should be enabled
    await userEvent.type(labelInput, "Test");
    expect(submitButton).not.toBeDisabled();
  });

  test("closes modal and resets form on cancel", async () => {
    render(<AddApiKeyModal {...defaultProps} />);

    // Type something into the label
    const labelInput = screen.getByPlaceholderText("e.g. GitHub, PostHog, Slack") as HTMLInputElement;
    await userEvent.type(labelInput, "Test API Key");

    // Click the cancel button
    const cancelButton = screen.getByRole("button", { name: "common.cancel" });
    await userEvent.click(cancelButton);

    // Verify modal is closed and form is reset
    expect(mockSetOpen).toHaveBeenCalledWith(false);
    expect(labelInput.value).toBe("");
  });
});
