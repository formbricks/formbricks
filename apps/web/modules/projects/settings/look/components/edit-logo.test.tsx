import { Project } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EditLogo } from "./edit-logo";

// Mock next/image to render a plain img tag with original src
vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));

// Hoisted mocks
const h = vi.hoisted(() => ({
  mockHandleFileUpload: vi.fn(),
  mockUpdateProjectAction: vi.fn(),
  mockShowStorageNotConfiguredToast: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

// Mocks
vi.mock("@/modules/storage/file-upload", () => ({
  handleFileUpload: h.mockHandleFileUpload,
}));

vi.mock("@/modules/projects/settings/actions", () => ({
  updateProjectAction: h.mockUpdateProjectAction,
}));

vi.mock("@/modules/ui/components/storage-not-configured-toast/lib/utils", () => ({
  showStorageNotConfiguredToast: h.mockShowStorageNotConfiguredToast,
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: h.mockToastSuccess,
    error: h.mockToastError,
  },
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

vi.mock("@/modules/ui/components/file-input", () => ({
  FileInput: vi.fn((props: any) => (
    <div data-testid="file-input">
      <button
        onClick={() => props.onFileUpload(["https://example.com/uploaded-logo.png"])}
        disabled={props.disabled}
        data-testid="file-input-upload-button">
        Upload File
      </button>
    </div>
  )),
}));

vi.mock("@/modules/ui/components/advanced-option-toggle", () => ({
  AdvancedOptionToggle: vi.fn((props: any) => (
    <div data-testid="advanced-option-toggle">
      <input
        type="checkbox"
        checked={props.isChecked}
        onChange={(e) => props.onToggle(e.target.checked)}
        disabled={props.disabled}
        data-testid="background-color-toggle"
      />
      {props.isChecked && props.children}
    </div>
  )),
}));

vi.mock("@/modules/ui/components/color-picker", () => ({
  ColorPicker: vi.fn((props: any) => (
    <input
      type="text"
      value={props.color}
      onChange={(e) => props.onChange(e.target.value)}
      disabled={props.disabled}
      data-testid="color-picker"
    />
  )),
}));

vi.mock("@/modules/ui/components/delete-dialog", () => ({
  DeleteDialog: vi.fn((props: any) => (
    <div data-testid="delete-dialog" style={{ display: props.open ? "block" : "none" }}>
      <button onClick={props.onDelete} data-testid="confirm-delete-button">
        Confirm Delete
      </button>
      <button onClick={() => props.setOpen(false)} data-testid="cancel-delete-button">
        Cancel
      </button>
    </div>
  )),
}));

describe("EditLogo", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockProject = {
    id: "project-123",
    logo: null,
  } as Project;

  const baseProps = {
    project: mockProject,
    environmentId: "env-123",
    isReadOnly: false,
    isStorageConfigured: true,
  };

  test("renders FileInput when no logo exists", () => {
    render(<EditLogo {...baseProps} />);
    expect(screen.getByTestId("file-input")).toBeInTheDocument();
    expect(screen.getByTestId("file-input-upload-button")).toBeInTheDocument();
  });

  test("renders logo image when logo exists", () => {
    const projectWithLogo = {
      ...mockProject,
      logo: { url: "https://example.com/logo.png", bgColor: "#ffffff" },
    } as Project;

    render(<EditLogo {...baseProps} project={projectWithLogo} />);

    const logoImage = screen.getByAltText("Logo");
    expect(logoImage).toBeInTheDocument();
    expect(logoImage.getAttribute("src")).toBe("https://example.com/logo.png");
  });

  test("shows read-only warning when isReadOnly is true", () => {
    render(<EditLogo {...baseProps} isReadOnly={true} />);
    expect(
      screen.getByText("common.only_owners_managers_and_manage_access_members_can_perform_this_action")
    ).toBeInTheDocument();
  });

  test("uploads file via FileInput and enters editing mode", async () => {
    render(<EditLogo {...baseProps} />);
    const user = userEvent.setup();

    const uploadButton = screen.getByTestId("file-input-upload-button");
    await user.click(uploadButton);

    // Should show the uploaded logo
    await waitFor(() => {
      expect(screen.getByAltText("Logo")).toBeInTheDocument();
    });

    // Should show editing controls
    expect(screen.getByText("environments.project.look.replace_logo")).toBeInTheDocument();
    expect(screen.getByText("environments.project.look.remove_logo")).toBeInTheDocument();
    expect(screen.getByText("common.save")).toBeInTheDocument();
  });

  test("isStorageConfigured=false shows toast on file change", async () => {
    render(<EditLogo {...baseProps} isStorageConfigured={false} />);
    const user = userEvent.setup();

    // Get the hidden file input
    const fileInput = screen.getByDisplayValue("") as HTMLInputElement;
    const file = new File(["dummy"], "logo.png", { type: "image/png" });

    await user.upload(fileInput, file);

    expect(h.mockShowStorageNotConfiguredToast).toHaveBeenCalled();
    expect(h.mockHandleFileUpload).not.toHaveBeenCalled();
  });

  test("isStorageConfigured=false shows toast on replace logo button click", async () => {
    const projectWithLogo = {
      ...mockProject,
      logo: { url: "https://example.com/logo.png" },
    } as Project;

    render(<EditLogo {...baseProps} project={projectWithLogo} isStorageConfigured={false} />);
    const user = userEvent.setup();

    // First click edit to get into editing mode
    const editButton = screen.getByText("common.edit");
    await user.click(editButton);

    // Click replace logo button
    const replaceButton = screen.getByText("environments.project.look.replace_logo");
    await user.click(replaceButton);

    expect(h.mockShowStorageNotConfiguredToast).toHaveBeenCalled();
  });

  test("uploads file via hidden input when storage is configured", async () => {
    h.mockHandleFileUpload.mockResolvedValue({ url: "https://example.com/new-logo.png" });

    render(<EditLogo {...baseProps} />);
    const user = userEvent.setup();

    const fileInput = screen.getByDisplayValue("") as HTMLInputElement;
    const file = new File(["dummy"], "logo.png", { type: "image/png" });

    await user.upload(fileInput, file);

    expect(h.mockHandleFileUpload).toHaveBeenCalledWith(file, "env-123");
    await waitFor(() => {
      expect(screen.getByAltText("Logo")).toBeInTheDocument();
    });
  });

  test("handles file upload error", async () => {
    h.mockHandleFileUpload.mockResolvedValue({ error: "Upload failed" });

    render(<EditLogo {...baseProps} />);
    const user = userEvent.setup();

    const fileInput = screen.getByDisplayValue("") as HTMLInputElement;
    const file = new File(["dummy"], "logo.png", { type: "image/png" });

    await user.upload(fileInput, file);

    expect(h.mockToastError).toHaveBeenCalledWith("Upload failed");
  });

  test("saves changes successfully", async () => {
    h.mockUpdateProjectAction.mockResolvedValue({ data: true });

    const projectWithLogo = {
      ...mockProject,
      logo: { url: "https://example.com/logo.png" },
    } as Project;

    render(<EditLogo {...baseProps} project={projectWithLogo} />);
    const user = userEvent.setup();

    // Click edit to enter editing mode
    const editButton = screen.getByText("common.edit");
    await user.click(editButton);

    // Click save
    const saveButton = screen.getByText("common.save");
    await user.click(saveButton);

    expect(h.mockUpdateProjectAction).toHaveBeenCalledWith({
      projectId: "project-123",
      data: {
        logo: { url: "https://example.com/logo.png", bgColor: undefined },
      },
    });
    expect(h.mockToastSuccess).toHaveBeenCalledWith("environments.project.look.logo_updated_successfully");
  });

  test("handles save error", async () => {
    h.mockUpdateProjectAction.mockResolvedValue({ error: "Save failed" });

    const projectWithLogo = {
      ...mockProject,
      logo: { url: "https://example.com/logo.png" },
    } as Project;

    render(<EditLogo {...baseProps} project={projectWithLogo} />);
    const user = userEvent.setup();

    // Click edit to enter editing mode
    const editButton = screen.getByText("common.edit");
    await user.click(editButton);

    // Click save
    const saveButton = screen.getByText("common.save");
    await user.click(saveButton);

    expect(h.mockToastError).toHaveBeenCalled();
  });

  test("removes logo successfully", async () => {
    h.mockUpdateProjectAction.mockResolvedValue({ data: true });

    const projectWithLogo = {
      ...mockProject,
      logo: { url: "https://example.com/logo.png" },
    } as Project;

    render(<EditLogo {...baseProps} project={projectWithLogo} />);
    const user = userEvent.setup();

    // Click edit to enter editing mode
    const editButton = screen.getByText("common.edit");
    await user.click(editButton);

    // Click remove logo
    const removeButton = screen.getByText("environments.project.look.remove_logo");
    await user.click(removeButton);

    // Confirm deletion
    const confirmButton = screen.getByTestId("confirm-delete-button");
    await user.click(confirmButton);

    expect(h.mockUpdateProjectAction).toHaveBeenCalledWith({
      projectId: "project-123",
      data: {
        logo: { url: undefined, bgColor: undefined },
      },
    });
    expect(h.mockToastSuccess).toHaveBeenCalledWith("environments.project.look.logo_removed_successfully");
  });

  test("toggles background color and updates color picker", async () => {
    const projectWithLogo = {
      ...mockProject,
      logo: { url: "https://example.com/logo.png" },
    } as Project;

    render(<EditLogo {...baseProps} project={projectWithLogo} />);
    const user = userEvent.setup();

    // Click edit to enter editing mode
    const editButton = screen.getByText("common.edit");
    await user.click(editButton);

    // Toggle background color on
    const bgColorToggle = screen.getByTestId("background-color-toggle");
    await user.click(bgColorToggle);

    // Color picker should appear
    const colorPicker = screen.getByTestId("color-picker");
    expect(colorPicker).toBeInTheDocument();
    expect(colorPicker).toHaveValue("#f8f8f8");

    // Change color
    await user.click(colorPicker);
    await user.keyboard("#ff0000");

    // Toggle background color off
    await user.click(bgColorToggle);

    // Color picker should disappear
    expect(screen.queryByTestId("color-picker")).not.toBeInTheDocument();
  });

  test("disables controls when isReadOnly is true", () => {
    const projectWithLogo = {
      ...mockProject,
      logo: { url: "https://example.com/logo.png" },
    } as Project;

    render(<EditLogo {...baseProps} project={projectWithLogo} isReadOnly={true} />);

    const fileInput = screen.getByDisplayValue("") as HTMLInputElement;
    expect(fileInput).toBeDisabled();

    // Edit button should be disabled
    const editButton = screen.getByText("common.edit");
    expect(editButton).toBeDisabled();
  });

  test("edit button switches to editing mode", async () => {
    const projectWithLogo = {
      ...mockProject,
      logo: { url: "https://example.com/logo.png" },
    } as Project;

    render(<EditLogo {...baseProps} project={projectWithLogo} />);
    const user = userEvent.setup();

    // Initially shows "Edit" button
    const editButton = screen.getByText("common.edit");
    await user.click(editButton);

    // Should show editing controls
    expect(screen.getByText("environments.project.look.replace_logo")).toBeInTheDocument();
    expect(screen.getByText("environments.project.look.remove_logo")).toBeInTheDocument();
    expect(screen.getByText("common.save")).toBeInTheDocument();
  });

  test("passes isStorageConfigured to FileInput", () => {
    const { rerender } = render(<EditLogo {...baseProps} isStorageConfigured={true} />);

    // Check that FileInput is rendered (only when no logo exists)
    expect(screen.getByTestId("file-input")).toBeInTheDocument();

    // Test with isStorageConfigured=false
    rerender(<EditLogo {...baseProps} isStorageConfigured={false} />);
    expect(screen.getByTestId("file-input")).toBeInTheDocument();
  });

  test("saves logo with background color when enabled", async () => {
    h.mockUpdateProjectAction.mockResolvedValue({ data: true });

    const projectWithLogo = {
      ...mockProject,
      logo: { url: "https://example.com/logo.png", bgColor: "#ffffff" },
    } as Project;

    render(<EditLogo {...baseProps} project={projectWithLogo} />);
    const user = userEvent.setup();

    // Click edit to enter editing mode
    const editButton = screen.getByText("common.edit");
    await user.click(editButton);

    // Background color should already be enabled since project has bgColor
    const bgColorToggle = screen.getByTestId("background-color-toggle");
    expect(bgColorToggle).toBeChecked();

    // Color picker should be visible with existing color
    const colorPicker = screen.getByTestId("color-picker");
    expect(colorPicker).toHaveValue("#ffffff");

    // Save without changing color to test the existing behavior
    const saveButton = screen.getByText("common.save");
    await user.click(saveButton);

    expect(h.mockUpdateProjectAction).toHaveBeenCalledWith({
      projectId: "project-123",
      data: {
        logo: { url: "https://example.com/logo.png", bgColor: "#ffffff" },
      },
    });
  });
});
