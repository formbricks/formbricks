import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyMultipleChoiceQuestion } from "@formbricks/types/surveys/types";
import { MultipleChoiceMultiQuestion } from "./multiple-choice-multi-question";

// Mock components
vi.mock("@/components/buttons/back-button", () => ({
  BackButton: ({ onClick, backButtonLabel }: { onClick: () => void; backButtonLabel?: string }) => (
    <button onClick={onClick} data-testid="back-button">
      {backButtonLabel || "Back"}
    </button>
  ),
}));

vi.mock("@/components/buttons/submit-button", () => ({
  SubmitButton: ({ buttonLabel }: { buttonLabel?: string }) => (
    <button type="submit" data-testid="submit-button">
      {buttonLabel || "Submit"}
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
    return _value?.["en"] || "";
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
    render(<MultipleChoiceMultiQuestion {...defaultProps} />);

    await userEvent.click(screen.getByLabelText("Option 1"));
    expect(defaultProps.onChange).toHaveBeenCalledWith({ q1: ["Option 1"] });

    await userEvent.click(screen.getByLabelText("Option 2"));
    expect(defaultProps.onChange).toHaveBeenCalledWith({ q1: ["Option 1", "Option 2"] });

    // Test unselecting an option
    await userEvent.click(screen.getByLabelText("Option 1"));
    expect(defaultProps.onChange).toHaveBeenCalledWith({ q1: ["Option 2"] });
  });

  test("handles 'Other' option correctly", async () => {
    render(<MultipleChoiceMultiQuestion {...defaultProps} />);

    await userEvent.click(screen.getByLabelText("Other"));
    expect(screen.getByPlaceholderText("Please specify")).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("Please specify"), "Custom response");
    expect(defaultProps.onChange).toHaveBeenCalledWith({ q1: ["Custom response"] });
  });

  test("handles form submission", async () => {
    const onSubmit = vi.fn();
    render(<MultipleChoiceMultiQuestion {...defaultProps} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByLabelText("Option 1"));
    await userEvent.click(screen.getByTestId("submit-button"));

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
    };

    render(<MultipleChoiceMultiQuestion {...defaultProps} question={shuffledQuestion} />);
    expect(screen.getByLabelText("Option 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 3")).toBeInTheDocument();
  });
});
