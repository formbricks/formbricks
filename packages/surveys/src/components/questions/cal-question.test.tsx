import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurveyCalQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { CalEmbed } from "../general/cal-embed";
import { CalQuestion } from "./cal-question";

// Mock the CalEmbed component
vi.mock("../general/cal-embed", () => ({
  CalEmbed: vi.fn(({ question }) => (
    <div data-testid="cal-embed-mock">
      Cal Embed for {question.calUserName}
      {question.calHost && <span>Host: {question.calHost}</span>}
    </div>
  )),
}));

describe("CalQuestion", () => {
  afterEach(() => {
    cleanup();
  });

  const mockQuestion: TSurveyCalQuestion = {
    id: "cal-question-1",
    type: TSurveyQuestionTypeEnum.Cal,
    headline: { default: "Schedule a meeting" },
    subheader: { default: "Choose a time that works for you" },
    required: true,
    calUserName: "johndoe",
    calHost: "cal.com",
  };

  const mockQuestionWithoutHost: TSurveyCalQuestion = {
    id: "cal-question-2",
    type: TSurveyQuestionTypeEnum.Cal,
    headline: { default: "Schedule a meeting" },
    required: false,
    calUserName: "janedoe",
  };

  const defaultProps = {
    question: mockQuestion,
    value: null,
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    isInvalid: false,
    direction: "vertical" as const,
    languageCode: "en",
  } as any;

  test("renders with headline and subheader", () => {
    render(<CalQuestion {...defaultProps} />);

    expect(screen.getByText("Schedule a meeting")).toBeInTheDocument();
    expect(screen.getByText("Choose a time that works for you")).toBeInTheDocument();
  });

  test("renders without subheader", () => {
    render(<CalQuestion {...defaultProps} question={mockQuestionWithoutHost} />);

    expect(screen.getByText("Schedule a meeting")).toBeInTheDocument();
    expect(screen.queryByText("Choose a time that works for you")).not.toBeInTheDocument();
  });

  test("renders CalEmbed component with correct props", () => {
    render(<CalQuestion {...defaultProps} />);

    expect(screen.getByTestId("cal-embed-mock")).toBeInTheDocument();
    expect(screen.getByText("Cal Embed for johndoe")).toBeInTheDocument();
    expect(screen.getByText("Host: cal.com")).toBeInTheDocument();
    expect(CalEmbed).toHaveBeenCalledWith(
      expect.objectContaining({
        question: mockQuestion,
        onSuccessfulBooking: expect.any(Function),
      }),
      {}
    );
  });

  test("renders CalEmbed without host when not provided", () => {
    render(<CalQuestion {...defaultProps} question={mockQuestionWithoutHost} />);

    expect(screen.getByTestId("cal-embed-mock")).toBeInTheDocument();
    expect(screen.getByText("Cal Embed for janedoe")).toBeInTheDocument();
    expect(screen.queryByText(/Host:/)).not.toBeInTheDocument();
  });

  test("does not add required indicator when question is optional", () => {
    render(<CalQuestion {...defaultProps} question={mockQuestionWithoutHost} />);

    expect(screen.queryByText("*")).not.toBeInTheDocument();
  });
});
