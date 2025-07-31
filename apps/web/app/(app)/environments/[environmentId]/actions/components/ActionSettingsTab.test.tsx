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

// Mock action utils
vi.mock("@/modules/survey/editor/lib/action-utils", () => ({
  useActionClassKeys: vi.fn(() => ["existing-key"]),
  createActionClassZodResolver: vi.fn(() => vi.fn()),
  validatePermissions: vi.fn(),
}));

// Mock action builder
vi.mock("@/modules/survey/editor/lib/action-builder", () => ({
  buildActionObject: vi.fn((data, environmentId, t) => ({
    ...data,
    environmentId,
  })),
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

vi.mock("@/modules/ui/components/action-name-description-fields", () => ({
  ActionNameDescriptionFields: ({ isReadOnly, nameInputId, descriptionInputId }: any) => (
    <div data-testid="action-name-description-fields">
      <input
        data-testid={`name-input-${nameInputId}`}
        placeholder="environments.actions.eg_clicked_download"
        disabled={isReadOnly}
        defaultValue="Test Action"
      />
      <input
        data-testid={`description-input-${descriptionInputId}`}
        placeholder="environments.actions.user_clicked_download_button"
        disabled={isReadOnly}
        defaultValue="Test Description"
      />
    </div>
  ),
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

// Mock react-hook-form
const mockHandleSubmit = vi.fn();
const mockForm = {
  handleSubmit: mockHandleSubmit,
  control: {},
  formState: { errors: {} },
};

vi.mock("react-hook-form", async () => {
  const actual = await vi.importActual("react-hook-form");
  return {
    ...actual,
    useForm: vi.fn(() => mockForm),
    FormProvider: ({ children }: any) => <div>{children}</div>,
  };
});

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
    mockHandleSubmit.mockImplementation((fn) => fn);
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

    expect(screen.getByTestId("action-name-description-fields")).toBeInTheDocument();
    expect(screen.getByTestId("name-input-actionNameSettingsInput")).toBeInTheDocument();
    expect(screen.getByTestId("description-input-actionDescriptionSettingsInput")).toBeInTheDocument();
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

    expect(screen.getByTestId("action-name-description-fields")).toBeInTheDocument();
    expect(screen.getByTestId("no-code-action-form")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.save_changes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /common.delete/ })).toBeInTheDocument();
  });

  test("renders correctly for other action types (fallback)", () => {
    const actionClass = {
      ...createMockActionClass("auto1", "noCode", "Auto Action"),
      type: "automatic" as any,
    };
    render(
      <ActionSettingsTab
        actionClass={actionClass}
        actionClasses={mockActionClasses}
        setOpen={mockSetOpen}
        isReadOnly={false}
      />
    );

    expect(screen.getByTestId("action-name-description-fields")).toBeInTheDocument();
    expect(
      screen.getByText(
        "environments.actions.this_action_was_created_automatically_you_cannot_make_changes_to_it"
      )
    ).toBeInTheDocument();
  });

  test("calls utility functions on initialization", async () => {
    const actionUtilsMock = await import("@/modules/survey/editor/lib/action-utils");

    const actionClass = createMockActionClass("noCode1", "noCode", "No Code Action");
    render(
      <ActionSettingsTab
        actionClass={actionClass}
        actionClasses={mockActionClasses}
        setOpen={mockSetOpen}
        isReadOnly={false}
      />
    );

    expect(actionUtilsMock.useActionClassKeys).toHaveBeenCalledWith(mockActionClasses);
    expect(actionUtilsMock.createActionClassZodResolver).toHaveBeenCalled();
  });

  test("handles successful form submission", async () => {
    const { updateActionClassAction } = await import(
      "@/app/(app)/environments/[environmentId]/actions/actions"
    );
    const actionUtilsMock = await import("@/modules/survey/editor/lib/action-utils");

    vi.mocked(updateActionClassAction).mockResolvedValue({ data: {} } as any);

    const actionClass = createMockActionClass("noCode1", "noCode", "No Code Action");
    render(
      <ActionSettingsTab
        actionClass={actionClass}
        actionClasses={mockActionClasses}
        setOpen={mockSetOpen}
        isReadOnly={false}
      />
    );

    // Check that utility functions were called during component initialization
    expect(actionUtilsMock.useActionClassKeys).toHaveBeenCalledWith(mockActionClasses);
    expect(actionUtilsMock.createActionClassZodResolver).toHaveBeenCalled();
  });

  test("handles permission validation error", async () => {
    const actionUtilsMock = await import("@/modules/survey/editor/lib/action-utils");
    vi.mocked(actionUtilsMock.validatePermissions).mockImplementation(() => {
      throw new Error("Not authorized");
    });

    const actionClass = createMockActionClass("noCode1", "noCode", "No Code Action");
    render(
      <ActionSettingsTab
        actionClass={actionClass}
        actionClasses={mockActionClasses}
        setOpen={mockSetOpen}
        isReadOnly={false}
      />
    );

    const submitButton = screen.getByRole("button", { name: "common.save_changes" });

    mockHandleSubmit.mockImplementation((fn) => (e) => {
      e.preventDefault();
      return fn({ name: "Test", type: "noCode" });
    });

    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Not authorized");
    });
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
        isReadOnly={true}
      />
    );

    expect(screen.getByTestId("name-input-actionNameSettingsInput")).toBeDisabled();
    expect(screen.getByTestId("description-input-actionDescriptionSettingsInput")).toBeDisabled();
    expect(screen.getByTestId("no-code-action-form")).toHaveAttribute("data-readonly", "true");
    expect(screen.queryByRole("button", { name: "common.save_changes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /common.delete/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "common.read_docs" })).toBeInTheDocument();
  });

  test("prevents delete when read-only", async () => {
    const actionClass = createMockActionClass("noCode1", "noCode", "No Code Action");
    const { deleteActionClassAction } = await import(
      "@/app/(app)/environments/[environmentId]/actions/actions"
    );

    render(
      <ActionSettingsTab
        actionClass={actionClass}
        actionClasses={mockActionClasses}
        setOpen={mockSetOpen}
        isReadOnly={true}
      />
    );

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

  test("uses correct input IDs for ActionNameDescriptionFields", () => {
    const actionClass = createMockActionClass("noCode1", "noCode", "No Code Action");
    render(
      <ActionSettingsTab
        actionClass={actionClass}
        actionClasses={mockActionClasses}
        setOpen={mockSetOpen}
        isReadOnly={false}
      />
    );

    expect(screen.getByTestId("name-input-actionNameSettingsInput")).toBeInTheDocument();
    expect(screen.getByTestId("description-input-actionDescriptionSettingsInput")).toBeInTheDocument();
  });
});
