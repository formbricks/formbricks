import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { ComponentChildren } from "preact";
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
  QuestionMedia: ({ imgUrl, videoUrl }: { imgUrl?: string; videoUrl?: string }) => (
    <div data-testid="question-media" data-img-url={imgUrl} data-video-url={videoUrl} />
  ),
}));

vi.mock("@/components/wrappers/scrollable-container", () => ({
  ScrollableContainer: ({ children }: { children: ComponentChildren }) => (
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

// Mock the utils for shuffling
vi.mock("@/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
  getShuffledChoicesIds: vi.fn((choices: Array<{ id: string }>, option: string) => {
    if (option === "all") {
      // Return in reverse to simulate shuffling
      return choices.map((choice: { id: string }) => choice.id).reverse();
    }
    return choices.map((choice: { id: string }) => choice.id);
  }),
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

  test("renders image media when available", () => {
    const questionWithImage = {
      ...defaultProps.question,
      imageUrl: "https://example.com/image.jpg",
    };

    render(<MultipleChoiceMultiQuestion {...defaultProps} question={questionWithImage} />);
    expect(screen.getByTestId("question-media")).toBeInTheDocument();
    expect(screen.getByTestId("question-media")).toHaveAttribute(
      "data-img-url",
      "https://example.com/image.jpg"
    );
  });

  test("renders video media when available", () => {
    const questionWithVideo = {
      ...defaultProps.question,
      videoUrl: "https://example.com/video.mp4",
    };

    render(<MultipleChoiceMultiQuestion {...defaultProps} question={questionWithVideo} />);
    expect(screen.getByTestId("question-media")).toBeInTheDocument();
    expect(screen.getByTestId("question-media")).toHaveAttribute(
      "data-video-url",
      "https://example.com/video.mp4"
    );
  });

  test("handles shuffled choices correctly with 'all' option", () => {
    const shuffledQuestion = {
      ...defaultProps.question,
      shuffleOption: "all",
    } as TSurveyMultipleChoiceQuestion;

    render(<MultipleChoiceMultiQuestion {...defaultProps} question={shuffledQuestion} />);

    // All options should still be rendered regardless of shuffle
    expect(screen.getByLabelText("Option 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Other")).toBeInTheDocument();
  });

  test("handles keyboard accessibility with spacebar", async () => {
    render(<MultipleChoiceMultiQuestion {...defaultProps} />);

    // Find the label for the first option
    const option1Label = screen.getByText("Option 1").closest("label");
    expect(option1Label).toBeInTheDocument();

    // Simulate pressing spacebar on the label
    fireEvent.keyDown(option1Label!, { key: " " });

    // Check if onChange was called with the correct value
    expect(defaultProps.onChange).toHaveBeenCalledWith({ q1: ["Option 1"] });
  });

  test("handles deselecting 'Other' option", async () => {
    const onChange = vi.fn();
    // Initial render with 'Other' already selected and a custom value
    const { rerender } = render(
      <MultipleChoiceMultiQuestion {...defaultProps} value={["Custom response"]} onChange={onChange} />
    );

    // Verify 'Other' is checked using id
    const otherCheckbox = screen.getByRole("checkbox", { name: "Other" });
    expect(otherCheckbox).toBeInTheDocument();
    expect(otherCheckbox).toBeChecked();

    // Also verify the input has the custom value
    expect(screen.getByDisplayValue("Custom response")).toBeInTheDocument();

    // Click to deselect the 'Other' option
    await userEvent.click(otherCheckbox);

    // Check if onChange was called with empty array
    expect(onChange).toHaveBeenCalledWith({ q1: [] });

    // Rerender to update the component with new value
    rerender(<MultipleChoiceMultiQuestion {...defaultProps} value={[]} onChange={onChange} />);

    // Verify the input field is not displayed anymore
    expect(screen.queryByPlaceholderText("Please specify")).not.toBeInTheDocument();
  });

  test("initializes with 'Other' selected when value doesn't match any choice", () => {
    render(<MultipleChoiceMultiQuestion {...defaultProps} value={["Custom answer"]} />);

    // Verify 'Other' is checked
    const otherCheckbox = screen.getByRole("checkbox", { name: "Other" });
    expect(otherCheckbox).toBeChecked();

    // Verify the input has the custom value
    expect(screen.getByDisplayValue("Custom answer")).toBeInTheDocument();
  });

  test("combines regular choices and 'Other' value on submission", async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <MultipleChoiceMultiQuestion
        {...defaultProps}
        value={["Option 1", "Custom answer"]}
        onSubmit={onSubmit}
      />
    );

    // Verify both Option 1 and Other are checked
    const option1Checkbox = screen.getByRole("checkbox", { name: "Option 1" });
    const otherCheckbox = screen.getByRole("checkbox", { name: "Other" });
    expect(option1Checkbox).toBeChecked();
    expect(otherCheckbox).toBeChecked();

    // Get the form and submit it
    const form = container.querySelector("form");
    expect(form).toBeInTheDocument();
    fireEvent.submit(form!);

    // Check if onSubmit was called with both values
    expect(onSubmit).toHaveBeenCalledWith({ q1: ["Option 1", "Custom answer"] }, { questionId: "ttc-value" });
  });

  test("handles required validation correctly", async () => {
    const onSubmit = vi.fn();
    // Create a non-required question
    const nonRequiredQuestion = {
      ...defaultProps.question,
      required: false,
    };

    const { container, rerender } = render(
      <MultipleChoiceMultiQuestion
        {...defaultProps}
        question={nonRequiredQuestion}
        value={[]}
        onSubmit={onSubmit}
      />
    );

    // Get the form and submit it with empty selection
    const form = container.querySelector("form");
    expect(form).toBeInTheDocument();
    fireEvent.submit(form!);

    // Check if onSubmit was called even with empty value
    expect(onSubmit).toHaveBeenCalledWith({ q1: [] }, { questionId: "ttc-value" });

    // Now test with required=true
    vi.clearAllMocks();
    rerender(<MultipleChoiceMultiQuestion {...defaultProps} value={[]} onSubmit={onSubmit} />);

    // Check if at least one checkbox has the required attribute
    const checkboxes = screen.getAllByRole("checkbox");
    const hasRequiredCheckbox = checkboxes.some((checkbox) => checkbox.hasAttribute("required"));
    expect(hasRequiredCheckbox).toBe(true);
  });
});
