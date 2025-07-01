import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TActionClass } from "@formbricks/types/action-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { ActionActivityTab } from "./ActionActivityTab";
import { ActionDetailModal } from "./ActionDetailModal";
// Import mocked components
import { ActionSettingsTab } from "./ActionSettingsTab";

// Mock the Dialog components
vi.mock("@/modules/ui/components/dialog", () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) =>
    open ? (
      <div data-testid="dialog">
        {children}
        <button data-testid="dialog-close" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
    ) : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogBody: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-body">{children}</div>
  ),
}));

vi.mock("./ActionActivityTab", () => ({
  ActionActivityTab: vi.fn(() => <div data-testid="action-activity-tab">ActionActivityTab</div>),
}));

vi.mock("./ActionSettingsTab", () => ({
  ActionSettingsTab: vi.fn(() => <div data-testid="action-settings-tab">ActionSettingsTab</div>),
}));

// Mock the utils file to control ACTION_TYPE_ICON_LOOKUP
vi.mock("@/app/(app)/environments/[environmentId]/actions/utils", () => ({
  ACTION_TYPE_ICON_LOOKUP: {
    code: <div data-testid="code-icon">Code Icon Mock</div>,
    noCode: <div data-testid="nocode-icon">No Code Icon Mock</div>,
    // Add other types if needed by other tests or default props
  },
}));

// Mock useTranslate
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => {
      const translations = {
        "common.activity": "Activity",
        "common.settings": "Settings",
      };
      return translations[key] || key;
    },
  }),
}));

const mockEnvironmentId = "test-env-id";
const mockSetOpen = vi.fn();

const mockEnvironment = {
  id: mockEnvironmentId,
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "production", // Use string literal as TEnvironmentType is not exported
  appSetupCompleted: false,
} as unknown as TEnvironment;

const mockActionClass: TActionClass = {
  id: "action-class-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Action",
  description: "This is a test action",
  type: "code", // Ensure this matches a key in the mocked ACTION_TYPE_ICON_LOOKUP
  environmentId: mockEnvironmentId,
  noCodeConfig: null,
  key: "test-action-key",
};

const mockActionClasses: TActionClass[] = [mockActionClass];
const mockOtherEnvActionClasses: TActionClass[] = [];
const mockOtherEnvironment = { ...mockEnvironment, id: "other-env-id", name: "Other Environment" };

const defaultProps = {
  environmentId: mockEnvironmentId,
  environment: mockEnvironment,
  open: true,
  setOpen: mockSetOpen,
  actionClass: mockActionClass,
  actionClasses: mockActionClasses,
  isReadOnly: false,
  otherEnvironment: mockOtherEnvironment,
  otherEnvActionClasses: mockOtherEnvActionClasses,
};

describe("ActionDetailModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks(); // Clear mocks after each test
  });

  test("renders correctly when open", () => {
    render(<ActionDetailModal {...defaultProps} />);

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Test Action");
    expect(screen.getByTestId("dialog-description")).toHaveTextContent("This is a test action");
    expect(screen.getByTestId("code-icon")).toBeInTheDocument();
    expect(screen.getByText("Activity")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    // Only the first tab (Activity) should be active initially
    expect(screen.getByTestId("action-activity-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("action-settings-tab")).not.toBeInTheDocument();
  });

  test("does not render when open is false", () => {
    render(<ActionDetailModal {...defaultProps} open={false} />);
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  test("switches tabs correctly", async () => {
    const user = userEvent.setup();
    render(<ActionDetailModal {...defaultProps} />);

    // Initially shows activity tab (first tab is active)
    expect(screen.getByTestId("action-activity-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("action-settings-tab")).not.toBeInTheDocument();

    // Click settings tab
    const settingsTab = screen.getByText("Settings");
    await user.click(settingsTab);

    // Now shows settings tab content
    expect(screen.queryByTestId("action-activity-tab")).not.toBeInTheDocument();
    expect(screen.getByTestId("action-settings-tab")).toBeInTheDocument();

    // Click activity tab again
    const activityTab = screen.getByText("Activity");
    await user.click(activityTab);

    // Back to activity tab content
    expect(screen.getByTestId("action-activity-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("action-settings-tab")).not.toBeInTheDocument();
  });

  test("resets to first tab when modal is reopened", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ActionDetailModal {...defaultProps} />);

    // Switch to settings tab
    const settingsTab = screen.getByText("Settings");
    await user.click(settingsTab);
    expect(screen.getByTestId("action-settings-tab")).toBeInTheDocument();

    // Close modal
    rerender(<ActionDetailModal {...defaultProps} open={false} />);

    // Reopen modal
    rerender(<ActionDetailModal {...defaultProps} open={true} />);

    // Should be back to activity tab (first tab)
    expect(screen.getByTestId("action-activity-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("action-settings-tab")).not.toBeInTheDocument();
  });

  test("renders correct icon based on action type", () => {
    // Test with 'noCode' type
    const noCodeAction: TActionClass = { ...mockActionClass, type: "noCode" } as TActionClass;
    render(<ActionDetailModal {...defaultProps} actionClass={noCodeAction} />);

    expect(screen.getByTestId("nocode-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("code-icon")).not.toBeInTheDocument();
  });

  test("handles action without description", () => {
    const actionWithoutDescription = { ...mockActionClass, description: "" };
    render(<ActionDetailModal {...defaultProps} actionClass={actionWithoutDescription} />);

    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Test Action");
    expect(screen.getByTestId("dialog-description")).toHaveTextContent("common.code common.action");
  });

  test("passes correct props to ActionActivityTab", () => {
    render(<ActionDetailModal {...defaultProps} />);

    const mockedActionActivityTab = vi.mocked(ActionActivityTab);
    expect(mockedActionActivityTab).toHaveBeenCalledWith(
      {
        otherEnvActionClasses: mockOtherEnvActionClasses,
        otherEnvironment: mockOtherEnvironment,
        isReadOnly: false,
        environment: mockEnvironment,
        actionClass: mockActionClass,
        environmentId: mockEnvironmentId,
      },
      undefined
    );
  });

  test("passes correct props to ActionSettingsTab when tab is active", async () => {
    const user = userEvent.setup();
    render(<ActionDetailModal {...defaultProps} />);

    // ActionSettingsTab should not be called initially since first tab is active
    const mockedActionSettingsTab = vi.mocked(ActionSettingsTab);
    expect(mockedActionSettingsTab).not.toHaveBeenCalled();

    // Click the settings tab to activate ActionSettingsTab
    const settingsTab = screen.getByText("Settings");
    await user.click(settingsTab);

    // Now ActionSettingsTab should be called with correct props
    expect(mockedActionSettingsTab).toHaveBeenCalledWith(
      {
        actionClass: mockActionClass,
        actionClasses: mockActionClasses,
        setOpen: mockSetOpen,
        isReadOnly: false,
      },
      undefined
    );
  });

  test("passes isReadOnly prop correctly", () => {
    render(<ActionDetailModal {...defaultProps} isReadOnly={true} />);

    const mockedActionActivityTab = vi.mocked(ActionActivityTab);
    expect(mockedActionActivityTab).toHaveBeenCalledWith(
      expect.objectContaining({
        isReadOnly: true,
      }),
      undefined
    );
  });
});
