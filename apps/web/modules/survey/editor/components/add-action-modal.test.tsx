import { AddActionModal } from "@/modules/survey/editor/components/add-action-modal";
import { CreateNewActionTab } from "@/modules/survey/editor/components/create-new-action-tab";
import { SavedActionsTab } from "@/modules/survey/editor/components/saved-actions-tab";
import { ActionClass } from "@prisma/client";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";

// Mock child components
vi.mock("@/modules/survey/editor/components/create-new-action-tab", () => ({
  CreateNewActionTab: vi.fn(() => <div data-testid="create-new-action-tab">CreateNewActionTab Mock</div>),
}));

vi.mock("@/modules/survey/editor/components/saved-actions-tab", () => ({
  SavedActionsTab: vi.fn(() => <div data-testid="saved-actions-tab">SavedActionsTab Mock</div>),
}));

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
  DialogContent: ({
    children,
    disableCloseOnOutsideClick,
  }: {
    children: React.ReactNode;
    disableCloseOnOutsideClick?: boolean;
  }) => (
    <div data-testid="dialog-content" data-disable-close-on-outside-click={disableCloseOnOutsideClick}>
      {children}
    </div>
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

// Mock useTranslate hook
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => {
      const translations = {
        "environments.surveys.edit.select_saved_action": "Select Saved Action",
        "environments.surveys.edit.capture_new_action": "Capture New Action",
        "common.add_action": "Add Action",
        "environments.surveys.edit.capture_a_new_action_to_trigger_a_survey_on": "Capture a new action...",
      };
      return translations[key] || key;
    },
  }),
}));

const mockSetOpen = vi.fn();
const mockSetActionClasses = vi.fn();
const mockSetLocalSurvey = vi.fn();

const mockActionClasses: ActionClass[] = [
  // Add mock action classes if needed for SavedActionsTab testing
];

const mockSurvey: TSurvey = {
  id: "survey1",
  name: "Test Survey",
  type: "app",
  environmentId: "env1",
  status: "draft",
  questions: [],
  triggers: [],
  recontactDays: null,
  displayOption: "displayOnce",
  autoClose: null,
  delay: 0,
  autoComplete: null,
  surveyClosedMessage: null,
  singleUse: null,
  styling: null,
  languages: [],
  variables: [],
  welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
  endings: [],
  hiddenFields: { enabled: false },
  createdAt: new Date(),
  updatedAt: new Date(),
  pin: null,
  resultShareKey: null,
  displayPercentage: null,
  segment: null,
  closeOnDate: null,
  createdBy: null,
} as unknown as TSurvey;

const defaultProps = {
  open: true,
  setOpen: mockSetOpen,
  environmentId: "env1",
  actionClasses: mockActionClasses,
  setActionClasses: mockSetActionClasses,
  isReadOnly: false,
  localSurvey: mockSurvey,
  setLocalSurvey: mockSetLocalSurvey,
};

const SavedActionsTabMock = vi.mocked(SavedActionsTab);
const CreateNewActionTabMock = vi.mocked(CreateNewActionTab);

describe("AddActionModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks(); // Clear mocks after each test
  });

  test("renders correctly when open", () => {
    render(<AddActionModal {...defaultProps} />);
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Add Action");
    expect(screen.getByTestId("dialog-description")).toHaveTextContent("Capture a new action...");
    expect(screen.getByText("Select Saved Action")).toBeInTheDocument();
    expect(screen.getByText("Capture New Action")).toBeInTheDocument();
    // Only the first tab (SavedActionsTab) should be active initially
    expect(screen.getByTestId("saved-actions-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("create-new-action-tab")).not.toBeInTheDocument();
  });

  test("does not render when open is false", () => {
    render(<AddActionModal {...defaultProps} open={false} />);
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  test("switches tabs correctly", async () => {
    const user = userEvent.setup();
    render(<AddActionModal {...defaultProps} />);

    // Initially shows saved actions tab (first tab is active)
    expect(screen.getByTestId("saved-actions-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("create-new-action-tab")).not.toBeInTheDocument();

    // Click capture new action tab
    const captureNewActionTab = screen.getByText("Capture New Action");
    await user.click(captureNewActionTab);

    // Now shows create new action tab content
    expect(screen.queryByTestId("saved-actions-tab")).not.toBeInTheDocument();
    expect(screen.getByTestId("create-new-action-tab")).toBeInTheDocument();

    // Click select saved action tab again
    const selectSavedActionTab = screen.getByText("Select Saved Action");
    await user.click(selectSavedActionTab);

    // Back to saved actions tab content
    expect(screen.getByTestId("saved-actions-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("create-new-action-tab")).not.toBeInTheDocument();
  });

  test("resets to first tab when modal is reopened", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AddActionModal {...defaultProps} />);

    // Switch to create new action tab
    const captureNewActionTab = screen.getByText("Capture New Action");
    await user.click(captureNewActionTab);
    expect(screen.getByTestId("create-new-action-tab")).toBeInTheDocument();

    // Close modal
    rerender(<AddActionModal {...defaultProps} open={false} />);

    // Reopen modal
    rerender(<AddActionModal {...defaultProps} open={true} />);

    // Should be back to saved actions tab (first tab)
    expect(screen.getByTestId("saved-actions-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("create-new-action-tab")).not.toBeInTheDocument();
  });

  test("passes correct props to SavedActionsTab", () => {
    render(<AddActionModal {...defaultProps} />);
    expect(SavedActionsTabMock).toHaveBeenCalledWith(
      {
        actionClasses: mockActionClasses,
        localSurvey: mockSurvey,
        setLocalSurvey: mockSetLocalSurvey,
        setOpen: mockSetOpen,
      },
      undefined
    );
  });

  test("passes correct props to CreateNewActionTab", async () => {
    const user = userEvent.setup();
    render(<AddActionModal {...defaultProps} />);

    // CreateNewActionTab should not be called initially since first tab is active
    expect(CreateNewActionTabMock).not.toHaveBeenCalled();

    // Click the second tab to activate CreateNewActionTab
    const captureNewActionTab = screen.getByText("Capture New Action");
    await user.click(captureNewActionTab);

    // Now CreateNewActionTab should be called with correct props
    expect(CreateNewActionTabMock).toHaveBeenCalledWith(
      {
        actionClasses: mockActionClasses,
        setActionClasses: mockSetActionClasses,
        setOpen: mockSetOpen,
        isReadOnly: false,
        setLocalSurvey: mockSetLocalSurvey,
        environmentId: "env1",
      },
      undefined
    );
  });
});
