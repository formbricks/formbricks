import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/preact";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { QuestionConditional } from "./question-conditional";

// Mock DateQuestion component
vi.mock("@/components/questions/date-question", () => ({
  DateQuestion: vi
    .fn()
    .mockImplementation(({ question }) => (
      <div data-testid="mock-date-question">{question.headline.default}</div>
    )),
}));

describe("QuestionConditional", () => {
  const mockOnChange = vi.fn();
  const mockOnSubmit = vi.fn();
  const mockOnBack = vi.fn();
  const mockOnFileUpload = vi.fn();
  const mockSetTtc = vi.fn();

  const baseProps = {
    onChange: mockOnChange,
    onSubmit: mockOnSubmit,
    onBack: mockOnBack,
    onFileUpload: mockOnFileUpload,
    isFirstQuestion: false,
    isLastQuestion: false,
    languageCode: "en",
    ttc: {},
    setTtc: mockSetTtc,
    surveyId: "test-survey",
    autoFocusEnabled: true,
    currentQuestionId: "q1",
    isBackButtonHidden: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders OpenText question correctly", () => {
    const question = {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText as const,
      headline: { default: "What's your name?" },
      required: true,
      placeholder: { default: "Type your answer here" },
      inputType: "text" as const,
      longAnswer: false,
      charLimit: { enabled: false },
      insightsEnabled: false,
    };

    render(<QuestionConditional {...baseProps} question={question} value="" />);

    expect(screen.getByText("What's your name?")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type your answer here")).toBeInTheDocument();
  });

  test("renders MultipleChoiceSingle question correctly", () => {
    const question = {
      id: "q2",
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle as const,
      headline: { default: "What's your favorite color?" },
      required: true,
      choices: [
        { id: "c1", label: { default: "Red" } },
        { id: "c2", label: { default: "Blue" } },
      ],
      shuffleOption: "none" as const,
      otherOption: { enabled: false },
      subheader: { default: "" },
    };

    render(<QuestionConditional {...baseProps} question={question} value="" />);

    expect(screen.getByText("What's your favorite color?")).toBeInTheDocument();
    expect(screen.getByText("Red")).toBeInTheDocument();
    expect(screen.getByText("Blue")).toBeInTheDocument();
  });

  test("handles prefilled values correctly", () => {
    const question = {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText as const,
      headline: { default: "What's your name?" },
      required: true,
      placeholder: { default: "Type your answer here" },
      inputType: "text" as const,
      longAnswer: false,
      charLimit: { enabled: false },
      insightsEnabled: false,
    };

    render(
      <QuestionConditional
        {...baseProps}
        question={question}
        value={undefined as any}
        prefilledQuestionValue="John"
        skipPrefilled={true}
      />
    );

    expect(mockOnSubmit).toHaveBeenCalledWith({ [question.id]: "John" }, { [question.id]: 0 });
  });

  test("renders Rating question correctly", () => {
    const question = {
      id: "q3",
      type: TSurveyQuestionTypeEnum.Rating as const,
      headline: { default: "How would you rate our service?" },
      required: true,
      scale: "number" as const,
      range: 5 as const,
      lowerLabel: { default: "Poor" },
      upperLabel: { default: "Excellent" },
      subheader: { default: "" },
      isColorCodingEnabled: false,
    };

    render(<QuestionConditional {...baseProps} question={question} value={0} />);

    expect(screen.getByText("How would you rate our service?")).toBeInTheDocument();
    expect(screen.getByText("Poor")).toBeInTheDocument();
    expect(screen.getByText("Excellent")).toBeInTheDocument();
  });

  test("renders MultipleChoiceMulti question correctly", () => {
    const question = {
      id: "q4",
      type: TSurveyQuestionTypeEnum.MultipleChoiceMulti as const,
      headline: { default: "Select your favorite fruits" },
      required: true,
      choices: [
        { id: "c1", label: { default: "Apple" } },
        { id: "c2", label: { default: "Banana" } },
      ],
      shuffleOption: "none" as const,
      otherOption: { enabled: false },
      subheader: { default: "" },
    };

    render(<QuestionConditional {...baseProps} question={question} value={[]} />);

    expect(screen.getByText("Select your favorite fruits")).toBeInTheDocument();
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();
  });

  test("renders NPS question correctly", () => {
    const question = {
      id: "q5",
      type: TSurveyQuestionTypeEnum.NPS as const,
      headline: { default: "How likely are you to recommend us?" },
      required: true,
      lowerLabel: { default: "Not likely" },
      upperLabel: { default: "Very likely" },
      subheader: { default: "" },
      isColorCodingEnabled: false,
    };

    render(<QuestionConditional {...baseProps} question={question} value={0} />);

    expect(screen.getByText("How likely are you to recommend us?")).toBeInTheDocument();
    expect(screen.getByText("Not likely")).toBeInTheDocument();
    expect(screen.getByText("Very likely")).toBeInTheDocument();
  });

  test("renders Date question correctly", () => {
    const question = {
      id: "q6",
      type: TSurveyQuestionTypeEnum.Date as const,
      headline: { default: "When is your birthday?" },
      required: true,
      subheader: { default: "" },
      format: "M-d-y" as const,
      html: { default: "" },
    };

    render(<QuestionConditional {...baseProps} question={question} value="" />);

    // Only verify the headline as the date picker component requires additional setup
    expect(screen.getByText("When is your birthday?")).toBeInTheDocument();
  });

  test("renders PictureSelection question correctly", () => {
    const question = {
      id: "q7",
      type: TSurveyQuestionTypeEnum.PictureSelection as const,
      headline: { default: "Choose your favorite picture" },
      required: true,
      choices: [
        { id: "p1", imageUrl: "https://example.com/pic1.jpg" },
        { id: "p2", imageUrl: "https://example.com/pic2.jpg" },
      ],
      allowMulti: false,
      subheader: { default: "" },
      isDraft: false,
    };

    render(<QuestionConditional {...baseProps} question={question} value={[]} />);

    expect(screen.getByText("Choose your favorite picture")).toBeInTheDocument();
  });

  test("handles unimplemented question type correctly", () => {
    const question: TSurveyQuestion = {
      id: "invalid",
      type: TSurveyQuestionTypeEnum.Address, // Address type doesn't have a matching case in the component
      headline: { default: "Invalid Question" },
      required: true,
      addressLine1: { show: true, required: true, placeholder: { default: "Address Line 1" } },
      addressLine2: { show: false, required: false, placeholder: { default: "Address Line 2" } },
      city: { show: true, required: true, placeholder: { default: "City" } },
      state: { show: true, required: true, placeholder: { default: "State" } },
      zip: { show: true, required: true, placeholder: { default: "Postal Code" } },
      country: { show: true, required: true, placeholder: { default: "Country" } },
      subheader: { default: "" },
    };

    render(<QuestionConditional {...baseProps} question={question} value="" />);

    expect(screen.getByText("Invalid Question")).toBeInTheDocument();
  });
});
