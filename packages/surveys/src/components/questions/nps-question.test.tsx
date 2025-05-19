import { getUpdatedTtc } from "@/lib/ttc";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { type TResponseTtc } from "@formbricks/types/responses";
import { type TSurveyNPSQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { NPSQuestion } from "./nps-question";

vi.mock("@/lib/i18n", () => ({
  getLocalizedValue: vi.fn().mockImplementation((value) => {
    if (typeof value === "string") return value;
    return value?.default || "";
  }),
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
  };
});

describe("NPSQuestion", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockQuestion: TSurveyNPSQuestion = {
    id: "nps-question-1",
    type: TSurveyQuestionTypeEnum.NPS,
    headline: { default: "How likely are you to recommend us?" },
    required: true,
    lowerLabel: { default: "Not likely" },
    upperLabel: { default: "Very likely" },
    buttonLabel: { default: "Next" },
    backButtonLabel: { default: "Back" },
    isColorCodingEnabled: false,
  };

  const mockProps = {
    question: mockQuestion,
    value: undefined,
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onBack: vi.fn(),
    isFirstQuestion: true,
    isLastQuestion: false,
    languageCode: "en",
    ttc: {} as TResponseTtc,
    setTtc: vi.fn(),
    autoFocusEnabled: true,
    currentQuestionId: "nps-question-1",
    isBackButtonHidden: false,
  };

  test("renders NPS question with correct elements", () => {
    render(<NPSQuestion {...mockProps} />);

    expect(screen.getByText("How likely are you to recommend us?")).toBeInTheDocument();
    expect(screen.getByText("Not likely")).toBeInTheDocument();
    expect(screen.getByText("Very likely")).toBeInTheDocument();

    // Check all 11 NPS options (0-10) are rendered
    for (let i = 0; i <= 10; i++) {
      expect(screen.getByRole("radio", { name: i.toString() })).toBeInTheDocument();
    }
  });

  test("calls onChange and onSubmit when clicking on an NPS option", async () => {
    vi.useFakeTimers();

    render(<NPSQuestion {...mockProps} />);

    // Click on rating 7
    fireEvent.click(screen.getByRole("radio", { name: "7" }));

    expect(mockProps.onChange).toHaveBeenCalledWith({ [mockQuestion.id]: 7 });
    expect(getUpdatedTtc).toHaveBeenCalled();
    expect(mockProps.setTtc).toHaveBeenCalled();

    // Advance timers to trigger the setTimeout callback
    vi.advanceTimersByTime(300);

    expect(mockProps.onSubmit).toHaveBeenCalledWith({ [mockQuestion.id]: 7 }, {});

    vi.useRealTimers();
  });

  test("renders with color coding when enabled", () => {
    const colorCodedProps = {
      ...mockProps,
      question: {
        ...mockQuestion,
        isColorCodingEnabled: true,
      },
    };

    const { container } = render(<NPSQuestion {...colorCodedProps} />);

    // Find the fieldset that contains the NPS options
    const fieldset = container.querySelector("fieldset");
    expect(fieldset).toBeInTheDocument();

    // Get only the labels within the NPS options fieldset
    const npsLabels = fieldset?.querySelectorAll("label");
    expect(npsLabels?.length).toBe(11);

    // Verify each NPS label has a color coding div when enabled
    let colorDivCount = 0;
    npsLabels?.forEach((label) => {
      if (label.firstElementChild?.classList.contains("fb-absolute")) {
        colorDivCount++;
      }
    });

    expect(colorDivCount).toBe(11);

    // Check at least one has the emerald color class for higher ratings
    const lastLabel = npsLabels?.[10];
    const colorDiv = lastLabel?.firstElementChild;
    expect(colorDiv?.classList.contains("fb-bg-emerald-100")).toBe(true);
  });

  test("renders back button when not first question", () => {
    render(<NPSQuestion {...mockProps} isFirstQuestion={false} />);

    const backButton = screen.getByText("Back");
    expect(backButton).toBeInTheDocument();

    fireEvent.click(backButton);
    expect(mockProps.onBack).toHaveBeenCalled();
    expect(getUpdatedTtc).toHaveBeenCalled();
  });

  test("doesn't render back button when isBackButtonHidden is true", () => {
    render(<NPSQuestion {...mockProps} isFirstQuestion={false} isBackButtonHidden={true} />);

    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });

  test("handles form submission for non-required questions", async () => {
    const nonRequiredProps = {
      ...mockProps,
      question: {
        ...mockQuestion,
        required: false,
      },
    };

    render(<NPSQuestion {...nonRequiredProps} />);

    // Submit button should be visible for non-required questions
    const submitButton = screen.getByText("Next");
    expect(submitButton).toBeInTheDocument();

    await userEvent.click(submitButton);

    expect(mockProps.onSubmit).toHaveBeenCalled();
    expect(getUpdatedTtc).toHaveBeenCalled();
  });

  test("supports keyboard navigation", () => {
    render(<NPSQuestion {...mockProps} />);

    const option = screen.getByText("5").closest("label");
    expect(option).toBeInTheDocument();

    // Test spacebar press
    fireEvent.keyDown(option!, { key: " " });

    expect(mockProps.onChange).toHaveBeenCalled();
  });

  test("renders media when available", () => {
    const propsWithMedia = {
      ...mockProps,
      question: {
        ...mockQuestion,
        imageUrl: "https://example.com/image.jpg",
      },
    };

    const { container } = render(<NPSQuestion {...propsWithMedia} />);

    // Check if QuestionMedia component is rendered
    // Since we're not mocking the QuestionMedia component, we can just verify it's being included
    const mediaContainer = container.querySelector(".fb-my-4");
    expect(mediaContainer).toBeInTheDocument();
  });
});
