import { createI18nString } from "@/lib/i18n/utils";
import { OpenQuestionForm } from "@/modules/survey/editor/components/open-question-form";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
// Import fireEvent, remove rtlRerender if not used elsewhere
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyOpenTextQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

// Mock dependencies
vi.mock("@/lib/i18n/utils", () => ({
  createI18nString: vi.fn((text, languages) =>
    languages.reduce((acc, lang) => ({ ...acc, [lang]: text }), {})
  ),
  extractLanguageCodes: vi.fn((languages) => languages?.map((lang) => lang.code) ?? ["default"]),
}));

vi.mock("@/modules/survey/components/question-form-input", () => ({
  QuestionFormInput: vi.fn(({ id, value, label, onChange }) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        data-testid={id}
        value={JSON.stringify(value)} // Simplified representation for testing
        onChange={(e) => onChange?.(JSON.parse(e.target.value))}
      />
    </div>
  )),
}));

vi.mock("@/modules/ui/components/advanced-option-toggle", () => ({
  AdvancedOptionToggle: vi.fn(({ isChecked, onToggle, htmlId, children }) => (
    <div>
      <input
        type="checkbox"
        id={htmlId}
        data-testid={htmlId}
        checked={isChecked}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <label htmlFor={htmlId}>Toggle Advanced Options</label>
      {isChecked && <div>{children}</div>}
    </div>
  )),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: vi.fn(({ children, onClick, ...props }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  )),
}));

vi.mock("@/modules/ui/components/input", () => ({
  Input: vi.fn(({ id, value, onChange, ...props }) => (
    <input id={id} data-testid={id} value={value} onChange={onChange} {...props} />
  )),
}));

vi.mock("@/modules/ui/components/label", () => ({
  Label: vi.fn(({ htmlFor, children }) => <label htmlFor={htmlFor}>{children}</label>),
}));

vi.mock("@/modules/ui/components/options-switch", () => ({
  OptionsSwitch: vi.fn(({ options, currentOption, handleOptionChange }) => (
    <div>
      {options.map((option) => (
        <button
          key={option.value}
          data-testid={`options-switch-${option.value}`}
          onClick={() => handleOptionChange(option.value)}
          disabled={option.value === currentOption}>
          {option.label}
        </button>
      ))}
    </div>
  )),
}));

vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: vi.fn(() => [vi.fn()]), // Mock ref
}));

// Mock Lucide icons
vi.mock("lucide-react", async () => {
  const original = await vi.importActual("lucide-react");
  return {
    ...original,
    MessageSquareTextIcon: () => <div>MessageSquareTextIcon</div>,
    MailIcon: () => <div>MailIcon</div>,
    LinkIcon: () => <div>LinkIcon</div>,
    HashIcon: () => <div>HashIcon</div>,
    PhoneIcon: () => <div>PhoneIcon</div>,
    PlusIcon: () => <div>PlusIcon</div>,
  };
});

const mockQuestion = {
  id: "openText1",
  type: TSurveyQuestionTypeEnum.OpenText,
  headline: createI18nString("What's your name?", ["en"]),
  subheader: createI18nString("Please tell us.", ["en"]),
  placeholder: createI18nString("Type here...", ["en"]),
  longAnswer: false,
  required: true,
  inputType: "text",
  buttonLabel: createI18nString("Next", ["en"]),
  // Initialize charLimit as undefined or disabled
  charLimit: { enabled: false, min: undefined, max: undefined },
} as TSurveyOpenTextQuestion;

const mockSurvey = {
  id: "survey1",
  name: "Test Survey",
  type: "app",
  status: "inProgress",
  questions: [mockQuestion],
  languages: [{ code: "en", default: true, enabled: true }],
  thankYouCard: { enabled: true },
  welcomeCard: { enabled: false },
  autoClose: null,
  triggers: [],
  environmentId: "env1",
  createdAt: new Date(),
  updatedAt: new Date(),
  displayOption: "displayOnce",
  recontactDays: null,
  displayLimit: null,
  attributeFilters: [],
  endings: [],
  hiddenFields: { enabled: false },
  styling: {},
  variables: [],
  productOverwrites: null,
  singleUse: null,
  verifyEmail: null,
  closeOnDate: null,
  delay: 0,
  displayPercentage: null,
  inlineTriggers: null,
  pin: null,
  segment: null,
  surveyClosedMessage: null,
  redirectUrl: null,
  createdBy: null,
  autoComplete: null,
  runOnDate: null,
  displayProgressBar: true,
} as unknown as TSurvey;

const mockUpdateQuestion = vi.fn();
const mockSetSelectedLanguageCode = vi.fn();

describe("OpenQuestionForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders the form correctly", () => {
    render(
      <OpenQuestionForm
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        localSurvey={mockSurvey}
        selectedLanguageCode="en"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale={"en" as TUserLocale}
        lastQuestion={false}
      />
    );

    expect(screen.getByTestId("headline")).toBeInTheDocument();
    expect(screen.getByTestId("subheader")).toBeInTheDocument();
    expect(screen.getByTestId("placeholder")).toBeInTheDocument();
    expect(screen.getByTestId("options-switch-text")).toBeDisabled();
    expect(screen.getByTestId("options-switch-email")).not.toBeDisabled();
    expect(screen.queryByTestId("charLimit")).toBeInTheDocument(); // AdvancedOptionToggle is rendered
    expect(screen.queryByTestId("minLength")).not.toBeInTheDocument(); // Char limit inputs hidden initially
  });

  test("adds subheader when undefined", async () => {
    const questionWithoutSubheader = { ...mockQuestion, subheader: undefined };
    render(
      <OpenQuestionForm
        question={questionWithoutSubheader}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        localSurvey={mockSurvey}
        selectedLanguageCode="en"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale={"en" as TUserLocale}
        lastQuestion={false}
      />
    );

    expect(screen.queryByTestId("subheader")).not.toBeInTheDocument();
    const addButton = screen.getByText("environments.surveys.edit.add_description");
    await userEvent.click(addButton);

    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      subheader: { en: "" },
    });
  });

  test("changes input type and updates placeholder", async () => {
    render(
      <OpenQuestionForm
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        localSurvey={mockSurvey}
        selectedLanguageCode="en"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale={"en" as TUserLocale}
        lastQuestion={false}
      />
    );

    const emailButton = screen.getByTestId("options-switch-email");
    await userEvent.click(emailButton);

    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      inputType: "email",
      placeholder: { en: "example@email.com" },
      longAnswer: false,
      charLimit: { min: undefined, max: undefined },
    });
    // Check if char limit section is hidden after switching to email
    expect(screen.queryByTestId("charLimit")).toBeNull();
  });

  test("toggles and updates character limits", async () => {
    // Initial render with charLimit disabled
    const initialProps = {
      question: { ...mockQuestion, charLimit: { enabled: false, min: undefined, max: undefined } },
      questionIdx: 0,
      updateQuestion: mockUpdateQuestion,
      isInvalid: false,
      localSurvey: mockSurvey,
      selectedLanguageCode: "en",
      setSelectedLanguageCode: mockSetSelectedLanguageCode,
      locale: "en" as TUserLocale,
      lastQuestion: false,
    };
    const { rerender } = render(<OpenQuestionForm {...initialProps} />);

    const charLimitToggle = screen.getByTestId("charLimit");
    expect(screen.queryByTestId("minLength")).not.toBeInTheDocument();
    expect(screen.queryByTestId("maxLength")).not.toBeInTheDocument();

    // Enable char limits via toggle click
    await userEvent.click(charLimitToggle);
    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      charLimit: { enabled: true, min: undefined, max: undefined },
    });

    // Simulate parent component updating the prop
    const updatedQuestionEnabled = {
      ...initialProps.question,
      charLimit: { enabled: true, min: undefined, max: undefined },
    };
    rerender(<OpenQuestionForm {...initialProps} question={updatedQuestionEnabled} />);

    // Inputs should now be visible
    const minInput = screen.getByTestId("minLength");
    const maxInput = screen.getByTestId("maxLength");
    expect(minInput).toBeInTheDocument();
    expect(maxInput).toBeInTheDocument();

    // Test setting input values using fireEvent.change
    fireEvent.change(minInput, { target: { value: "10" } });
    // Check the last call after changing value to "10"
    // Note: fireEvent.change might only trigger one call, so toHaveBeenCalledWith might be sufficient
    // but toHaveBeenLastCalledWith is safer if previous calls occurred.
    expect(mockUpdateQuestion).toHaveBeenLastCalledWith(0, {
      charLimit: { enabled: true, min: 10, max: undefined },
    });

    // Simulate parent updating prop after min input change
    const updatedQuestionMinSet = {
      ...updatedQuestionEnabled,
      charLimit: { enabled: true, min: 10, max: undefined },
    };
    rerender(<OpenQuestionForm {...initialProps} question={updatedQuestionMinSet} />);

    // Ensure maxInput is requeried if needed after rerender, though testId should persist
    const maxInputAfterRerender = screen.getByTestId("maxLength");
    fireEvent.change(maxInputAfterRerender, { target: { value: "100" } });
    // Check the last call after changing value to "100"
    expect(mockUpdateQuestion).toHaveBeenLastCalledWith(0, {
      charLimit: { enabled: true, min: 10, max: 100 },
    });

    // Simulate parent updating prop after max input change
    const updatedQuestionMaxSet = {
      ...updatedQuestionMinSet,
      charLimit: { enabled: true, min: 10, max: 100 },
    };
    rerender(<OpenQuestionForm {...initialProps} question={updatedQuestionMaxSet} />);

    // Disable char limits again via toggle click
    const charLimitToggleAgain = screen.getByTestId("charLimit");
    await userEvent.click(charLimitToggleAgain);
    expect(mockUpdateQuestion).toHaveBeenLastCalledWith(0, {
      charLimit: { enabled: false, min: undefined, max: undefined },
    });

    // Simulate parent updating prop after disabling
    const updatedQuestionDisabled = {
      ...updatedQuestionMaxSet,
      charLimit: { enabled: false, min: undefined, max: undefined },
    };
    rerender(<OpenQuestionForm {...initialProps} question={updatedQuestionDisabled} />);

    // Inputs should be hidden again
    expect(screen.queryByTestId("minLength")).not.toBeInTheDocument();
    expect(screen.queryByTestId("maxLength")).not.toBeInTheDocument();
  });

  test("initializes char limit toggle correctly if limits are pre-set", () => {
    const questionWithLimits = {
      ...mockQuestion,
      charLimit: { enabled: true, min: 5, max: 50 },
    };
    render(
      <OpenQuestionForm
        question={questionWithLimits}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        localSurvey={mockSurvey}
        selectedLanguageCode="en"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale={"en" as TUserLocale}
        lastQuestion={false}
      />
    );

    const charLimitToggle: HTMLInputElement = screen.getByTestId("charLimit");
    expect(charLimitToggle.checked).toBe(true);
    expect(screen.getByTestId("minLength")).toBeInTheDocument();
    expect(screen.getByTestId("maxLength")).toBeInTheDocument();
    expect(screen.getByTestId("minLength")).toHaveValue(5);
    expect(screen.getByTestId("maxLength")).toHaveValue(50);
  });
});
