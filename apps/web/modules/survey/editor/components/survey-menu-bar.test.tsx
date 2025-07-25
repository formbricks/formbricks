import { createSegmentAction } from "@/modules/ee/contacts/segments/actions";
import { updateSurveyAction } from "@/modules/survey/editor/actions";
import { SurveyMenuBar } from "@/modules/survey/editor/components/survey-menu-bar";
import { isSurveyValid } from "@/modules/survey/editor/lib/validation";
import { Project } from "@prisma/client";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyOpenTextQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

// Mock dependencies
vi.mock("@/lib/utils/helper", () => ({
  getFormattedErrorMessage: vi.fn((e) => e?.message ?? "Unknown error"),
}));

vi.mock("@/modules/ee/contacts/segments/actions", () => ({
  createSegmentAction: vi.fn(),
}));

vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children }) => <div>{children}</div>,
  AlertButton: ({ children, onClick }) => <button onClick={onClick}>{children}</button>,
  AlertTitle: ({ children }) => <span>{children}</span>,
}));

vi.mock("@/modules/ui/components/alert-dialog", () => ({
  AlertDialog: ({ open, headerText, mainText, confirmBtnLabel, declineBtnLabel, onConfirm, onDecline }) =>
    open ? (
      <div data-testid="alert-dialog">
        <h1>{headerText}</h1>
        <p>{mainText}</p>
        <button onClick={onConfirm}>{confirmBtnLabel}</button>
        <button onClick={onDecline}>{declineBtnLabel}</button>
      </div>
    ) : null,
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, loading, disabled, variant, size, type }) => (
    <button
      onClick={onClick}
      disabled={loading ?? disabled}
      data-variant={variant}
      data-size={size}
      type={type}>
      {loading ? "Loading..." : children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/input", () => ({
  Input: ({ defaultValue, onChange, className }) => (
    <input
      defaultValue={defaultValue}
      onChange={onChange}
      className={className}
      data-testid="survey-name-input"
    />
  ),
}));

vi.mock("@/modules/survey/editor/actions", () => ({
  updateSurveyAction: vi.fn(),
}));

vi.mock("@/modules/survey/editor/lib/validation", () => ({
  isSurveyValid: vi.fn(() => true), // Default to valid
}));

vi.mock("@formbricks/i18n-utils/src/utils", () => ({
  getLanguageLabel: vi.fn((code) => `Lang(${code})`),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Lucide icons
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return {
    ...actual,
    ArrowLeftIcon: () => <div data-testid="arrow-left-icon">ArrowLeft</div>,
    SettingsIcon: () => <div data-testid="settings-icon">Settings</div>,
  };
});

const mockRouter = {
  back: vi.fn(),
  push: vi.fn(),
};
const mockSetLocalSurvey = vi.fn();
const mockSetActiveId = vi.fn();
const mockSetInvalidQuestions = vi.fn();
const mockSetIsCautionDialogOpen = vi.fn();

const baseSurvey = {
  id: "survey-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Survey",
  type: "link",
  environmentId: "env-1",
  status: "draft",
  questions: [
    {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Q1" },
      required: true,
    } as unknown as TSurveyOpenTextQuestion,
  ],
  endings: [{ id: "end1", type: "endScreen", headline: { default: "End" } }],
  triggers: [],
  recontactDays: null,
  displayOption: "displayOnce",
  autoClose: null,
  delay: 0,
  autoComplete: null,
  styling: null,
  surveyClosedMessage: null,
  singleUse: null,
  pin: null,
  segment: null,
  languages: [],
  runOnDate: null,
  closeOnDate: null,
  welcomeCard: { enabled: false } as TSurvey["welcomeCard"],
} as unknown as TSurvey;

const mockProject = {
  id: "proj-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Project",
  styling: { allowStyleOverwrite: true },
  recontactDays: 0,
  inAppSurveyBranding: false,
  linkSurveyBranding: false,
  placement: "bottomRight",
  clickOutsideClose: false,
  darkOverlay: false,
} as unknown as Project;

const defaultProps = {
  localSurvey: baseSurvey,
  survey: baseSurvey,
  setLocalSurvey: mockSetLocalSurvey,
  environmentId: "env-1",
  activeId: "questions" as const,
  setActiveId: mockSetActiveId,
  setInvalidQuestions: mockSetInvalidQuestions,
  project: mockProject,
  responseCount: 0,
  selectedLanguageCode: "default",
  setSelectedLanguageCode: vi.fn(),
  isCxMode: false,
  locale: "en",
  setIsCautionDialogOpen: mockSetIsCautionDialogOpen,
};

describe("SurveyMenuBar", () => {
  beforeEach(() => {
    vi.mocked(updateSurveyAction).mockResolvedValue({ data: { ...baseSurvey, updatedAt: new Date() } }); // Mock successful update
    vi.mocked(isSurveyValid).mockReturnValue(true);
    vi.mocked(createSegmentAction).mockResolvedValue({
      data: { id: "seg-1", title: "seg-1", filters: [] },
    } as any);
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders correctly with default props", () => {
    render(<SurveyMenuBar {...defaultProps} />);
    expect(screen.getByText("common.back")).toBeInTheDocument();
    expect(screen.getByText("Test Project /")).toBeInTheDocument();
    expect(screen.getByTestId("survey-name-input")).toHaveValue("Test Survey");
    expect(screen.getByText("common.save")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.publish")).toBeInTheDocument();
  });

  test("updates survey name on input change", async () => {
    render(<SurveyMenuBar {...defaultProps} />);
    const input = screen.getByTestId("survey-name-input");
    await userEvent.type(input, " Updated");
    expect(mockSetLocalSurvey).toHaveBeenCalledWith({ ...baseSurvey, name: "Test Survey Updated" });
  });

  test("handles back button click with changes, opens dialog", async () => {
    const changedSurvey = { ...baseSurvey, name: "Changed Name" };
    render(<SurveyMenuBar {...defaultProps} localSurvey={changedSurvey} />);
    const backButton = screen.getByText("common.back").closest("button");
    await userEvent.click(backButton!);
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(screen.getByTestId("alert-dialog")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.confirm_survey_changes")).toBeInTheDocument();
  });

  test("shows caution alert when responseCount > 0", () => {
    render(<SurveyMenuBar {...defaultProps} responseCount={5} />);
    expect(screen.getByText("environments.surveys.edit.caution_text")).toBeInTheDocument();
    expect(screen.getByText("common.learn_more")).toBeInTheDocument();
  });

  test("calls setIsCautionDialogOpen when 'Learn More' is clicked", async () => {
    render(<SurveyMenuBar {...defaultProps} responseCount={5} />);
    const learnMoreButton = screen.getByText("common.learn_more");
    await userEvent.click(learnMoreButton);
    expect(mockSetIsCautionDialogOpen).toHaveBeenCalledWith(true);
  });

  test("renders correctly in CX mode", () => {
    render(<SurveyMenuBar {...defaultProps} isCxMode={true} />);
    expect(screen.queryByText("common.back")).not.toBeInTheDocument();
    expect(screen.queryByText("common.save")).not.toBeInTheDocument(); // Save button is hidden in CX mode draft
    expect(screen.getByText("environments.surveys.edit.save_and_close")).toBeInTheDocument(); // Publish button text changes
  });

  test("handles audience prompt for app surveys", async () => {
    const appSurvey = { ...baseSurvey, type: "app" as const };
    render(<SurveyMenuBar {...defaultProps} localSurvey={appSurvey} />);
    expect(screen.getByText("environments.surveys.edit.continue_to_settings")).toBeInTheDocument();
    const continueButton = screen
      .getByText("environments.surveys.edit.continue_to_settings")
      .closest("button");
    await userEvent.click(continueButton!);
    expect(mockSetActiveId).toHaveBeenCalledWith("settings");
    // Button should disappear after click (audiencePrompt becomes false)
    expect(screen.queryByText("environments.surveys.edit.continue_to_settings")).not.toBeInTheDocument();
    // Publish button should now be visible
    expect(screen.getByText("environments.surveys.edit.publish")).toBeInTheDocument();
  });

  test("hides audience prompt when activeId is settings initially", () => {
    const appSurvey = { ...baseSurvey, type: "app" as const };
    render(<SurveyMenuBar {...defaultProps} localSurvey={appSurvey} activeId="settings" />);
    expect(screen.queryByText("environments.surveys.edit.continue_to_settings")).not.toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.publish")).toBeInTheDocument();
  });

  test("shows 'Save & Close' button for non-draft surveys", () => {
    const publishedSurvey = { ...baseSurvey, status: "inProgress" as const };
    render(<SurveyMenuBar {...defaultProps} localSurvey={publishedSurvey} />);
    expect(screen.getByText("environments.surveys.edit.save_and_close")).toBeInTheDocument();
    expect(screen.queryByText("environments.surveys.edit.publish")).not.toBeInTheDocument();
    expect(screen.queryByText("environments.surveys.edit.continue_to_settings")).not.toBeInTheDocument();
  });

  test("enables save buttons if app survey has triggers and is published", () => {
    const publishedAppSurveyWithTriggers = {
      ...baseSurvey,
      status: "inProgress" as const,
      type: "app" as const,
      triggers: ["trigger1"],
    } as unknown as TSurvey;
    render(<SurveyMenuBar {...defaultProps} localSurvey={publishedAppSurveyWithTriggers} />);
    const saveButton = screen.getByText("common.save").closest("button");
    const saveCloseButton = screen.getByText("environments.surveys.edit.save_and_close").closest("button");

    expect(saveButton).not.toBeDisabled();
    expect(saveCloseButton).not.toBeDisabled();
  });
});
