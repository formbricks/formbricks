import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurveyQuestionTypeEnum, type TSurveyRankingQuestion } from "@formbricks/types/surveys/types";
import { RankingQuestion } from "./ranking-question";

// Mock ScrollableContainer with ref support for new functionality
vi.mock("@/components/wrappers/scrollable-container", () => {
  const { forwardRef } = require("preact/compat");

  const MockScrollableContainer = forwardRef(({ children }: { children: React.ReactNode }, ref: any) => {
    if (ref) {
      if (typeof ref === "function") {
        ref({ scrollToBottom: vi.fn() });
      } else if (typeof ref === "object" && ref !== null) {
        ref.current = { scrollToBottom: vi.fn() };
      }
    }
    return <div data-testid="scrollable-container">{children}</div>;
  });

  return {
    ScrollableContainer: MockScrollableContainer,
  };
});

// Mock other components - minimal mocks
vi.mock("@/components/buttons/submit-button", () => ({
  SubmitButton: () => (
    <button type="submit" data-testid="submit-button">
      Submit
    </button>
  ),
}));

vi.mock("@/components/general/headline", () => ({
  Headline: () => <h1>Headline</h1>,
}));

vi.mock("@/components/general/subheader", () => ({
  Subheader: () => <p>Subheader</p>,
}));

vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null],
}));

// Mock lib functions
vi.mock("@/lib/i18n", () => ({
  getLocalizedValue: (value: any) => value?.default || value || "Default",
}));

vi.mock("@/lib/ttc", () => ({
  useTtc: vi.fn(),
  getUpdatedTtc: vi.fn(() => ({ [Date.now()]: 123 })),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
  getShuffledChoicesIds: vi.fn((_, length) => Array.from({ length }, (_, i) => i.toString())),
}));

describe("RankingQuestion - New Error Handling", () => {
  beforeEach(() => {
    vi.stubGlobal("performance", {
      now: vi.fn(() => 1000),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  const mockQuestion: TSurveyRankingQuestion = {
    id: "ranking-question-1",
    type: TSurveyQuestionTypeEnum.Ranking,
    headline: { default: "Rank these items" },
    required: true,
    buttonLabel: { default: "Next" },
    choices: [
      { id: "choice1", label: { default: "Choice 1" } },
      { id: "choice2", label: { default: "Choice 2" } },
      { id: "choice3", label: { default: "Choice 3" } },
    ],
    shuffleOption: "none",
  };

  const mockOptionalQuestion: TSurveyRankingQuestion = {
    ...mockQuestion,
    required: false,
  };

  const defaultProps = {
    question: mockQuestion,
    value: [],
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onBack: vi.fn(),
    isFirstQuestion: false,
    isLastQuestion: false,
    languageCode: "en",
    ttc: {},
    setTtc: vi.fn(),
    autoFocusEnabled: true,
    currentQuestionId: "ranking-question-1",
    isBackButtonHidden: false,
  };

  test("shows error message when required question has incomplete ranking", async () => {
    render(<RankingQuestion {...defaultProps} />);

    const submitButton = screen.getByTestId("submit-button");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Please rank all items before submitting.")).toBeInTheDocument();
    });
  });

  test("allows submission with empty ranking for optional question", () => {
    render(<RankingQuestion {...defaultProps} question={mockOptionalQuestion} />);

    const submitButton = screen.getByTestId("submit-button");
    fireEvent.click(submitButton);

    expect(defaultProps.onSubmit).toHaveBeenCalled();
    expect(screen.queryByText("Please rank all items before submitting.")).not.toBeInTheDocument();
  });
});
