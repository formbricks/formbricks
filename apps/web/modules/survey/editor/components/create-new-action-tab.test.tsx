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

// Mock action-utils functions
vi.mock("../lib/action-utils", () => ({
  useActionClassKeys: vi.fn(() => []),
  createActionClassZodResolver: vi.fn(() => () => ({ errors: {}, isValid: true })),
  validatePermissions: vi.fn(),
}));

// Mock action-builder functions
vi.mock("../lib/action-builder", () => ({
  buildActionObject: vi.fn((data) => data),
}));

// Mock ActionNameDescriptionFields component
vi.mock("@/modules/ui/components/action-name-description-fields", () => ({
  ActionNameDescriptionFields: vi.fn(({ nameInputId, descriptionInputId }) => (
    <div data-testid="action-name-description-fields">
      <label htmlFor={nameInputId}>What did your user do?</label>
      <input id={nameInputId} name="name" data-testid="name-input" />
      <label htmlFor={descriptionInputId}>Description</label>
      <input id={descriptionInputId} name="description" data-testid="description-input" />
    </div>
  )),
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
    "environments.actions.action_created_successfully": "Action created successfully",
    "environments.actions.action_with_name_already_exists": `Action with name "{{name}}" already exists`,
    "environments.actions.action_with_key_already_exists": `Action with key "{{key}}" already exists`,
    "environments.actions.invalid_css_selector": "Invalid CSS selector",
    "environments.actions.invalid_regex": "Invalid regex pattern",
    "common.you_are_not_authorised_to_perform_this_action": "You are not authorized to perform this action",
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

    // Setup action-utils mocks
    const actionUtilsModule = (await vi.importMock("../lib/action-utils")) as any;
    actionUtilsModule.useActionClassKeys.mockReturnValue([]);
    actionUtilsModule.createActionClassZodResolver.mockReturnValue(() => ({ errors: {}, isValid: true }));
    actionUtilsModule.validatePermissions.mockImplementation(() => {});

    // Setup action-builder mock
    const actionBuilderModule = (await vi.importMock("../lib/action-builder")) as any;
    actionBuilderModule.buildActionObject.mockImplementation((data) => data);
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
    expect(screen.getByTestId("action-name-description-fields")).toBeInTheDocument();
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

    // Form should still render but components should receive isReadOnly prop
    expect(screen.getByText("Action Type")).toBeInTheDocument();
    expect(screen.getByTestId("action-name-description-fields")).toBeInTheDocument();
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
    expect(screen.getByTestId("action-name-description-fields")).toBeInTheDocument();
  });

  test("calls useActionClassKeys with correct arguments", async () => {
    const actionClasses = [
      {
        id: "test-action",
        name: "Test Action",
        environmentId: "test-env-id",
        type: "code",
        key: "test-key",
        description: null,
        noCodeConfig: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ActionClass,
    ];

    const actionUtilsModule = (await vi.importMock("../lib/action-utils")) as any;
    render(<CreateNewActionTab {...defaultProps} actionClasses={actionClasses} />);

    expect(actionUtilsModule.useActionClassKeys).toHaveBeenCalledWith(actionClasses);
  });

  test("renders form with correct resolver configuration", async () => {
    const actionUtilsModule = (await vi.importMock("../lib/action-utils")) as any;

    render(<CreateNewActionTab {...defaultProps} />);

    // Verify that the resolver is configured correctly
    expect(actionUtilsModule.createActionClassZodResolver).toHaveBeenCalledWith(
      [], // actionClassNames
      [], // actionClassKeys
      mockT
    );
  });

  test("handles validation errors correctly", async () => {
    // Mock form validation to fail
    const actionUtilsModule = (await vi.importMock("../lib/action-utils")) as any;
    actionUtilsModule.createActionClassZodResolver.mockReturnValue(() => ({
      errors: { name: { message: "Name is required" } },
      isValid: false,
    }));

    render(<CreateNewActionTab {...defaultProps} />);

    const submitButton = screen.getByRole("button", { name: "Create Action" });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Since validation fails, buildActionObject should not be called
    const { buildActionObject } = await import("../lib/action-builder");
    expect(buildActionObject).not.toHaveBeenCalled();
  });

  test("handles readonly permissions correctly", async () => {
    const { validatePermissions } = await import("../lib/action-utils");
    const toast = await import("react-hot-toast");

    // Make validatePermissions throw for readonly
    const actionUtilsModule = (await vi.importMock("../lib/action-utils")) as any;
    actionUtilsModule.validatePermissions.mockImplementation(() => {
      throw new Error("You are not authorized to perform this action");
    });

    render(<CreateNewActionTab {...defaultProps} isReadOnly={true} />);

    const submitButton = screen.getByRole("button", { name: "Create Action" });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(validatePermissions).toHaveBeenCalledWith(true, mockT);
    expect(toast.default.error).toHaveBeenCalledWith("You are not authorized to perform this action");
  });

  test("uses correct action class names and keys for validation", async () => {
    const actionClasses = [
      {
        id: "action1",
        name: "Existing Action",
        environmentId: "test-env-id",
        type: "code",
        key: "existing-key",
        description: null,
        noCodeConfig: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ActionClass,
    ];

    const actionUtilsModule = (await vi.importMock("../lib/action-utils")) as any;
    actionUtilsModule.useActionClassKeys.mockReturnValue(["existing-key"]);

    render(<CreateNewActionTab {...defaultProps} actionClasses={actionClasses} />);

    // Verify that the resolver is configured with existing action names and keys
    expect(actionUtilsModule.createActionClassZodResolver).toHaveBeenCalledWith(
      ["Existing Action"], // actionClassNames
      ["existing-key"], // actionClassKeys
      mockT
    );
  });
});
