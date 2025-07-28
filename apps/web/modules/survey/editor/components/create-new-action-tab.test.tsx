import { ActionClass } from "@prisma/client";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createActionClassAction } from "../actions";
import { CreateNewActionTab } from "./create-new-action-tab";

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

// Mock constants
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
}));

// Mock CSS selector validation
vi.mock("@/app/lib/actionClass/actionClass", () => ({
  isValidCssSelector: vi.fn(() => true),
}));

// Mock the createActionClassAction function
vi.mock("../actions", () => ({
  createActionClassAction: vi.fn(),
}));

// Mock useTranslate hook
const mockT = vi.fn((key: string, params?: any) => {
  const translations: Record<string, string> = {
    "environments.actions.new_action": "New Action",
    "common.no_code": "No Code",
    "common.code": "Code",
    "environments.actions.action_type": "Action Type",
    "environments.actions.what_did_your_user_do": "What did your user do?",
    "common.description": "Description",
    "environments.actions.create_action": "Create Action",
    "common.key": "Key",
    "common.cancel": "Cancel",
  };
  let translation = translations[key] || key;
  if (params) {
    Object.keys(params).forEach((param) => {
      translation = translation.replace(`{{${param}}}`, params[param]);
    });
  }
  return translation;
});

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({ t: mockT }),
}));

describe("CreateNewActionTab", () => {
  const mockPush = vi.fn();
  const mockRefresh = vi.fn();
  const mockCreateActionClassAction = vi.mocked(createActionClassAction);

  const defaultProps = {
    actionClasses: [] as ActionClass[],
    setActionClasses: vi.fn(),
    setOpen: vi.fn(),
    isReadOnly: false,
    setLocalSurvey: vi.fn(),
    environmentId: "test-env-id",
  };

  beforeEach(async () => {
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
    } as any);

    mockCreateActionClassAction.mockResolvedValue({
      data: {
        id: "new-action-id",
        name: "Test Action",
        type: "noCode",
        environmentId: "test-env-id",
        description: null,
        key: null,
        noCodeConfig: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ActionClass,
    });

    // Import and setup the CSS selector mock
    const cssModule = (await vi.importMock("@/app/lib/actionClass/actionClass")) as any;
    cssModule.isValidCssSelector.mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // Basic rendering tests
  test("renders all expected fields and UI elements", () => {
    render(<CreateNewActionTab {...defaultProps} />);

    expect(screen.getByText("Action Type")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "No Code" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Code" })).toBeInTheDocument();
    expect(screen.getByLabelText("What did your user do?")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByTestId("no-code-action-form")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Action" })).toBeInTheDocument();
  });

  test("switches between action forms correctly", async () => {
    render(<CreateNewActionTab {...defaultProps} />);

    // Initially shows no-code form
    expect(screen.getByTestId("no-code-action-form")).toBeInTheDocument();
    expect(screen.queryByTestId("code-action-form")).not.toBeInTheDocument();

    // Switch to code tab
    const codeTab = screen.getByRole("radio", { name: "Code" });
    await act(async () => {
      fireEvent.click(codeTab);
    });

    // Should now show code form
    await waitFor(() => {
      expect(screen.queryByTestId("no-code-action-form")).not.toBeInTheDocument();
      expect(screen.getByTestId("code-action-form")).toBeInTheDocument();
    });
  });

  test("renders readonly state correctly", () => {
    render(<CreateNewActionTab {...defaultProps} isReadOnly={true} />);

    // Form should still render but submit button should be disabled when readonly
    expect(screen.getByText("Action Type")).toBeInTheDocument();
    expect(screen.getByLabelText("What did your user do?")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  test("renders with existing action classes", () => {
    const existingActionClasses: ActionClass[] = [
      {
        id: "existing-action",
        name: "Existing Action",
        environmentId: "test-env-id",
        type: "noCode",
        description: "Existing description",
        key: null,
        noCodeConfig: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    render(<CreateNewActionTab {...defaultProps} actionClasses={existingActionClasses} />);

    // Form should render normally regardless of existing actions
    expect(screen.getByText("Action Type")).toBeInTheDocument();
    expect(screen.getByLabelText("What did your user do?")).toBeInTheDocument();
  });

  test("form fields accept user input", async () => {
    render(<CreateNewActionTab {...defaultProps} />);

    const nameInput = screen.getByLabelText("What did your user do?");
    const descInput = screen.getByLabelText("Description");

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "Test Action Name" } });
      fireEvent.change(descInput, { target: { value: "Test Description" } });
    });

    expect(nameInput).toHaveValue("Test Action Name");
    expect(descInput).toHaveValue("Test Description");
  });

  test("code form shows key field", async () => {
    render(<CreateNewActionTab {...defaultProps} />);

    // Switch to code tab
    const codeTab = screen.getByRole("radio", { name: "Code" });
    await act(async () => {
      fireEvent.click(codeTab);
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Key")).toBeInTheDocument();
    });
  });
});
