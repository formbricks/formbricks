import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TActionClass, TActionClassNoCodeConfig, TActionClassType } from "@formbricks/types/action-classes";
import { ActionSettingsTab } from "./ActionSettingsTab";

// Mock actions
vi.mock("@/app/(app)/environments/[environmentId]/actions/actions", () => ({
  deleteActionClassAction: vi.fn(),
  updateActionClassAction: vi.fn(),
}));

// Mock utils
vi.mock("@/app/lib/actionClass/actionClass", () => ({
  isValidCssSelector: vi.fn((selector) => selector !== "invalid-selector"),
}));

// Mock UI components
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, variant, loading, ...props }: any) => (
    <button onClick={onClick} data-variant={variant} disabled={loading} {...props}>
      {loading ? "Loading..." : children}
    </button>
  ),
}));
vi.mock("@/modules/ui/components/code-action-form", () => ({
  CodeActionForm: ({ isReadOnly }: { isReadOnly: boolean }) => (
    <div data-testid="code-action-form" data-readonly={isReadOnly}>
      Code Action Form
    </div>
  ),
}));
vi.mock("@/modules/ui/components/delete-dialog", () => ({
  DeleteDialog: ({ open, setOpen, isDeleting, onDelete }: any) =>
    open ? (
      <div data-testid="delete-dialog">
        <span>Delete Dialog</span>
        <button onClick={onDelete} disabled={isDeleting}>
          {isDeleting ? "Deleting..." : "Confirm Delete"}
        </button>
        <button onClick={() => setOpen(false)}>Cancel</button>
      </div>
    ) : null,
}));
vi.mock("@/modules/ui/components/no-code-action-form", () => ({
  NoCodeActionForm: ({ isReadOnly }: { isReadOnly: boolean }) => (
    <div data-testid="no-code-action-form" data-readonly={isReadOnly}>
      No Code Action Form
    </div>
  ),
}));

// Mock icons
vi.mock("lucide-react", () => ({
  TrashIcon: () => <div data-testid="trash-icon">Trash</div>,
}));

const mockSetOpen = vi.fn();
const mockActionClasses: TActionClass[] = [
  {
    id: "action1",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Existing Action",
    description: "An existing action",
    type: "noCode",
    environmentId: "env1",
    noCodeConfig: { type: "click" } as TActionClassNoCodeConfig,
  } as unknown as TActionClass,
];

const createMockActionClass = (id: string, type: TActionClassType, name: string): TActionClass =>
  ({
    id,
    createdAt: new Date(),
    updatedAt: new Date(),
    name,
    description: `${name} description`,
    type,
    environmentId: "env1",
    ...(type === "code" && { key: `${name}-key` }),
    ...(type === "noCode" && {
      noCodeConfig: { type: "url", rule: "exactMatch", value: `http://${name}.com` },
    }),
  }) as unknown as TActionClass;

describe("ActionSettingsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders correctly for 'code' action type", () => {
    const actionClass = createMockActionClass("code1", "code", "Code Action");
    render(
      <ActionSettingsTab
        actionClass={actionClass}
        actionClasses={mockActionClasses}
        setOpen={mockSetOpen}
        isReadOnly={false}
      />
    );

    // Use getByPlaceholderText or getByLabelText now that Input isn't mocked
    expect(screen.getByPlaceholderText("environments.actions.eg_clicked_download")).toHaveValue(
      actionClass.name
    );
    expect(screen.getByPlaceholderText("environments.actions.user_clicked_download_button")).toHaveValue(
      actionClass.description
    );
    expect(screen.getByTestId("code-action-form")).toBeInTheDocument();
    expect(
      screen.getByText("environments.actions.this_is_a_code_action_please_make_changes_in_your_code_base")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.save_changes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /common.delete/ })).toBeInTheDocument();
  });

  test("renders correctly for 'noCode' action type", () => {
    const actionClass = createMockActionClass("noCode1", "noCode", "No Code Action");
    render(
      <ActionSettingsTab
        actionClass={actionClass}
        actionClasses={mockActionClasses}
        setOpen={mockSetOpen}
        isReadOnly={false}
      />
    );

    // Use getByPlaceholderText or getByLabelText now that Input isn't mocked
    expect(screen.getByPlaceholderText("environments.actions.eg_clicked_download")).toHaveValue(
      actionClass.name
    );
    expect(screen.getByPlaceholderText("environments.actions.user_clicked_download_button")).toHaveValue(
      actionClass.description
    );
    expect(screen.getByTestId("no-code-action-form")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.save_changes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /common.delete/ })).toBeInTheDocument();
  });

  test("handles successful deletion", async () => {
    const actionClass = createMockActionClass("noCode1", "noCode", "No Code Action");
    const { deleteActionClassAction } = await import(
      "@/app/(app)/environments/[environmentId]/actions/actions"
    );
    vi.mocked(deleteActionClassAction).mockResolvedValue({ data: actionClass } as any);

    render(
      <ActionSettingsTab
        actionClass={actionClass}
        actionClasses={mockActionClasses}
        setOpen={mockSetOpen}
        isReadOnly={false}
      />
    );

    const deleteButtonTrigger = screen.getByRole("button", { name: /common.delete/ });
    await userEvent.click(deleteButtonTrigger);

    expect(screen.getByTestId("delete-dialog")).toBeInTheDocument();

    const confirmDeleteButton = screen.getByRole("button", { name: "Confirm Delete" });
    await userEvent.click(confirmDeleteButton);

    await waitFor(() => {
      expect(deleteActionClassAction).toHaveBeenCalledWith({ actionClassId: actionClass.id });
      expect(toast.success).toHaveBeenCalledWith("environments.actions.action_deleted_successfully");
      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });
  });

  test("handles deletion failure", async () => {
    const actionClass = createMockActionClass("noCode1", "noCode", "No Code Action");
    const { deleteActionClassAction } = await import(
      "@/app/(app)/environments/[environmentId]/actions/actions"
    );
    vi.mocked(deleteActionClassAction).mockRejectedValue(new Error("Deletion failed"));

    render(
      <ActionSettingsTab
        actionClass={actionClass}
        actionClasses={mockActionClasses}
        setOpen={mockSetOpen}
        isReadOnly={false}
      />
    );

    const deleteButtonTrigger = screen.getByRole("button", { name: /common.delete/ });
    await userEvent.click(deleteButtonTrigger);
    const confirmDeleteButton = screen.getByRole("button", { name: "Confirm Delete" });
    await userEvent.click(confirmDeleteButton);

    await waitFor(() => {
      expect(deleteActionClassAction).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("common.something_went_wrong_please_try_again");
    });
    expect(mockSetOpen).not.toHaveBeenCalled();
  });

  test("renders read-only state correctly", () => {
    const actionClass = createMockActionClass("noCode1", "noCode", "No Code Action");
    render(
      <ActionSettingsTab
        actionClass={actionClass}
        actionClasses={mockActionClasses}
        setOpen={mockSetOpen}
        isReadOnly={true} // Set to read-only
      />
    );

    // Use getByPlaceholderText or getByLabelText now that Input isn't mocked
    expect(screen.getByPlaceholderText("environments.actions.eg_clicked_download")).toBeDisabled();
    expect(screen.getByPlaceholderText("environments.actions.user_clicked_download_button")).toBeDisabled();
    expect(screen.getByTestId("no-code-action-form")).toHaveAttribute("data-readonly", "true");
    expect(screen.queryByRole("button", { name: "common.save_changes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /common.delete/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "common.read_docs" })).toBeInTheDocument(); // Docs link still visible
  });

  test("prevents delete when read-only", async () => {
    const actionClass = createMockActionClass("noCode1", "noCode", "No Code Action");
    const { deleteActionClassAction } = await import(
      "@/app/(app)/environments/[environmentId]/actions/actions"
    );

    // Render with isReadOnly=true, but simulate a delete attempt
    render(
      <ActionSettingsTab
        actionClass={actionClass}
        actionClasses={mockActionClasses}
        setOpen={mockSetOpen}
        isReadOnly={true}
      />
    );

    // Try to open and confirm delete dialog (buttons won't exist, so we simulate the flow)
    // This test primarily checks the logic within handleDeleteAction if it were called.
    // A better approach might be to export handleDeleteAction for direct testing,
    // but for now, we assume the UI prevents calling it.

    // We can assert that the delete button isn't there to prevent the flow
    expect(screen.queryByRole("button", { name: /common.delete/ })).not.toBeInTheDocument();
    expect(deleteActionClassAction).not.toHaveBeenCalled();
  });

  test("renders docs link correctly", () => {
    const actionClass = createMockActionClass("noCode1", "noCode", "No Code Action");
    render(
      <ActionSettingsTab
        actionClass={actionClass}
        actionClasses={mockActionClasses}
        setOpen={mockSetOpen}
        isReadOnly={false}
      />
    );
    const docsLink = screen.getByRole("link", { name: "common.read_docs" });
    expect(docsLink).toHaveAttribute("href", "https://formbricks.com/docs/actions/no-code");
    expect(docsLink).toHaveAttribute("target", "_blank");
  });
});
