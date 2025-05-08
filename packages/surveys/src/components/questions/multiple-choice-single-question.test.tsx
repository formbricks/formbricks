import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type TResponseTtc } from "@formbricks/types/responses";
import { type TSurveyMultipleChoiceQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { MultipleChoiceSingleQuestion } from "./multiple-choice-single-question";

// Mock components
vi.mock("@/components/buttons/back-button", () => ({
  BackButton: ({
    onClick,
    backButtonLabel,
    tabIndex,
  }: {
    onClick: () => void;
    backButtonLabel: string;
    tabIndex: number;
  }) => (
    <button data-testid="back-button" onClick={onClick} tabIndex={tabIndex}>
      {backButtonLabel}
    </button>
  ),
}));

vi.mock("@/components/buttons/submit-button", () => ({
  SubmitButton: ({ buttonLabel, tabIndex }: { buttonLabel: string; tabIndex: number }) => (
    <button data-testid="submit-button" type="submit" tabIndex={tabIndex}>
      {buttonLabel}
    </button>
  ),
}));

vi.mock("@/components/general/headline", () => ({
  Headline: ({ headline }: { headline: string }) => <h1 data-testid="headline">{headline}</h1>,
}));

vi.mock("@/components/general/subheader", () => ({
  Subheader: ({ subheader }: { subheader: string }) => <p data-testid="subheader">{subheader}</p>,
}));

vi.mock("@/components/general/question-media", () => ({
  QuestionMedia: () => <div data-testid="question-media">Media Content</div>,
}));

vi.mock("@/components/wrappers/scrollable-container", () => ({
  ScrollableContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scrollable-container">{children}</div>
  ),
}));

// Mock utility functions
vi.mock("@/lib/i18n", () => ({
  getLocalizedValue: vi.fn((obj, lang) => obj[lang] || obj["default"]),
}));

vi.mock("@/lib/ttc", () => ({
  getUpdatedTtc: vi.fn((ttc, questionId, time) => ({ ...ttc, [questionId]: time })),
  useTtc: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  cn: vi.fn((...args) => args.filter(Boolean).join(" ")),
  getShuffledChoicesIds: vi.fn((choices) => choices.map((choice: any) => choice.id)),
}));

// Test data
const mockQuestion: TSurveyMultipleChoiceQuestion = {
  id: "q1",
  type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
  headline: { default: "Test Question" },
  subheader: { default: "This is a test question" },
  required: true,
  choices: [
    { id: "c1", label: { default: "Choice 1" } },
    { id: "c2", label: { default: "Choice 2" } },
    { id: "other", label: { default: "Other" } },
  ],
  shuffleOption: "none",
  buttonLabel: { default: "Next" },
  backButtonLabel: { default: "Back" },
  otherOptionPlaceholder: { default: "Please specify" },
};

describe("MultipleChoiceSingleQuestion", () => {
  const mockOnChange = vi.fn();
  const mockOnSubmit = vi.fn();
  const mockOnBack = vi.fn();
  const mockSetTtc = vi.fn();

  const defaultProps = {
    question: mockQuestion,
    onChange: mockOnChange,
    onSubmit: mockOnSubmit,
    onBack: mockOnBack,
    isFirstQuestion: false,
    isLastQuestion: false,
    languageCode: "default",
    ttc: {} as TResponseTtc,
    setTtc: mockSetTtc,
    autoFocusEnabled: false,
    currentQuestionId: "q1",
    isBackButtonHidden: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "performance", {
      value: { now: vi.fn(() => 1000) },
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  test("renders the question with choices", () => {
    render(<MultipleChoiceSingleQuestion {...defaultProps} />);

    expect(screen.getByTestId("headline")).toHaveTextContent("Test Question");
    expect(screen.getByTestId("subheader")).toHaveTextContent("This is a test question");
    expect(screen.getByLabelText("Choice 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Choice 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Other")).toBeInTheDocument();
  });

  test("displays media content when available", () => {
    const questionWithMedia = {
      ...mockQuestion,
      imageUrl: "https://example.com/image.jpg",
    };

    render(<MultipleChoiceSingleQuestion {...defaultProps} question={questionWithMedia} />);
    expect(screen.getByTestId("question-media")).toBeInTheDocument();
  });

  test("allows selecting a choice", async () => {
    const user = userEvent.setup();
    render(<MultipleChoiceSingleQuestion {...defaultProps} />);

    const choice1Radio = screen.getByLabelText("Choice 1");
    await user.click(choice1Radio);

    expect(mockOnChange).toHaveBeenCalledWith({ q1: "Choice 1" });
  });

  test("shows input field when 'Other' option is selected", async () => {
    const user = userEvent.setup();
    render(<MultipleChoiceSingleQuestion {...defaultProps} />);

    const otherRadio = screen.getByLabelText("Other");
    await user.click(otherRadio);

    expect(screen.getByPlaceholderText("Please specify")).toBeInTheDocument();
  });

  test("handles 'other' option input change", async () => {
    const user = userEvent.setup();

    // Render with initial value to simulate user typing in the other field
    render(
      <MultipleChoiceSingleQuestion
        {...defaultProps}
        value="" // Start with empty string
      />
    );

    // Use getByRole to more specifically target the radio input
    const otherRadio = screen.getByRole("radio", { name: "Other" });
    await user.click(otherRadio);

    // Clear mock calls from the initial setup
    mockOnChange.mockClear();

    // Get the input and simulate change directly
    const otherInput = screen.getByPlaceholderText("Please specify");

    // Use fireEvent directly for more reliable testing of the onChange handler
    (otherInput as any).value = "Custom response";
    otherInput.dispatchEvent(new Event("input", { bubbles: true }));
    otherInput.dispatchEvent(new Event("change", { bubbles: true }));

    // Verify the onChange handler was called with the correct value
    expect(mockOnChange).toHaveBeenCalledWith({ q1: "Custom response" });
  });

  test("submits form with selected value", async () => {
    const user = userEvent.setup();
    render(<MultipleChoiceSingleQuestion {...defaultProps} value="Choice 1" />);

    const submitButton = screen.getByTestId("submit-button");
    await user.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith({ q1: "Choice 1" }, expect.any(Object));
  });

  test("calls onBack when back button is clicked", async () => {
    const user = userEvent.setup();
    render(<MultipleChoiceSingleQuestion {...defaultProps} />);

    const backButton = screen.getByTestId("back-button");
    await user.click(backButton);

    expect(mockOnBack).toHaveBeenCalled();
    expect(mockSetTtc).toHaveBeenCalled();
  });

  test("hides back button when isFirstQuestion or isBackButtonHidden is true", () => {
    render(<MultipleChoiceSingleQuestion {...defaultProps} isFirstQuestion={true} />);
    expect(screen.queryByTestId("back-button")).not.toBeInTheDocument();

    cleanup();

    render(<MultipleChoiceSingleQuestion {...defaultProps} isBackButtonHidden={true} />);
    expect(screen.queryByTestId("back-button")).not.toBeInTheDocument();
  });

  test("handles prefilled answer from URL for first question", () => {
    // Mock URL parameter properly for URLSearchParams
    const searchParams = new URLSearchParams();
    searchParams.append("q1", "Choice 1");

    Object.defineProperty(window, "location", {
      value: {
        search: `?${searchParams.toString()}`,
      },
      writable: true,
    });

    // We need to make sure the component actually checks for the URL param
    // To do this, we'll create a mock URLSearchParams with a spy
    const mockGet = vi.fn().mockReturnValue("Choice 1");
    const mockURLSearchParams = vi.fn(() => ({
      get: mockGet,
    }));

    global.URLSearchParams = mockURLSearchParams as any;

    render(
      <MultipleChoiceSingleQuestion
        {...defaultProps}
        isFirstQuestion={true}
        // Ensure value is undefined so the prefill logic runs
        value={undefined}
      />
    );

    // Verify the URLSearchParams was called with the correct search string
    expect(mockURLSearchParams).toHaveBeenCalledWith(window.location.search);
    // Verify the get method was called with the question id
    expect(mockGet).toHaveBeenCalledWith("q1");
  });

  test("applies accessibility attributes correctly", () => {
    render(<MultipleChoiceSingleQuestion {...defaultProps} />);

    const radioGroup = screen.getByRole("radiogroup");
    expect(radioGroup).toBeInTheDocument();

    const radioInputs = screen.getAllByRole("radio");
    expect(radioInputs.length).toBe(3); // 2 regular choices + Other
  });

  test("sets focus correctly when currentQuestionId matches question.id", () => {
    render(<MultipleChoiceSingleQuestion {...defaultProps} currentQuestionId="q1" />);

    const submitButton = screen.getByTestId("submit-button");
    expect(submitButton).toHaveAttribute("tabIndex", "0");

    const backButton = screen.getByTestId("back-button");
    expect(backButton).toHaveAttribute("tabIndex", "0");
  });
});
