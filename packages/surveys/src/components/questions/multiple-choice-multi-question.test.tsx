import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TSurveyMultipleChoiceQuestion } from "@formbricks/types/surveys/types";
import { MultipleChoiceMultiQuestion } from "./multiple-choice-multi-question";

// Mock components
vi.mock("@/components/buttons/back-button", () => ({
  BackButton: ({ onClick, backButtonLabel }: { onClick: () => void; backButtonLabel?: string }) => (
    <button onClick={onClick} data-testid="back-button">
      {backButtonLabel ?? "Back"}
    </button>
  ),
}));

vi.mock("@/components/buttons/submit-button", () => ({
  SubmitButton: ({ buttonLabel }: { buttonLabel?: string }) => (
    <button type="submit" data-testid="submit-button">
      {buttonLabel ?? "Submit"}
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
  QuestionMedia: () => <div data-testid="question-media" />,
}));

vi.mock("@/components/wrappers/scrollable-container", () => ({
  ScrollableContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scrollable-container">{children}</div>
  ),
}));

vi.mock("@/lib/ttc", () => ({
  useTtc: vi.fn(),
  getUpdatedTtc: vi.fn(() => ({ questionId: "ttc-value" })),
}));

vi.mock("@/lib/i18n", () => ({
  getLocalizedValue: (_value: any, _languageCode: string) => {
    if (typeof _value === "string") return _value;
    return _value?.["en"] ?? _value?.default ?? "";
  },
}));

describe("MultipleChoiceMultiQuestion", () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    question: {
      id: "q1",
      type: "multipleChoiceMulti",
      headline: { en: "Test Question" },
      subheader: { en: "Select multiple options" },
      required: true,
      choices: [
        { id: "c1", label: { en: "Option 1" } },
        { id: "c2", label: { en: "Option 2" } },
        { id: "c3", label: { en: "Option 3" } },
        { id: "other", label: { en: "Other" } },
      ],
      buttonLabel: { en: "Next" },
      backButtonLabel: { en: "Back" },
      otherOptionPlaceholder: { en: "Please specify" },
    } as TSurveyMultipleChoiceQuestion,
    value: [],
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onBack: vi.fn(),
    isFirstQuestion: false,
    isLastQuestion: false,
    languageCode: "en",
    ttc: {},
    setTtc: vi.fn(),
    autoFocusEnabled: false,
    currentQuestionId: "q1",
    isBackButtonHidden: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders the component correctly", () => {
    render(<MultipleChoiceMultiQuestion {...defaultProps} />);

    expect(screen.getByTestId("headline")).toBeInTheDocument();
    expect(screen.getByTestId("subheader")).toBeInTheDocument();
    expect(screen.getByTestId("back-button")).toBeInTheDocument();
    expect(screen.getByTestId("submit-button")).toBeInTheDocument();

    // Check all options are rendered
    expect(screen.getByLabelText("Option 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Other")).toBeInTheDocument();
  });

  test("handles selecting options", async () => {
    // Test selecting first option (starting with empty array)
    const onChange1 = vi.fn();
    const { unmount } = render(
      <MultipleChoiceMultiQuestion {...defaultProps} value={[]} onChange={onChange1} />
    );
    await userEvent.click(screen.getByLabelText("Option 1"));
    expect(onChange1).toHaveBeenCalledWith({ q1: ["Option 1"] });
    unmount();

    // Test selecting second option (already having first option selected)
    const onChange2 = vi.fn();
    const { unmount: unmount2 } = render(
      <MultipleChoiceMultiQuestion {...defaultProps} value={["Option 1"]} onChange={onChange2} />
    );
    await userEvent.click(screen.getByLabelText("Option 2"));
    expect(onChange2).toHaveBeenCalledWith({ q1: ["Option 1", "Option 2"] });
    unmount2();

    // Test deselecting an option
    const onChange3 = vi.fn();
    render(
      <MultipleChoiceMultiQuestion {...defaultProps} value={["Option 1", "Option 2"]} onChange={onChange3} />
    );
    await userEvent.click(screen.getByLabelText("Option 1"));
    expect(onChange3).toHaveBeenCalledWith({ q1: ["Option 2"] });
  });

  test("handles form submission", async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <MultipleChoiceMultiQuestion {...defaultProps} value={["Option 1"]} onSubmit={onSubmit} />
    );

    // Get the form directly and submit it
    const form = container.querySelector("form");
    expect(form).toBeInTheDocument();
    fireEvent.submit(form!);

    expect(onSubmit).toHaveBeenCalledWith({ q1: ["Option 1"] }, { questionId: "ttc-value" });
  });

  test("filters out invalid values during submission", async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <MultipleChoiceMultiQuestion
        {...defaultProps}
        // Add an invalid value that should be filtered out
        value={["Option 1", "Invalid Option"]}
        onSubmit={onSubmit}
      />
    );

    // Submit the form
    const form = container.querySelector("form");
    fireEvent.submit(form!);

    // Check that onSubmit was called with only valid values
    expect(onSubmit).toHaveBeenCalledWith({ q1: ["Option 1"] }, { questionId: "ttc-value" });
  });

  test("calls onChange with updated values during submission", async () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const { container } = render(
      <MultipleChoiceMultiQuestion
        {...defaultProps}
        value={["Option 1", "Invalid Option"]}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    // Submit the form
    const form = container.querySelector("form");
    fireEvent.submit(form!);

    // Check that onChange was called with filtered values
    expect(onChange).toHaveBeenCalledWith({ q1: ["Option 1"] });
    expect(onSubmit).toHaveBeenCalledWith({ q1: ["Option 1"] }, { questionId: "ttc-value" });
  });

  test("calls onBack when back button is clicked", async () => {
    const onBack = vi.fn();
    render(<MultipleChoiceMultiQuestion {...defaultProps} onBack={onBack} />);

    await userEvent.click(screen.getByTestId("back-button"));

    expect(onBack).toHaveBeenCalled();
    expect(defaultProps.setTtc).toHaveBeenCalledWith({ questionId: "ttc-value" });
  });

  test("hides back button when isFirstQuestion is true or isBackButtonHidden is true", () => {
    const { rerender } = render(<MultipleChoiceMultiQuestion {...defaultProps} isFirstQuestion={true} />);
    expect(screen.queryByTestId("back-button")).not.toBeInTheDocument();

    rerender(<MultipleChoiceMultiQuestion {...defaultProps} isBackButtonHidden={true} />);
    expect(screen.queryByTestId("back-button")).not.toBeInTheDocument();
  });

  test("renders media when available", () => {
    const questionWithMedia = {
      ...defaultProps.question,
      imageUrl: "https://example.com/image.jpg",
    };

    render(<MultipleChoiceMultiQuestion {...defaultProps} question={questionWithMedia} />);
    expect(screen.getByTestId("question-media")).toBeInTheDocument();
  });

  test("handles shuffled choices correctly", () => {
    const shuffledQuestion = {
      ...defaultProps.question,
      shuffleOption: "all",
    } as TSurveyMultipleChoiceQuestion;

    render(<MultipleChoiceMultiQuestion {...defaultProps} question={shuffledQuestion} />);
    expect(screen.getByLabelText("Option 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 3")).toBeInTheDocument();
  });
});
