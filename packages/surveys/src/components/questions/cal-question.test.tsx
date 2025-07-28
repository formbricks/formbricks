import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurveyCalQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { CalQuestion } from "./cal-question";

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
vi.mock("@/components/general/cal-embed", () => ({
  CalEmbed: () => <div data-testid="cal-embed">CalEmbed</div>,
}));

vi.mock("@/components/general/headline", () => ({
  Headline: () => <h1>Headline</h1>,
}));

vi.mock("@/components/general/subheader", () => ({
  Subheader: () => <p>Subheader</p>,
}));

vi.mock("@/components/buttons/submit-button", () => ({
  SubmitButton: ({ buttonLabel }: { buttonLabel: string }) => (
    <button type="submit" data-testid="submit-button">
      {buttonLabel}
    </button>
  ),
}));

vi.mock("@/components/buttons/back-button", () => ({
  BackButton: () => <button data-testid="back-button">Back</button>,
}));

// Mock lib functions
vi.mock("@/lib/i18n", () => ({
  getLocalizedValue: (value: any) => value?.default || value || "Default",
}));

vi.mock("@/lib/ttc", () => ({
  useTtc: vi.fn(),
  getUpdatedTtc: vi.fn(() => ({ [Date.now()]: 123 })),
}));

describe("CalQuestion - New Error Handling", () => {
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

  const mockQuestion: TSurveyCalQuestion = {
    id: "cal-question-1",
    type: TSurveyQuestionTypeEnum.Cal,
    headline: { default: "Schedule a meeting" },
    required: true,
    calUserName: "johndoe",
    buttonLabel: { default: "Next" },
  };

  const defaultProps = {
    question: mockQuestion,
    value: "",
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onBack: vi.fn(),
    isFirstQuestion: false,
    isLastQuestion: false,
    languageCode: "en",
    ttc: {},
    setTtc: vi.fn(),
    autoFocusEnabled: true,
    currentQuestionId: "cal-question-1",
    isBackButtonHidden: false,
  };

  test("shows error message when required field is not filled", async () => {
    render(<CalQuestion {...defaultProps} />);

    const submitButton = screen.getByTestId("submit-button");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Please book an appointment")).toBeInTheDocument();
    });
  });

  test("error message is positioned after CalEmbed", async () => {
    render(<CalQuestion {...defaultProps} />);

    const submitButton = screen.getByTestId("submit-button");
    fireEvent.click(submitButton);

    await waitFor(() => {
      const calEmbed = screen.getByTestId("cal-embed");
      const errorMessage = screen.getByText("Please book an appointment");

      // Check that error message comes after CalEmbed in DOM order
      expect(calEmbed.compareDocumentPosition(errorMessage)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
  });

  test("does not show error when appointment is booked", () => {
    render(<CalQuestion {...defaultProps} value="booked" />);

    const submitButton = screen.getByTestId("submit-button");
    fireEvent.click(submitButton);

    expect(screen.queryByText("Please book an appointment")).not.toBeInTheDocument();
  });
});
