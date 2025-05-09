import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TResponseTtc } from "@formbricks/types/responses";
import { TSurveyQuestionTypeEnum, TSurveyRatingQuestion } from "@formbricks/types/surveys/types";
import { RatingQuestion } from "./rating-question";

vi.mock("@/components/buttons/back-button", () => ({
  BackButton: ({ onClick, backButtonLabel, tabIndex }: any) => (
    <button data-testid="back-button" onClick={onClick} tabIndex={tabIndex}>
      {backButtonLabel}
    </button>
  ),
}));

vi.mock("@/components/buttons/submit-button", () => ({
  SubmitButton: ({ buttonLabel, tabIndex }: any) => (
    <button data-testid="submit-button" tabIndex={tabIndex}>
      {buttonLabel}
    </button>
  ),
}));

vi.mock("@/components/general/headline", () => ({
  Headline: ({ headline, questionId, required }: any) => (
    <h2 data-testid="headline" data-required={required} data-question-id={questionId}>
      {headline}
    </h2>
  ),
}));

vi.mock("@/components/general/subheader", () => ({
  Subheader: ({ subheader, questionId }: any) => (
    <p data-testid="subheader" data-question-id={questionId}>
      {subheader}
    </p>
  ),
}));

vi.mock("@/components/general/question-media", () => ({
  QuestionMedia: ({ imgUrl, videoUrl }: any) => (
    <div data-testid="question-media" data-img-url={imgUrl} data-video-url={videoUrl}></div>
  ),
}));

vi.mock("@/components/wrappers/scrollable-container", () => ({
  ScrollableContainer: ({ children }: any) => <div data-testid="scrollable-container">{children}</div>,
}));

vi.mock("@/lib/i18n", () => ({
  getLocalizedValue: (value: any) => (typeof value === "string" ? value : value.default),
}));

vi.mock("@/lib/ttc", () => ({
  getUpdatedTtc: vi.fn().mockReturnValue({}),
  useTtc: vi.fn(),
}));

vi.mock("preact/hooks", async () => {
  const actual = await vi.importActual<typeof import("preact/hooks")>("preact/hooks");
  return {
    ...actual,
    useState: vi.fn().mockImplementation(actual.useState),
    useEffect: vi.fn().mockImplementation(actual.useEffect),
  };
});

describe("RatingQuestion", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockQuestion: TSurveyRatingQuestion = {
    id: "q1",
    type: TSurveyQuestionTypeEnum.Rating,
    headline: { default: "How would you rate our service?" },
    subheader: { default: "Please give us your honest feedback" },
    required: true,
    scale: "number",
    range: 5,
    lowerLabel: { default: "Very poor" },
    upperLabel: { default: "Excellent" },
    buttonLabel: { default: "Next" },
    backButtonLabel: { default: "Back" },
    isColorCodingEnabled: true,
  };

  const mockProps = {
    question: mockQuestion,
    value: undefined,
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onBack: vi.fn(),
    isFirstQuestion: false,
    isLastQuestion: false,
    languageCode: "en",
    ttc: {} as TResponseTtc,
    setTtc: vi.fn(),
    autoFocusEnabled: true,
    currentQuestionId: "q1",
    isBackButtonHidden: false,
  };

  test("renders the question correctly", () => {
    render(<RatingQuestion {...mockProps} />);

    expect(screen.getByTestId("headline")).toHaveTextContent("How would you rate our service?");
    expect(screen.getByTestId("subheader")).toHaveTextContent("Please give us your honest feedback");
    expect(screen.queryByTestId("question-media")).not.toBeInTheDocument();
    expect(screen.getByTestId("back-button")).toBeInTheDocument();
  });

  test("renders media when available", () => {
    const questionWithMedia = {
      ...mockQuestion,
      imageUrl: "image.jpg",
    };

    render(<RatingQuestion {...mockProps} question={questionWithMedia} />);

    expect(screen.getByTestId("question-media")).toBeInTheDocument();
  });

  test("handles number scale correctly", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<RatingQuestion {...mockProps} />);

    const ratingOption = screen.getByText("3");
    await user.click(ratingOption);

    expect(mockProps.onChange).toHaveBeenCalledWith({ q1: 3 });

    // Fast-forward timers to handle the setTimeout in the component
    vi.advanceTimersByTime(250);

    expect(mockProps.onSubmit).toHaveBeenCalled();

    vi.useRealTimers();
  });

  test("handles star scale correctly", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const starQuestion = {
      ...mockQuestion,
      scale: "star" as const,
    };

    render(<RatingQuestion {...mockProps} question={starQuestion} />);

    const stars = screen.getAllByRole("radio");
    await user.click(stars[2]); // Click the 3rd star

    expect(mockProps.onChange).toHaveBeenCalledWith({ q1: 3 });

    vi.advanceTimersByTime(250);

    expect(mockProps.onSubmit).toHaveBeenCalled();

    vi.useRealTimers();
  });

  test("handles smiley scale correctly", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const smileyQuestion = {
      ...mockQuestion,
      scale: "smiley" as const,
    };

    render(<RatingQuestion {...mockProps} question={smileyQuestion} />);

    const smileys = screen.getAllByRole("radio");
    await user.click(smileys[2]); // Click the 3rd smiley

    expect(mockProps.onChange).toHaveBeenCalledWith({ q1: 3 });

    vi.advanceTimersByTime(250);

    expect(mockProps.onSubmit).toHaveBeenCalled();

    vi.useRealTimers();
  });

  test("hides back button when isFirstQuestion is true", () => {
    render(<RatingQuestion {...mockProps} isFirstQuestion={true} />);

    expect(screen.queryByTestId("back-button")).not.toBeInTheDocument();
  });

  test("hides back button when isBackButtonHidden is true", () => {
    render(<RatingQuestion {...mockProps} isBackButtonHidden={true} />);

    expect(screen.queryByTestId("back-button")).not.toBeInTheDocument();
  });

  test("handles form submission", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <RatingQuestion {...mockProps} value={4} question={{ ...mockQuestion, required: false }} />
    );

    const form = container.querySelector("form");
    expect(form).toBeInTheDocument();

    await user.click(screen.getByTestId("submit-button"));

    expect(mockProps.onSubmit).toHaveBeenCalled();
  });

  test("handles keyboard navigation via spacebar", async () => {
    const user = userEvent.setup();
    render(<RatingQuestion {...mockProps} />);

    await user.tab(); // Focus on first rating option
    await user.keyboard(" "); // Press spacebar

    expect(mockProps.onChange).toHaveBeenCalled();
  });

  test("triggers onBack when back button is clicked", async () => {
    const user = userEvent.setup();
    render(<RatingQuestion {...mockProps} />);

    const backButton = screen.getByTestId("back-button");
    await user.click(backButton);

    expect(mockProps.onBack).toHaveBeenCalled();
  });

  test("supports color coding when enabled", () => {
    render(<RatingQuestion {...mockProps} />);

    // Check if color coding elements are present
    const colorElements = document.querySelectorAll('[class*="fb-h-[6px]"]');
    expect(colorElements.length).toBeGreaterThan(0);
  });
});
