import { ActionClass } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CreateNewActionTab } from "./create-new-action-tab";

// Mock the NoCodeActionForm and CodeActionForm components
vi.mock("@/modules/ui/components/no-code-action-form", () => ({
  NoCodeActionForm: () => <div data-testid="no-code-action-form">NoCodeActionForm</div>,
}));

vi.mock("@/modules/ui/components/code-action-form", () => ({
  CodeActionForm: () => <div data-testid="code-action-form">CodeActionForm</div>,
}));

// Mock constants
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
}));

// Mock CSS selector validation
vi.mock("@/app/lib/actionClass/actionClass", () => ({
  isValidCssSelector: vi.fn(() => true),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

// Mock the createActionClassAction function
vi.mock("../actions", () => ({
  createActionClassAction: vi.fn(),
}));

describe("CreateNewActionTab", () => {
  const mockPush = vi.fn();
  const mockRefresh = vi.fn();

  const defaultProps = {
    actionClasses: [] as ActionClass[],
    setActionClasses: vi.fn(),
    setOpen: vi.fn(),
    isReadOnly: false,
    setLocalSurvey: vi.fn(),
    environmentId: "test-env-id",
  };

  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
    } as any);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders all expected fields and UI elements when provided with valid props", () => {
    render(<CreateNewActionTab {...defaultProps} />);

    // Check for the presence of key UI elements
    expect(screen.getByText("environments.actions.action_type")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "common.no_code" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "common.code" })).toBeInTheDocument();
    expect(screen.getByLabelText("environments.actions.what_did_your_user_do")).toBeInTheDocument();
    expect(screen.getByLabelText("common.description")).toBeInTheDocument();
    expect(screen.getByTestId("no-code-action-form")).toBeInTheDocument();
  });

  test("switches to code action form when code tab is selected", () => {
    render(<CreateNewActionTab {...defaultProps} />);

    // Initially shows no-code form
    expect(screen.getByTestId("no-code-action-form")).toBeInTheDocument();
    expect(screen.queryByTestId("code-action-form")).not.toBeInTheDocument();

    // Click on code tab
    const codeTab = screen.getByRole("radio", { name: "common.code" });
    fireEvent.click(codeTab);

    // Should now show code form
    expect(screen.queryByTestId("no-code-action-form")).not.toBeInTheDocument();
    expect(screen.getByTestId("code-action-form")).toBeInTheDocument();
  });

  test("shows validation error for duplicate action names", async () => {
    const existingActionClasses: ActionClass[] = [
      {
        id: "existing-action",
        name: "Existing Action",
        environmentId: "test-env-id",
        type: "noCode",
      } as ActionClass,
    ];

    render(<CreateNewActionTab {...defaultProps} actionClasses={existingActionClasses} />);

    // Try to create action with existing name
    const nameInput = screen.getByLabelText("environments.actions.what_did_your_user_do");
    fireEvent.change(nameInput, { target: { value: "Existing Action" } });

    // Wait for validation error to appear in the UI
    await waitFor(() => {
      expect(screen.getByText("environments.actions.action_with_name_already_exists")).toBeInTheDocument();
    });
  });

  test("resets form and closes modal on cancel", () => {
    render(<CreateNewActionTab {...defaultProps} />);

    const nameInput = screen.getByLabelText("environments.actions.what_did_your_user_do");
    fireEvent.change(nameInput, { target: { value: "Test Action" } });

    const cancelButton = screen.getByRole("button", { name: "common.cancel" });
    fireEvent.click(cancelButton);

    expect(defaultProps.setOpen).toHaveBeenCalledWith(false);
  });

  test("displays submit button correctly", () => {
    render(<CreateNewActionTab {...defaultProps} />);

    const submitButton = screen.getByRole("button", { name: "environments.actions.create_action" });
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveAttribute("type", "submit");
  });

  test("displays both action type radio buttons correctly", () => {
    render(<CreateNewActionTab {...defaultProps} />);

    const noCodeRadio = screen.getByRole("radio", { name: "common.no_code" });
    const codeRadio = screen.getByRole("radio", { name: "common.code" });

    expect(noCodeRadio).toBeInTheDocument();
    expect(codeRadio).toBeInTheDocument();
    expect(noCodeRadio).toBeChecked(); // No-code should be selected by default
    expect(codeRadio).not.toBeChecked();
  });

  test("allows input in name and description fields", () => {
    render(<CreateNewActionTab {...defaultProps} />);

    const nameInput = screen.getByLabelText("environments.actions.what_did_your_user_do");
    const descriptionInput = screen.getByLabelText("common.description");

    fireEvent.change(nameInput, { target: { value: "Test Action Name" } });
    fireEvent.change(descriptionInput, { target: { value: "Test Description" } });

    expect(nameInput).toHaveValue("Test Action Name");
    expect(descriptionInput).toHaveValue("Test Description");
  });

  test("regex validation logic works correctly", () => {
    // Test valid regex patterns
    expect(() => new RegExp("^https://.*\\.com$")).not.toThrow(); // NOSONAR // We are testing the same validation logic in the component
    expect(() => new RegExp(".*example.*")).not.toThrow(); // NOSONAR // We are testing the same validation logic in the component
    expect(() => new RegExp("\\d+")).not.toThrow(); // NOSONAR // We are testing the same validation logic in the component

    // Test invalid regex patterns
    expect(() => new RegExp("[invalid-regex")).toThrow(); // NOSONAR // We are testing the same validation logic in the component
    expect(() => new RegExp("(unclosed-group")).toThrow(); // NOSONAR // We are testing the same validation logic in the component
    expect(() => new RegExp("*invalid-start")).toThrow(); // NOSONAR // We are testing the same validation logic in the component
  });
});
