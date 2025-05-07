import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { type TSurveyOpenTextQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { OpenTextQuestion } from "./open-text-question";

// Mock the components that render headline and subheader
vi.mock("@/components/general/headline", () => ({
  Headline: ({ headline }: any) => <div data-testid="mock-headline">{headline}</div>,
}));

vi.mock("@/components/general/subheader", () => ({
  Subheader: ({ subheader }: any) => <div data-testid="mock-subheader">{subheader}</div>,
}));

vi.mock("@/lib/ttc", () => ({
  getUpdatedTtc: vi.fn().mockReturnValue({}),
  useTtc: vi.fn(),
}));

vi.mock("@/lib/i18n", () => ({
  getLocalizedValue: vi
    .fn()
    .mockImplementation((value) => (typeof value === "string" ? value : (value.en ?? value.default))),
}));

vi.mock("@/components/general/question-media", () => ({
  QuestionMedia: () => <div data-testid="question-media">Media Component</div>,
}));

describe("OpenTextQuestion", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const defaultQuestion = {
    id: "q1",
    type: TSurveyQuestionTypeEnum.OpenText,
    headline: { default: "Your feedback" },
    subheader: { default: "Please share your thoughts" },
    inputType: "text",
    placeholder: { default: "Type here..." },
    required: true,
    buttonLabel: { default: "Submit" },
    backButtonLabel: { default: "Back" },
    longAnswer: false,
  } as unknown as TSurveyOpenTextQuestion;

  const defaultProps = {
    question: defaultQuestion,
    value: "",
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onBack: vi.fn(),
    isFirstQuestion: true,
    isLastQuestion: false,
    languageCode: "en",
    ttc: {},
    setTtc: vi.fn(),
    autoFocusEnabled: false,
    currentQuestionId: "q1",
    isBackButtonHidden: false,
  };

  test("renders question with headline and subheader", () => {
    render(<OpenTextQuestion {...defaultProps} />);
    expect(screen.getByTestId("mock-headline")).toHaveTextContent("Your feedback");
    expect(screen.getByTestId("mock-subheader")).toHaveTextContent("Please share your thoughts");
  });

  test("handles input change for text field", async () => {
    const onChange = vi.fn();

    render(<OpenTextQuestion {...defaultProps} onChange={onChange} />);

    const input = screen.getByPlaceholderText("Type here...");

    // Directly set the input value and trigger the input event
    Object.defineProperty(input, "value", { value: "Hello" });
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith({ q1: "Hello" });
  });

  test("submits form with entered value", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const setTtc = vi.fn();

    render(<OpenTextQuestion {...defaultProps} value="My feedback" onSubmit={onSubmit} setTtc={setTtc} />);

    const submitButton = screen.getByRole("button", { name: "Submit" });
    await user.click(submitButton);

    expect(onSubmit).toHaveBeenCalledWith({ q1: "My feedback" }, {});
    expect(setTtc).toHaveBeenCalled();
  });

  test("displays back button when not first question", () => {
    render(<OpenTextQuestion {...defaultProps} isFirstQuestion={false} />);
    expect(screen.getByText("Back")).toBeInTheDocument();
  });

  test("hides back button when isBackButtonHidden is true", () => {
    render(<OpenTextQuestion {...defaultProps} isFirstQuestion={false} isBackButtonHidden={true} />);
    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });

  test("calls onBack when back button is clicked", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const setTtc = vi.fn();

    render(<OpenTextQuestion {...defaultProps} isFirstQuestion={false} onBack={onBack} setTtc={setTtc} />);

    const backButton = screen.getByText("Back");
    await user.click(backButton);

    expect(onBack).toHaveBeenCalled();
    expect(setTtc).toHaveBeenCalled();
  });

  test("renders textarea for long answers", () => {
    render(<OpenTextQuestion {...defaultProps} question={{ ...defaultQuestion, longAnswer: true }} />);

    expect(screen.getByRole("textbox")).toHaveAttribute("rows", "3");
  });

  test("displays character limit when configured", () => {
    render(<OpenTextQuestion {...defaultProps} question={{ ...defaultQuestion, charLimit: { max: 100 } }} />);

    expect(screen.getByText("0/100")).toBeInTheDocument();
  });

  test("renders with media when available", () => {
    render(<OpenTextQuestion {...defaultProps} question={{ ...defaultQuestion, imageUrl: "test.jpg" }} />);
    expect(screen.getByTestId("question-media")).toBeInTheDocument();
  });

  test("applies input validation for phone type", () => {
    render(<OpenTextQuestion {...defaultProps} question={{ ...defaultQuestion, inputType: "phone" }} />);

    const input = screen.getByPlaceholderText("Type here...");
    expect(input).toHaveAttribute("pattern", "^[0-9+][0-9+\\- ]*[0-9]$");
    expect(input).toHaveAttribute("title", "Enter a valid phone number");
  });

  test("applies correct attributes for required fields", () => {
    render(<OpenTextQuestion {...defaultProps} />);

    const input = screen.getByPlaceholderText("Type here...");
    expect(input).toBeRequired();
  });

  test("auto focuses input when enabled and is current question", () => {
    const focusMock = vi.fn();
    // Mock the ref implementation for this test
    window.HTMLElement.prototype.focus = focusMock;

    render(<OpenTextQuestion {...defaultProps} autoFocusEnabled={true} currentQuestionId="q1" />);

    expect(focusMock).toHaveBeenCalled();
  });
});
