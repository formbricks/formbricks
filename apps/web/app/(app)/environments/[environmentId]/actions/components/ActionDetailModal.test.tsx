import { ModalWithTabs } from "@/modules/ui/components/modal-with-tabs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TActionClass } from "@formbricks/types/action-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { ActionActivityTab } from "./ActionActivityTab";
import { ActionDetailModal } from "./ActionDetailModal";
// Import mocked components
import { ActionSettingsTab } from "./ActionSettingsTab";

// Mock child components
vi.mock("@/modules/ui/components/modal-with-tabs", () => ({
  ModalWithTabs: vi.fn(({ tabs, icon, label, description, open, setOpen }) => (
    <div data-testid="modal-with-tabs">
      <span data-testid="modal-label">{label}</span>
      <span data-testid="modal-description">{description}</span>
      <span data-testid="modal-open">{open.toString()}</span>
      <button onClick={() => setOpen(false)}>Close</button>
      {icon}
      {tabs.map((tab) => (
        <div key={tab.title}>
          <h2>{tab.title}</h2>
          {tab.children}
        </div>
      ))}
    </div>
  )),
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

  test("renders ModalWithTabs with correct props", () => {
    render(<ActionDetailModal {...defaultProps} />);

    const mockedModalWithTabs = vi.mocked(ModalWithTabs);

    expect(mockedModalWithTabs).toHaveBeenCalled();
    const props = mockedModalWithTabs.mock.calls[0][0];

    // Check basic props
    expect(props.open).toBe(true);
    expect(props.setOpen).toBe(mockSetOpen);
    expect(props.label).toBe(mockActionClass.name);
    expect(props.description).toBe(mockActionClass.description);

    // Check icon data-testid based on the mock for the default 'code' type
    expect(props.icon).toBeDefined();
    if (!props.icon) {
      throw new Error("Icon prop is not defined");
    }
    expect((props.icon as any).props["data-testid"]).toBe("code-icon");

    // Check tabs structure
    expect(props.tabs).toHaveLength(2);
    expect(props.tabs[0].title).toBe("common.activity");
    expect(props.tabs[1].title).toBe("common.settings");

    // Check if the correct mocked components are used as children
    // Access the mocked functions directly
    const mockedActionActivityTab = vi.mocked(ActionActivityTab);
    const mockedActionSettingsTab = vi.mocked(ActionSettingsTab);

    if (!props.tabs[0].children || !props.tabs[1].children) {
      throw new Error("Tabs children are not defined");
    }

    expect((props.tabs[0].children as any).type).toBe(mockedActionActivityTab);
    expect((props.tabs[1].children as any).type).toBe(mockedActionSettingsTab);

    // Check props passed to child components
    const activityTabProps = (props.tabs[0].children as any).props;
    expect(activityTabProps.otherEnvActionClasses).toBe(mockOtherEnvActionClasses);
    expect(activityTabProps.otherEnvironment).toBe(mockOtherEnvironment);
    expect(activityTabProps.isReadOnly).toBe(false);
    expect(activityTabProps.environment).toBe(mockEnvironment);
    expect(activityTabProps.actionClass).toBe(mockActionClass);
    expect(activityTabProps.environmentId).toBe(mockEnvironmentId);

    const settingsTabProps = (props.tabs[1].children as any).props;
    expect(settingsTabProps.actionClass).toBe(mockActionClass);
    expect(settingsTabProps.actionClasses).toBe(mockActionClasses);
    expect(settingsTabProps.setOpen).toBe(mockSetOpen);
    expect(settingsTabProps.isReadOnly).toBe(false);
  });

  test("renders correct icon based on action type", () => {
    // Test with 'noCode' type
    const noCodeAction: TActionClass = { ...mockActionClass, type: "noCode" } as TActionClass;
    render(<ActionDetailModal {...defaultProps} actionClass={noCodeAction} />);

    const mockedModalWithTabs = vi.mocked(ModalWithTabs);
    const props = mockedModalWithTabs.mock.calls[0][0];

    // Expect the 'nocode-icon' based on the updated mock and action type
    expect(props.icon).toBeDefined();

    if (!props.icon) {
      throw new Error("Icon prop is not defined");
    }

    expect((props.icon as any).props["data-testid"]).toBe("nocode-icon");
  });

  test("passes isReadOnly prop correctly", () => {
    render(<ActionDetailModal {...defaultProps} isReadOnly={true} />);
    // Access the mocked component directly
    const mockedModalWithTabs = vi.mocked(ModalWithTabs);
    const props = mockedModalWithTabs.mock.calls[0][0];

    if (!props.tabs[0].children || !props.tabs[1].children) {
      throw new Error("Tabs children are not defined");
    }

    const activityTabProps = (props.tabs[0].children as any).props;
    expect(activityTabProps.isReadOnly).toBe(true);

    const settingsTabProps = (props.tabs[1].children as any).props;
    expect(settingsTabProps.isReadOnly).toBe(true);
  });
});
