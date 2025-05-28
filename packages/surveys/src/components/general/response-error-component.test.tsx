import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, test, vi } from "vitest";
import { type TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { ResponseErrorComponent } from "./response-error-component";

describe("ResponseErrorComponent", () => {
  afterEach(() => {
    cleanup();
  });
  const mockQuestions: TSurveyQuestion[] = [
    {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Question 1" },
      required: true,
      inputType: "text",
      charLimit: { enabled: true, max: 1000 },
      longAnswer: false,
      placeholder: {},
      logic: [],
    },
    {
      id: "q2",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Question 2" },
      required: true,
      inputType: "text",
      charLimit: { enabled: true, max: 1000 },
      longAnswer: false,
      placeholder: {},
      logic: [],
    },
  ];

  const mockResponseData = {
    q1: "Answer 1",
    q2: "Answer 2",
  };

  test("renders error message and retry button", () => {
    render(
      <ResponseErrorComponent questions={mockQuestions} responseData={mockResponseData} onRetry={() => {}} />
    );

    expect(screen.getByText("Your feedback is stuck :(")).toBeDefined();
    expect(screen.getByText(/The servers cannot be reached at the moment/)).toBeDefined();
    expect(screen.getByText("Retry")).toBeDefined();
  });

  test("displays questions and responses correctly", () => {
    render(
      <ResponseErrorComponent questions={mockQuestions} responseData={mockResponseData} onRetry={() => {}} />
    );

    const questions = screen.getAllByText(/Question \d/);
    expect(questions).toHaveLength(2);
    expect(questions[0].textContent).toBe("Question 1");
    expect(questions[1].textContent).toBe("Question 2");

    const answers = screen.getAllByText(/Answer \d/);
    expect(answers).toHaveLength(2);
    expect(answers[0].textContent).toBe("Answer 1");
    expect(answers[1].textContent).toBe("Answer 2");
  });

  test("calls onRetry when retry button is clicked", () => {
    const mockOnRetry = vi.fn();
    render(
      <ResponseErrorComponent
        questions={mockQuestions}
        responseData={mockResponseData}
        onRetry={mockOnRetry}
      />
    );

    const retryButton = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retryButton);

    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  test("handles missing responses gracefully", () => {
    const partialResponseData = {
      q1: "Answer 1",
    };

    render(
      <ResponseErrorComponent
        questions={mockQuestions}
        responseData={partialResponseData}
        onRetry={() => {}}
      />
    );

    const question = screen.getByText(/Question 1/);
    expect(question.textContent).toBe("Question 1");

    const answer = screen.getByText(/Answer 1/);
    expect(answer.textContent).toBe("Answer 1");

    expect(screen.queryByText(/Answer 2/)).toBeNull();
  });
});
