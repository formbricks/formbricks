import { getUpdatedTtc } from "@/lib/ttc";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { type TSurveyConsentQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { ConsentQuestion } from "./consent-question";

vi.mock("@/lib/ttc", () => ({
  useTtc: vi.fn(),
  getUpdatedTtc: vi.fn().mockReturnValue({}),
}));

vi.mock("@/components/general/question-media", () => ({
  QuestionMedia: () => <div data-testid="question-media">Question Media</div>,
}));

describe("ConsentQuestion", () => {
  afterEach(() => {
    cleanup();
  });

  const mockQuestion: TSurveyConsentQuestion = {
    id: "consent-q",
    type: TSurveyQuestionTypeEnum.Consent,
    headline: { default: "Consent Headline" },
    html: { default: "This is the consent text" },
    label: { default: "I agree to the terms" },
    buttonLabel: { default: "Submit" },
    backButtonLabel: { default: "Back" },
    required: true,
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
    autoFocusEnabled: false,
    currentQuestionId: "consent-q",
    isBackButtonHidden: false,
  };

  test("renders consent question correctly", () => {
    render(<ConsentQuestion {...defaultProps} />);

    expect(screen.getByText("Consent Headline")).toBeInTheDocument();
    expect(screen.getByText("I agree to the terms")).toBeInTheDocument();
    expect(screen.getByText("Submit")).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();
  });

  test("renders with media when available", () => {
    const questionWithMedia = {
      ...mockQuestion,
      imageUrl: "https://example.com/image.jpg",
    };

    render(<ConsentQuestion {...defaultProps} question={questionWithMedia} />);

    expect(screen.getByTestId("question-media")).toBeInTheDocument();
  });

  test("checkbox changes value when clicked", async () => {
    const onChange = vi.fn();

    render(<ConsentQuestion {...defaultProps} onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox");
    await userEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith({ "consent-q": "accepted" });

    onChange.mockReset();
    await userEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith({ "consent-q": "" });
  });

  test("submits form with correct data", async () => {
    const onSubmit = vi.fn();

    render(<ConsentQuestion {...defaultProps} value="accepted" onSubmit={onSubmit} />);

    const submitButton = screen.getByText("Submit");
    await userEvent.click(submitButton);

    expect(getUpdatedTtc).toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledWith({ "consent-q": "accepted" }, {});
  });

  test("back button triggers onBack handler", async () => {
    const onBack = vi.fn();

    render(<ConsentQuestion {...defaultProps} onBack={onBack} />);

    const backButton = screen.getByText("Back");
    await userEvent.click(backButton);

    expect(getUpdatedTtc).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });

  test("back button is not rendered when isFirstQuestion is true", () => {
    render(<ConsentQuestion {...defaultProps} isFirstQuestion={true} />);

    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });

  test("back button is not rendered when isBackButtonHidden is true", () => {
    render(<ConsentQuestion {...defaultProps} isBackButtonHidden={true} />);

    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });

  test("handles keyboard space press on label", () => {
    render(<ConsentQuestion {...defaultProps} />);

    const label = screen.getByText("I agree to the terms").closest("label");

    fireEvent.keyDown(label!, { key: " " });

    expect(defaultProps.onChange).toHaveBeenCalledWith({ "consent-q": "accepted" });
  });
});
