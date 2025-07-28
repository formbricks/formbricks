import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TLanguage } from "@formbricks/types/project";
import { TSurvey, TSurveyNPSQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { NPSQuestionForm } from "./nps-question-form";

// Mock child components
vi.mock("@/modules/survey/components/question-form-input", () => ({
  QuestionFormInput: vi.fn(({ id, value, label, placeholder }) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} data-testid={id} value={value?.default || ""} placeholder={placeholder} readOnly />
    </div>
  )),
}));

vi.mock("@/modules/ui/components/advanced-option-toggle", () => ({
  AdvancedOptionToggle: vi.fn(({ isChecked, onToggle, title, description }) => (
    <div>
      <label>
        {title}
        <input type="checkbox" checked={isChecked} onChange={onToggle} />
      </label>
      <p>{description}</p>
    </div>
  )),
}));

// Mock hooks
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [vi.fn()],
}));

const mockUpdateQuestion = vi.fn();
const mockSetSelectedLanguageCode = vi.fn();

const baseQuestion: TSurveyNPSQuestion = {
  id: "nps1",
  type: TSurveyQuestionTypeEnum.NPS,
  headline: { default: "Rate your experience" },
  lowerLabel: { default: "Not likely" },
  upperLabel: { default: "Very likely" },
  required: true,
  isColorCodingEnabled: false,
};

const baseSurvey = {
  id: "survey1",
  name: "Test Survey",
  type: "app",
  status: "draft",
  questions: [baseQuestion],
  languages: [
    {
      language: { code: "default" } as unknown as TLanguage,
      default: false,
      enabled: false,
    },
  ],
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
  displayPercentage: null,
  welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
  endings: [],
  hiddenFields: { enabled: false },
  variables: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  environmentId: "env1",
} as unknown as TSurvey;

const locale: TUserLocale = "en-US";

describe("NPSQuestionForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders basic elements", () => {
    render(
      <NPSQuestionForm
        localSurvey={baseSurvey}
        question={baseQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        lastQuestion={true}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        isInvalid={false}
        locale={locale}
      />
    );

    expect(screen.getByLabelText("environments.surveys.edit.question*")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Rate your experience")).toBeInTheDocument();
    expect(screen.getByLabelText("environments.surveys.edit.lower_label")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Not likely")).toBeInTheDocument();
    expect(screen.getByLabelText("environments.surveys.edit.upper_label")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Very likely")).toBeInTheDocument();
    expect(screen.getByLabelText("environments.surveys.edit.add_color_coding")).toBeInTheDocument();
    expect(screen.queryByLabelText("environments.surveys.edit.next_button_label")).not.toBeInTheDocument(); // Required = true
  });

  test("renders subheader input when subheader exists", () => {
    const questionWithSubheader = { ...baseQuestion, subheader: { default: "Please elaborate" } };
    render(
      <NPSQuestionForm
        localSurvey={baseSurvey}
        question={questionWithSubheader}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        lastQuestion={true}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        isInvalid={false}
        locale={locale}
      />
    );
    expect(screen.getByLabelText("common.description")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Please elaborate")).toBeInTheDocument();
    expect(screen.queryByText("environments.surveys.edit.add_description")).not.toBeInTheDocument();
  });

  test("renders 'Add description' button when subheader is undefined and calls updateQuestion on click", async () => {
    const user = userEvent.setup();
    render(
      <NPSQuestionForm
        localSurvey={baseSurvey}
        question={baseQuestion} // No subheader here
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        lastQuestion={true}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        isInvalid={false}
        locale={locale}
      />
    );

    const addButton = screen.getByText("environments.surveys.edit.add_description");
    expect(addButton).toBeInTheDocument();
    await user.click(addButton);
    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, { subheader: { default: "" } });
  });

  test("renders button label input when question is not required", () => {
    const optionalQuestion = { ...baseQuestion, required: false, buttonLabel: { default: "Next" } };
    render(
      <NPSQuestionForm
        localSurvey={baseSurvey}
        question={optionalQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        lastQuestion={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        isInvalid={false}
        locale={locale}
      />
    );
    expect(screen.getByLabelText("environments.surveys.edit.next_button_label")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Next")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("common.next")).toBeInTheDocument();
  });

  test("calls updateQuestion when color coding is toggled", async () => {
    const user = userEvent.setup();
    render(
      <NPSQuestionForm
        localSurvey={baseSurvey}
        question={baseQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        lastQuestion={true}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        isInvalid={false}
        locale={locale}
      />
    );

    const toggle = screen.getByLabelText("environments.surveys.edit.add_color_coding");
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, { isColorCodingEnabled: true });
  });

  test("renders button label input with 'Finish' placeholder when it is the last question and not required", () => {
    const optionalQuestion = { ...baseQuestion, required: false, buttonLabel: { default: "Go" } };
    render(
      <NPSQuestionForm
        localSurvey={baseSurvey}
        question={optionalQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        lastQuestion={true} // Last question
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        isInvalid={false}
        locale={locale}
      />
    );
    expect(screen.getByLabelText("environments.surveys.edit.next_button_label")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Go")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("common.finish")).toBeInTheDocument(); // Placeholder should be Finish
  });
});
