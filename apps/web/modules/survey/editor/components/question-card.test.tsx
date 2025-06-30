import { QuestionCard } from "@/modules/survey/editor/components/question-card";
import { Project } from "@prisma/client";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
// Import waitFor
import { TSurvey, TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

// Mock child components
vi.mock("@/modules/survey/components/question-form-input", () => ({
  QuestionFormInput: vi.fn(({ id, label, value, placeholder }) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        data-testid={`question-form-input-${id}`}
        defaultValue={value?.["default"] || ""}
        placeholder={placeholder}
      />
    </div>
  )),
}));
vi.mock("@/modules/survey/editor/components/address-question-form", () => ({
  AddressQuestionForm: vi.fn(() => <div data-testid="address-form">AddressQuestionForm</div>),
}));
vi.mock("@/modules/survey/editor/components/advanced-settings", () => ({
  AdvancedSettings: vi.fn(() => <div data-testid="advanced-settings">AdvancedSettings</div>),
}));
vi.mock("@/modules/survey/editor/components/cal-question-form", () => ({
  CalQuestionForm: vi.fn(() => <div data-testid="cal-form">CalQuestionForm</div>),
}));
vi.mock("@/modules/survey/editor/components/consent-question-form", () => ({
  ConsentQuestionForm: vi.fn(() => <div data-testid="consent-form">ConsentQuestionForm</div>),
}));
vi.mock("@/modules/survey/editor/components/contact-info-question-form", () => ({
  ContactInfoQuestionForm: vi.fn(() => <div data-testid="contact-info-form">ContactInfoQuestionForm</div>),
}));
vi.mock("@/modules/survey/editor/components/cta-question-form", () => ({
  CTAQuestionForm: vi.fn(() => <div data-testid="cta-form">CTAQuestionForm</div>),
}));
vi.mock("@/modules/survey/editor/components/date-question-form", () => ({
  DateQuestionForm: vi.fn(() => <div data-testid="date-form">DateQuestionForm</div>),
}));
vi.mock("@/modules/survey/editor/components/editor-card-menu", () => ({
  EditorCardMenu: vi.fn(() => <div data-testid="editor-card-menu">EditorCardMenu</div>),
}));
vi.mock("@/modules/survey/editor/components/file-upload-question-form", () => ({
  FileUploadQuestionForm: vi.fn(() => <div data-testid="file-upload-form">FileUploadQuestionForm</div>),
}));
vi.mock("@/modules/survey/editor/components/matrix-question-form", () => ({
  MatrixQuestionForm: vi.fn(() => <div data-testid="matrix-form">MatrixQuestionForm</div>),
}));
vi.mock("@/modules/survey/editor/components/multiple-choice-question-form", () => ({
  MultipleChoiceQuestionForm: vi.fn(() => <div data-testid="multiple-choice-form">MultipleChoiceForm</div>),
}));
vi.mock("@/modules/survey/editor/components/nps-question-form", () => ({
  NPSQuestionForm: vi.fn(() => <div data-testid="nps-form">NPSQuestionForm</div>),
}));
vi.mock("@/modules/survey/editor/components/open-question-form", () => ({
  OpenQuestionForm: vi.fn(() => <div data-testid="open-text-form">OpenQuestionForm</div>),
}));
vi.mock("@/modules/survey/editor/components/picture-selection-form", () => ({
  PictureSelectionForm: vi.fn(() => <div data-testid="picture-selection-form">PictureSelectionForm</div>),
}));
vi.mock("@/modules/survey/editor/components/ranking-question-form", () => ({
  RankingQuestionForm: vi.fn(() => <div data-testid="ranking-form">RankingQuestionForm</div>),
}));
vi.mock("@/modules/survey/editor/components/rating-question-form", () => ({
  RatingQuestionForm: vi.fn(() => <div data-testid="rating-form">RatingQuestionForm</div>),
}));
vi.mock("@/modules/ui/components/alert", () => ({
  Alert: vi.fn(({ children }) => <div data-testid="alert">{children}</div>),
  AlertTitle: vi.fn(({ children }) => <div data-testid="alert-title">{children}</div>),
  AlertButton: vi.fn(({ children, onClick }) => (
    <button data-testid="alert-button" onClick={onClick}>
      {children}
    </button>
  )),
}));
vi.mock("@dnd-kit/sortable", () => ({
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
}));
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: vi.fn(() => [vi.fn()]), // Mock useAutoAnimate to return a ref
}));

// Mock utility functions
vi.mock("@/lib/utils/recall", async () => {
  const original = await vi.importActual("@/lib/utils/recall");
  return {
    ...original,
    recallToHeadline: vi.fn((headline) => headline), // Ensure this mock returns the headline object directly
  };
});
vi.mock("@/modules/survey/editor/lib/utils", async () => {
  const original = await vi.importActual("@/modules/survey/editor/lib/utils");
  return {
    ...original,
    formatTextWithSlashes: vi.fn((text) => text), // Mock formatTextWithSlashes to return text as is
  };
});

const mockMoveQuestion = vi.fn();
const mockUpdateQuestion = vi.fn();
const mockDeleteQuestion = vi.fn();
const mockDuplicateQuestion = vi.fn();
const mockSetActiveQuestionId = vi.fn();
const mockSetSelectedLanguageCode = vi.fn();
const mockAddQuestion = vi.fn();
const mockOnAlertTrigger = vi.fn();

const mockProject = { id: "project1", name: "Test Project" } as Project;

const baseSurvey = {
  id: "survey1",
  name: "Test Survey",
  type: "app",
  environmentId: "env1",
  status: "draft",
  questions: [],
  endings: [],
  languages: [{ language: { code: "en" }, default: true, enabled: true }],
  triggers: [],
  recontactDays: null,
  displayOption: "displayOnce",
  welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
  styling: {},
  variables: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  autoClose: null,
  delay: 0,
  displayLimit: null,
  resultShareKey: null,
  inlineTriggers: null,
  pinResponses: false,
  productOverwrites: null,
  singleUse: null,
  surveyClosedMessage: null,
  verifyEmail: null,
  closeOnDate: null,
  projectOverwrites: null,
  hiddenFields: { enabled: false },
} as unknown as TSurvey;

const baseQuestion = {
  id: "q1",
  type: TSurveyQuestionTypeEnum.OpenText,
  headline: { default: "Question Headline", en: "Question Headline" },
  subheader: { default: "Optional Subheader", en: "Optional Subheader" },
  required: true,
  buttonLabel: { default: "Next", en: "Next" },
  backButtonLabel: { default: "Back", en: "Back" },
  inputType: "text",
  longAnswer: false,
  placeholder: { default: "Type your answer here...", en: "Type your answer here..." },
  logic: [],
  charLimit: { enabled: false },
} as TSurveyQuestion;

const defaultProps = {
  localSurvey: { ...baseSurvey, questions: [baseQuestion] } as TSurvey,
  project: mockProject,
  question: baseQuestion,
  questionIdx: 0,
  moveQuestion: mockMoveQuestion,
  updateQuestion: mockUpdateQuestion,
  deleteQuestion: mockDeleteQuestion,
  duplicateQuestion: mockDuplicateQuestion,
  activeQuestionId: null,
  setActiveQuestionId: mockSetActiveQuestionId,
  lastQuestion: true,
  selectedLanguageCode: "en",
  setSelectedLanguageCode: mockSetSelectedLanguageCode,
  isInvalid: false,
  addQuestion: mockAddQuestion,
  isFormbricksCloud: true,
  isCxMode: false,
  locale: "en-US" as const,
  responseCount: 0,
  onAlertTrigger: mockOnAlertTrigger,
};

describe("QuestionCard Component", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks(); // Clear mocks after each test
  });

  test("renders basic structure and headline", () => {
    render(<QuestionCard {...defaultProps} />);
    expect(screen.getByText("Question Headline")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.required")).toBeInTheDocument(); // Collapsed state
    expect(screen.getByText("EditorCardMenu")).toBeInTheDocument();
  });

  test("renders optional subheader when collapsed", () => {
    const props = { ...defaultProps, question: { ...baseQuestion, required: false } };
    render(<QuestionCard {...props} />);
    expect(screen.getByText("environments.surveys.edit.optional")).toBeInTheDocument();
  });

  test("renders correct question form based on type (OpenText)", () => {
    render(<QuestionCard {...defaultProps} activeQuestionId="q1" />);
    expect(screen.getByTestId("open-text-form")).toBeInTheDocument();
  });

  test("renders correct question form based on type (MultipleChoiceSingle)", () => {
    const mcQuestion = {
      ...baseQuestion,
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      choices: [],
    } as TSurveyQuestion;
    render(<QuestionCard {...defaultProps} question={mcQuestion} activeQuestionId="q1" />);
    expect(screen.getByTestId("multiple-choice-form")).toBeInTheDocument();
  });

  // Add similar tests for other question types...

  test("calls setActiveQuestionId when card is clicked", async () => {
    const user = userEvent.setup();
    // Initial render with activeQuestionId: null
    const { rerender: rerenderCard } = render(<QuestionCard {...defaultProps} activeQuestionId={null} />);
    const trigger = screen
      .getByText("Question Headline")
      .closest("div[role='button'], div[type='button'], button");
    expect(trigger).toBeInTheDocument();

    // First click: should call setActiveQuestionId with "q1"
    await user.click(trigger!);
    expect(mockSetActiveQuestionId).toHaveBeenCalledWith("q1");

    // Re-render with activeQuestionId: "q1" to simulate state update
    rerenderCard(<QuestionCard {...defaultProps} activeQuestionId="q1" />);

    // Second click: should call setActiveQuestionId with null
    await user.click(trigger!);
    expect(mockSetActiveQuestionId).toHaveBeenCalledWith(null);
  });

  test("renders 'Long Answer' toggle for OpenText question when open", () => {
    render(<QuestionCard {...defaultProps} activeQuestionId="q1" />);
    expect(screen.getByLabelText("environments.surveys.edit.long_answer")).toBeInTheDocument();
  });

  test("does not render 'Long Answer' toggle for non-OpenText question", () => {
    const mcQuestion = {
      ...baseQuestion,
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      choices: [],
    } as TSurveyQuestion;
    render(<QuestionCard {...defaultProps} question={mcQuestion} activeQuestionId="q1" />);
    expect(screen.queryByLabelText("environments.surveys.edit.long_answer")).not.toBeInTheDocument();
  });

  test("calls updateQuestion when 'Long Answer' toggle is clicked", async () => {
    const user = userEvent.setup();
    render(<QuestionCard {...defaultProps} activeQuestionId="q1" />);
    const toggle = screen.getByRole("switch", { name: "environments.surveys.edit.long_answer" });
    await user.click(toggle);
    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, { longAnswer: true }); // Assuming initial is false
  });

  test("calls updateQuestion when 'Required' toggle is clicked", async () => {
    const user = userEvent.setup();
    render(<QuestionCard {...defaultProps} activeQuestionId="q1" />);
    const toggle = screen.getByRole("switch", { name: "environments.surveys.edit.required" });
    await user.click(toggle);
    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, { required: false }); // Assuming initial is true
  });

  test("handles required toggle special case for NPS/Rating", async () => {
    const user = userEvent.setup();
    const npsQuestion = {
      ...baseQuestion,
      type: TSurveyQuestionTypeEnum.NPS,
      required: false,
    } as TSurveyQuestion;
    render(<QuestionCard {...defaultProps} question={npsQuestion} activeQuestionId="q1" />);
    const toggle = screen.getByRole("switch", { name: "environments.surveys.edit.required" });
    await user.click(toggle);
    // Expect buttonLabel to be undefined when toggling to required for NPS/Rating
    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, { required: true, buttonLabel: undefined });
  });

  test("renders advanced settings trigger and content", async () => {
    const user = userEvent.setup();
    render(<QuestionCard {...defaultProps} activeQuestionId="q1" />);
    const trigger = screen.getByText("environments.surveys.edit.show_advanced_settings");
    expect(screen.queryByTestId("advanced-settings")).not.toBeInTheDocument(); // Initially hidden
    await user.click(trigger);
    expect(screen.getByText("environments.surveys.edit.hide_advanced_settings")).toBeInTheDocument();
    expect(screen.getByTestId("advanced-settings")).toBeInTheDocument(); // Now visible
  });

  test("renders button label inputs in advanced settings when applicable", () => {
    render(<QuestionCard {...defaultProps} activeQuestionId="q1" />);
    // Need to open advanced settings first
    fireEvent.click(screen.getByText("environments.surveys.edit.show_advanced_settings"));

    expect(screen.getByTestId("question-form-input-buttonLabel")).toBeInTheDocument();
    // Back button shouldn't render for the first question (index 0)
    expect(screen.queryByTestId("question-form-input-backButtonLabel")).not.toBeInTheDocument();
  });

  test("renders back button label input for non-first questions", () => {
    render(<QuestionCard {...defaultProps} questionIdx={1} activeQuestionId="q1" />);
    fireEvent.click(screen.getByText("environments.surveys.edit.show_advanced_settings"));
    expect(screen.getByTestId("question-form-input-buttonLabel")).toBeInTheDocument();
    expect(screen.getByTestId("question-form-input-backButtonLabel")).toBeInTheDocument();
  });

  test("does not render button labels for NPS/Rating/CTA in advanced settings", () => {
    const npsQuestion = { ...baseQuestion, type: TSurveyQuestionTypeEnum.NPS } as TSurveyQuestion;
    render(<QuestionCard {...defaultProps} question={npsQuestion} activeQuestionId="q1" />);
    fireEvent.click(screen.getByText("environments.surveys.edit.show_advanced_settings"));
    expect(screen.queryByTestId("question-form-input-buttonLabel")).not.toBeInTheDocument();
  });

  test("renders warning alert when responseCount > 0 for specific types", () => {
    const mcQuestion = {
      ...baseQuestion,
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      choices: [],
    } as TSurveyQuestion;
    render(<QuestionCard {...defaultProps} question={mcQuestion} responseCount={1} activeQuestionId="q1" />);
    expect(screen.getByTestId("alert")).toBeInTheDocument();
    expect(screen.getByTestId("alert-title")).toHaveTextContent("environments.surveys.edit.caution_text");
    expect(screen.getByTestId("alert-button")).toHaveTextContent("common.learn_more");
  });

  test("does not render warning alert when responseCount is 0", () => {
    const mcQuestion = {
      ...baseQuestion,
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      choices: [],
    } as TSurveyQuestion;
    render(<QuestionCard {...defaultProps} question={mcQuestion} responseCount={0} activeQuestionId="q1" />);
    expect(screen.queryByTestId("alert")).not.toBeInTheDocument();
  });

  test("does not render warning alert for non-applicable question types", () => {
    render(<QuestionCard {...defaultProps} responseCount={1} activeQuestionId="q1" />); // OpenText
    expect(screen.queryByTestId("alert")).not.toBeInTheDocument();
  });

  test("calls onAlertTrigger when alert button is clicked", async () => {
    const user = userEvent.setup();
    const mcQuestion = {
      ...baseQuestion,
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      choices: [],
    } as TSurveyQuestion;
    render(<QuestionCard {...defaultProps} question={mcQuestion} responseCount={1} activeQuestionId="q1" />);
    const alertButton = screen.getByTestId("alert-button");
    await user.click(alertButton);
    expect(mockOnAlertTrigger).toHaveBeenCalledTimes(1);
  });

  test("applies invalid styling when isInvalid is true", () => {
    render(<QuestionCard {...defaultProps} isInvalid={true} />);
    const dragHandle = screen.getByRole("button", { name: "Drag to reorder question" }).parentElement; // Get the div containing the GripIcon
    expect(dragHandle).toHaveClass("bg-red-400");
    expect(dragHandle).toHaveClass("hover:bg-red-600");
  });

  test("disables required toggle for Address question if all fields are optional", () => {
    const addressQuestion = {
      ...baseQuestion,
      type: TSurveyQuestionTypeEnum.Address,
      addressLine1: { show: true, required: false },
      addressLine2: { show: false, required: false },
      city: { show: true, required: false },
      state: { show: false, required: false },
      zip: { show: true, required: false },
      country: { show: false, required: false },
    } as TSurveyQuestion;
    render(<QuestionCard {...defaultProps} question={addressQuestion} activeQuestionId="q1" />);
    const toggle = screen.getByRole("switch", { name: "environments.surveys.edit.required" });
    expect(toggle).toBeDisabled();
  });

  test("renders backButtonLabel input when question type is Rating and not first question", () => {
    const ratingQuestion = {
      ...baseQuestion,
      id: "question-1",
      type: TSurveyQuestionTypeEnum.Rating,
      headline: { default: "Test Question", en: "Test Question" },
    } as TSurveyQuestion;

    render(
      <QuestionCard
        {...defaultProps}
        question={ratingQuestion}
        questionIdx={1} // Not the first question
        activeQuestionId="question-1"
      />
    );

    // Open advanced settings
    fireEvent.click(screen.getByText("environments.surveys.edit.show_advanced_settings"));

    expect(screen.getByTestId("question-form-input-backButtonLabel")).toBeInTheDocument();
  });

  test("renders backButtonLabel input when question type is NPS and not first question", () => {
    const npsQuestion = {
      ...baseQuestion,
      id: "question-1",
      type: TSurveyQuestionTypeEnum.NPS,
      headline: { default: "Test Question", en: "Test Question" },
    } as TSurveyQuestion;

    render(
      <QuestionCard
        {...defaultProps}
        question={npsQuestion}
        questionIdx={1} // Not the first question
        activeQuestionId="question-1"
      />
    );

    // Open advanced settings
    fireEvent.click(screen.getByText("environments.surveys.edit.show_advanced_settings"));

    expect(screen.getByTestId("question-form-input-backButtonLabel")).toBeInTheDocument();
  });

  test("does not render backButtonLabel input when question type is Rating but it's the first question", () => {
    const ratingQuestion = {
      ...baseQuestion,
      id: "question-1",
      type: TSurveyQuestionTypeEnum.Rating,
      headline: { default: "Test Question", en: "Test Question" },
    } as TSurveyQuestion;

    render(
      <QuestionCard
        {...defaultProps}
        question={ratingQuestion}
        questionIdx={0} // First question
        activeQuestionId="question-1"
      />
    );

    // Open advanced settings
    fireEvent.click(screen.getByText("environments.surveys.edit.show_advanced_settings"));

    expect(screen.queryByTestId("question-form-input-backButtonLabel")).not.toBeInTheDocument();
  });

  test("renders backButtonLabel input for non-NPS/Rating/CTA questions when not first question", () => {
    const openTextQuestion = {
      ...baseQuestion,
      id: "question-1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Test Question", en: "Test Question" },
    } as TSurveyQuestion;

    render(
      <QuestionCard
        {...defaultProps}
        question={openTextQuestion}
        questionIdx={1} // Not the first question
        activeQuestionId="question-1"
      />
    );

    // Open advanced settings
    fireEvent.click(screen.getByText("environments.surveys.edit.show_advanced_settings"));

    // Should render backButtonLabel for non-first questions (regardless of type)
    expect(screen.getByTestId("question-form-input-backButtonLabel")).toBeInTheDocument();
  });

  test("does not render backButtonLabel input for any question type when it's the first question", () => {
    const openTextQuestion = {
      ...baseQuestion,
      id: "question-1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Test Question", en: "Test Question" },
    } as TSurveyQuestion;

    render(
      <QuestionCard
        {...defaultProps}
        question={openTextQuestion}
        questionIdx={0} // First question
        activeQuestionId="question-1"
      />
    );

    // Open advanced settings
    fireEvent.click(screen.getByText("environments.surveys.edit.show_advanced_settings"));

    // First question should never have back button
    expect(screen.queryByTestId("question-form-input-backButtonLabel")).not.toBeInTheDocument();
  });

  // Accessibility Tests
  test("maintains proper focus management when toggling advanced settings", async () => {
    const user = userEvent.setup();
    render(<QuestionCard {...defaultProps} activeQuestionId="q1" />);

    const advancedSettingsTrigger = screen.getByText("environments.surveys.edit.show_advanced_settings");
    await user.click(advancedSettingsTrigger);

    const closeTrigger = screen.getByText("environments.surveys.edit.hide_advanced_settings");
    expect(closeTrigger).toBeInTheDocument();
  });

  test("ensures proper ARIA attributes for collapsible sections", () => {
    render(<QuestionCard {...defaultProps} activeQuestionId="q1" />);

    const collapsibleTrigger = screen.getByText("environments.surveys.edit.show_advanced_settings");
    expect(collapsibleTrigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(collapsibleTrigger);
    expect(collapsibleTrigger).toHaveAttribute("aria-expanded", "true");
  });

  test("maintains keyboard accessibility for required toggle", async () => {
    const user = userEvent.setup();
    render(<QuestionCard {...defaultProps} activeQuestionId="q1" />);

    const requiredToggle = screen.getByRole("switch", { name: "environments.surveys.edit.required" });
    await user.click(requiredToggle);
    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, { required: false });
  });

  test("provides screen reader text for drag handle", () => {
    render(<QuestionCard {...defaultProps} />);
    const dragHandle = screen.getByRole("button", { name: "Drag to reorder question" });
    const svg = dragHandle.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  test("maintains proper heading hierarchy", () => {
    render(<QuestionCard {...defaultProps} activeQuestionId="q1" />);
    const headline = screen.getByText("Question Headline");
    expect(headline.tagName).toBe("H3");
    expect(headline).toHaveClass("text-sm", "font-semibold");
  });

  test("ensures proper focus order for form elements", async () => {
    const user = userEvent.setup();
    render(<QuestionCard {...defaultProps} activeQuestionId="q1" />);

    // Open advanced settings
    fireEvent.click(screen.getByText("environments.surveys.edit.show_advanced_settings"));

    const requiredToggle = screen.getByRole("switch", { name: "environments.surveys.edit.required" });
    await user.click(requiredToggle);
    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, { required: false });
  });

  test("provides proper ARIA attributes for interactive elements", () => {
    render(<QuestionCard {...defaultProps} activeQuestionId="q1" />);

    const requiredToggle = screen.getByRole("switch", { name: "environments.surveys.edit.required" });
    expect(requiredToggle).toHaveAttribute("aria-checked", "true");

    const longAnswerToggle = screen.getByRole("switch", { name: "environments.surveys.edit.long_answer" });
    expect(longAnswerToggle).toHaveAttribute("aria-checked", "false");
  });

  test("ensures proper role attributes for interactive elements", () => {
    render(<QuestionCard {...defaultProps} activeQuestionId="q1" />);

    const toggles = screen.getAllByRole("switch");
    expect(toggles).toHaveLength(2); // Required and Long Answer toggles

    const collapsibleTrigger = screen.getByText("environments.surveys.edit.show_advanced_settings");
    expect(collapsibleTrigger).toHaveAttribute("type", "button");
  });

  test("maintains proper focus management when closing advanced settings", async () => {
    const user = userEvent.setup();
    render(<QuestionCard {...defaultProps} activeQuestionId="q1" />);

    const advancedSettingsTrigger = screen.getByText("environments.surveys.edit.show_advanced_settings");
    await user.click(advancedSettingsTrigger);

    const closeTrigger = screen.getByText("environments.surveys.edit.hide_advanced_settings");
    await user.click(closeTrigger);

    expect(screen.getByText("environments.surveys.edit.show_advanced_settings")).toBeInTheDocument();
  });
});
