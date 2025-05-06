import { AddActionModal } from "@/modules/survey/editor/components/add-action-modal";
import { CreateNewActionTab } from "@/modules/survey/editor/components/create-new-action-tab";
import { SavedActionsTab } from "@/modules/survey/editor/components/saved-actions-tab";
import { ModalWithTabs } from "@/modules/ui/components/modal-with-tabs";
import { ActionClass } from "@prisma/client";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";

// Mock child components
vi.mock("@/modules/survey/editor/components/create-new-action-tab", () => ({
  CreateNewActionTab: vi.fn(() => <div>CreateNewActionTab Mock</div>),
}));

vi.mock("@/modules/survey/editor/components/saved-actions-tab", () => ({
  SavedActionsTab: vi.fn(() => <div>SavedActionsTab Mock</div>),
}));

vi.mock("@/modules/ui/components/modal-with-tabs", () => ({
  ModalWithTabs: vi.fn(
    ({ label, description, open, setOpen, tabs, size, closeOnOutsideClick, restrictOverflow }) => (
      <div data-testid="modal-with-tabs">
        <h1>{label}</h1>
        <p>{description}</p>
        <div>Open: {open.toString()}</div>
        <button onClick={() => setOpen(false)}>Close</button>
        <div>Size: {size}</div>
        <div>Close on outside click: {closeOnOutsideClick.toString()}</div>
        <div>Restrict overflow: {restrictOverflow.toString()}</div>
        {tabs.map((tab) => (
          <div key={tab.title}>
            <h2>{tab.title}</h2>
            <div>{tab.children}</div>
          </div>
        ))}
      </div>
    )
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

const ModalWithTabsMock = vi.mocked(ModalWithTabs);
const SavedActionsTabMock = vi.mocked(SavedActionsTab);
const CreateNewActionTabMock = vi.mocked(CreateNewActionTab);

describe("AddActionModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks(); // Clear mocks after each test
  });

  test("renders correctly when open", () => {
    render(<AddActionModal {...defaultProps} />);
    expect(screen.getByTestId("modal-with-tabs")).toBeInTheDocument();
    // Check for translated text
    expect(screen.getByText("Add Action")).toBeInTheDocument();
    expect(screen.getByText("Capture a new action...")).toBeInTheDocument();
    expect(screen.getByText("Select Saved Action")).toBeInTheDocument(); // Check translated tab title
    expect(screen.getByText("Capture New Action")).toBeInTheDocument(); // Check translated tab title
    expect(screen.getByText("SavedActionsTab Mock")).toBeInTheDocument();
    expect(screen.getByText("CreateNewActionTab Mock")).toBeInTheDocument();
  });

  test("passes correct props to ModalWithTabs", () => {
    render(<AddActionModal {...defaultProps} />);
    expect(ModalWithTabsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        // Check for translated props
        label: "Add Action",
        description: "Capture a new action...",
        open: true,
        setOpen: mockSetOpen,
        tabs: expect.any(Array),
        size: "md",
        closeOnOutsideClick: false,
        restrictOverflow: true,
      }),
      undefined
    );
    expect(ModalWithTabsMock.mock.calls[0][0].tabs).toHaveLength(2);
    // Check for translated tab titles in the tabs array
    expect(ModalWithTabsMock.mock.calls[0][0].tabs[0].title).toBe("Select Saved Action");
    expect(ModalWithTabsMock.mock.calls[0][0].tabs[1].title).toBe("Capture New Action");
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

  test("passes correct props to CreateNewActionTab", () => {
    render(<AddActionModal {...defaultProps} />);
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

  test("does not render when open is false", () => {
    render(<AddActionModal {...defaultProps} open={false} />);
    // Check the full props object passed to the mock, ensuring 'open' is false
    expect(ModalWithTabsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Add Action", // Expect translated label even when closed
        description: "Capture a new action...", // Expect translated description
        open: false, // Check that open is false
        setOpen: mockSetOpen,
        tabs: expect.any(Array),
        size: "md",
        closeOnOutsideClick: false,
        restrictOverflow: true,
      }),
      undefined
    );
  });
});
