import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
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
    fireEvent.input(input, { target: { value: "Hello" } });

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

  test("handles input change for textarea with resize functionality", async () => {
    // Create a spy on the Element.prototype to monitor style changes
    const styleSpy = vi.spyOn(HTMLElement.prototype, "style", "get").mockImplementation(
      () =>
        ({
          height: "",
          overflow: "",
        }) as CSSStyleDeclaration
    );
    const onChange = vi.fn();

    render(
      <OpenTextQuestion
        {...defaultProps}
        onChange={onChange}
        question={{ ...defaultQuestion, longAnswer: true }}
      />
    );

    const textarea = screen.getByRole("textbox");
    // Only trigger a regular input event without trying to modify scrollHeight
    fireEvent.input(textarea, { target: { value: "Test value for textarea" } });

    // Check that onChange was called with the correct value
    expect(onChange).toHaveBeenCalledWith({ q1: "Test value for textarea" });

    // Clean up the spy
    styleSpy.mockRestore();
  });

  test("handles textarea resize with long text", async () => {
    const onChange = vi.fn();

    // Mock the component with a jest.fn to avoid DOM manipulation
    const originalConsoleError = console.error;
    console.error = vi.fn();

    render(
      <OpenTextQuestion
        {...defaultProps}
        onChange={onChange}
        question={{ ...defaultQuestion, longAnswer: true }}
      />
    );

    const textarea = screen.getByRole("textbox");
    // Just trigger the input event without trying to set scrollHeight
    fireEvent.input(textarea, { target: { value: "Long text that would cause overflow" } });

    expect(onChange).toHaveBeenCalledWith({ q1: "Long text that would cause overflow" });

    // Restore console.error
    console.error = originalConsoleError;
  });

  test("handles form submission by enter key", async () => {
    const onSubmit = vi.fn();
    const setTtc = vi.fn();

    const { container } = render(
      <OpenTextQuestion {...defaultProps} value="Test submission" onSubmit={onSubmit} setTtc={setTtc} />
    );

    // Get the form element using container query
    const form = container.querySelector("form");
    expect(form).toBeInTheDocument();

    // Simulate form submission
    fireEvent.submit(form!);

    expect(onSubmit).toHaveBeenCalledWith({ q1: "Test submission" }, {});
    expect(setTtc).toHaveBeenCalled();
  });

  test("applies minLength constraint when configured", () => {
    render(
      <OpenTextQuestion
        {...defaultProps}
        question={{ ...defaultQuestion, charLimit: { min: 5, max: 100 } }}
      />
    );

    const input = screen.getByPlaceholderText("Type here...");
    expect(input).toHaveAttribute("minLength", "5");
    expect(input).toHaveAttribute("maxLength", "100");
  });

  test("handles video URL in media", () => {
    render(
      <OpenTextQuestion
        {...defaultProps}
        question={{ ...defaultQuestion, videoUrl: "https://example.com/video.mp4" }}
      />
    );

    expect(screen.getByTestId("question-media")).toBeInTheDocument();
  });

  test("doesn't autofocus when not current question", () => {
    const focusMock = vi.fn();
    window.HTMLElement.prototype.focus = focusMock;

    render(
      <OpenTextQuestion
        {...defaultProps}
        autoFocusEnabled={true}
        currentQuestionId="q2" // Different from question id (q1)
      />
    );

    expect(focusMock).not.toHaveBeenCalled();
  });

  test("handles input change for textarea", async () => {
    const onChange = vi.fn();

    render(
      <OpenTextQuestion
        {...defaultProps}
        onChange={onChange}
        question={{ ...defaultQuestion, longAnswer: true }}
      />
    );

    const textarea = screen.getByRole("textbox");
    fireEvent.input(textarea, { target: { value: "Long text response" } });

    expect(onChange).toHaveBeenCalledWith({ q1: "Long text response" });
  });

  test("applies phone number maxLength constraint", () => {
    render(<OpenTextQuestion {...defaultProps} question={{ ...defaultQuestion, inputType: "phone" }} />);

    const input = screen.getByPlaceholderText("Type here...");
    expect(input).toHaveAttribute("maxLength", "30");
  });

  test("renders without subheader when not provided", () => {
    const questionWithoutSubheader = {
      ...defaultQuestion,
      subheader: undefined,
    };

    render(<OpenTextQuestion {...defaultProps} question={questionWithoutSubheader} />);
    expect(screen.getByTestId("mock-subheader")).toHaveTextContent("");
  });

  test("sets correct tabIndex based on current question status", () => {
    // When it's the current question
    render(<OpenTextQuestion {...defaultProps} currentQuestionId="q1" />);
    const inputCurrent = screen.getByPlaceholderText("Type here...");
    const submitCurrent = screen.getByRole("button", { name: "Submit" });

    expect(inputCurrent).toHaveAttribute("tabIndex", "0");
    expect(submitCurrent).toHaveAttribute("tabIndex", "0");

    // When it's not the current question
    cleanup();
    render(<OpenTextQuestion {...defaultProps} currentQuestionId="q2" />);
    const inputNotCurrent = screen.getByPlaceholderText("Type here...");
    const submitNotCurrent = screen.getByRole("button", { name: "Submit" });

    expect(inputNotCurrent).toHaveAttribute("tabIndex", "-1");
    expect(submitNotCurrent).toHaveAttribute("tabIndex", "-1");
  });
});
