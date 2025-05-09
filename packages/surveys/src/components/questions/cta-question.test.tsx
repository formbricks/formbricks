import { getUpdatedTtc } from "@/lib/ttc";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { type TSurveyCTAQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { CTAQuestion } from "./cta-question";

// Mock dependencies
vi.mock("@/components/buttons/back-button", () => ({
  BackButton: vi.fn(({ onClick, backButtonLabel, tabIndex }) => (
    <button onClick={onClick} data-testid="back-button" tabIndex={tabIndex}>
      {backButtonLabel || "Back"}
    </button>
  )),
}));

vi.mock("@/components/buttons/submit-button", () => ({
  SubmitButton: vi.fn(({ onClick, buttonLabel, tabIndex }) => (
    <button onClick={onClick} data-testid="submit-button" tabIndex={tabIndex}>
      {buttonLabel || "Submit"}
    </button>
  )),
}));

vi.mock("@/components/general/headline", () => ({
  Headline: vi.fn(({ headline }) => <div data-testid="headline">{headline}</div>),
}));

vi.mock("@/components/general/html-body", () => ({
  HtmlBody: vi.fn(({ htmlString }) => <div data-testid="html-body">{htmlString}</div>),
}));

vi.mock("@/components/general/question-media", () => ({
  QuestionMedia: vi.fn(() => <div data-testid="question-media">Media</div>),
}));

vi.mock("@/components/wrappers/scrollable-container", () => ({
  ScrollableContainer: vi.fn(({ children }) => <div data-testid="scrollable-container">{children}</div>),
}));

vi.mock("@/lib/i18n", () => ({
  getLocalizedValue: vi.fn((value) => value),
}));

vi.mock("@/lib/ttc", () => ({
  getUpdatedTtc: vi.fn(() => ({})),
  useTtc: vi.fn(),
}));

describe("CTAQuestion", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  const mockQuestion: TSurveyCTAQuestion = {
    id: "q1",
    type: TSurveyQuestionTypeEnum.CTA,
    headline: { default: "Test Headline" },
    html: { default: "Test HTML content" },
    buttonLabel: { default: "Click Me" },
    dismissButtonLabel: { default: "Skip This" },
    backButtonLabel: { default: "Go Back" },
    required: false,
    buttonExternal: false,
    buttonUrl: "",
  };

  const mockProps = {
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
    autoFocusEnabled: false,
    currentQuestionId: "q1",
    isBackButtonHidden: false,
  };

  test("renders correctly without media", () => {
    render(<CTAQuestion {...mockProps} />);
    expect(screen.getByTestId("headline")).toBeInTheDocument();
    expect(screen.getByTestId("html-body")).toBeInTheDocument();
    expect(screen.getByTestId("back-button")).toBeInTheDocument();
    expect(screen.getByTestId("submit-button")).toBeInTheDocument();
    expect(screen.queryByTestId("question-media")).not.toBeInTheDocument();
  });

  test("renders correctly with image media", () => {
    const questionWithMedia = {
      ...mockQuestion,
      imageUrl: "https://example.com/image.jpg",
    };
    render(<CTAQuestion {...mockProps} question={questionWithMedia} />);
    expect(screen.getByTestId("question-media")).toBeInTheDocument();
  });

  test("renders correctly with video media", () => {
    const questionWithMedia = {
      ...mockQuestion,
      videoUrl: "https://example.com/video.mp4",
    };
    render(<CTAQuestion {...mockProps} question={questionWithMedia} />);
    expect(screen.getByTestId("question-media")).toBeInTheDocument();
  });

  test("does not show back button when isFirstQuestion is true", () => {
    render(<CTAQuestion {...mockProps} isFirstQuestion={true} />);
    expect(screen.queryByTestId("back-button")).not.toBeInTheDocument();
  });

  test("does not show back button when isBackButtonHidden is true", () => {
    render(<CTAQuestion {...mockProps} isBackButtonHidden={true} />);
    expect(screen.queryByTestId("back-button")).not.toBeInTheDocument();
  });

  test("calls onSubmit and onChange when submit button is clicked", async () => {
    const user = userEvent.setup();
    render(<CTAQuestion {...mockProps} />);
    await user.click(screen.getByTestId("submit-button"));
    expect(mockProps.onSubmit).toHaveBeenCalledWith({ q1: "clicked" }, {});
    expect(mockProps.onChange).toHaveBeenCalledWith({ q1: "clicked" });
  });

  test("calls onBack when back button is clicked", async () => {
    const user = userEvent.setup();
    render(<CTAQuestion {...mockProps} />);
    await user.click(screen.getByTestId("back-button"));
    expect(mockProps.onBack).toHaveBeenCalled();
    expect(vi.mocked(getUpdatedTtc)).toHaveBeenCalled();
    expect(mockProps.setTtc).toHaveBeenCalled();
  });

  test("does not show skip button when question is required", () => {
    const requiredQuestion = {
      ...mockQuestion,
      required: true,
    };
    render(<CTAQuestion {...mockProps} question={requiredQuestion} />);

    // There should only be 2 buttons (submit and back) when required is true
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(2);
  });

  test("opens external URL when buttonExternal is true", async () => {
    const mockOpenExternalURL = vi.fn();
    const externalQuestion = {
      ...mockQuestion,
      buttonExternal: true,
      buttonUrl: "https://example.com",
    };
    const user = userEvent.setup();

    render(
      <CTAQuestion {...mockProps} question={externalQuestion} onOpenExternalURL={mockOpenExternalURL} />
    );

    await user.click(screen.getByTestId("submit-button"));
    expect(mockOpenExternalURL).toHaveBeenCalledWith("https://example.com");
  });

  test("falls back to window.open when onOpenExternalURL is not provided", async () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => {
      return { focus: vi.fn() } as unknown as Window;
    });

    const externalQuestion = {
      ...mockQuestion,
      buttonExternal: true,
      buttonUrl: "https://example.com",
    };
    const user = userEvent.setup();

    render(<CTAQuestion {...mockProps} question={externalQuestion} />);

    await user.click(screen.getByTestId("submit-button"));
    expect(windowOpenSpy).toHaveBeenCalledWith("https://example.com", "_blank");
    windowOpenSpy.mockRestore();
  });

  test("sets tab index correctly when isCurrent is true", () => {
    render(<CTAQuestion {...mockProps} currentQuestionId="q1" />);
    expect(screen.getByTestId("submit-button")).toHaveAttribute("tabindex", "0");
    expect(screen.getByTestId("back-button")).toHaveAttribute("tabindex", "0");
  });

  test("sets tab index to -1 when isCurrent is false", () => {
    render(<CTAQuestion {...mockProps} currentQuestionId="q2" />);
    expect(screen.getByTestId("submit-button")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByTestId("back-button")).toHaveAttribute("tabindex", "-1");
  });
});
