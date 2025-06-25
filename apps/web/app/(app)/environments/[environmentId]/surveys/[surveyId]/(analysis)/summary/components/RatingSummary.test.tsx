import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurveyQuestionSummaryRating } from "@formbricks/types/surveys/types";
import { RatingSummary } from "./RatingSummary";

vi.mock("./QuestionSummaryHeader", () => ({
  QuestionSummaryHeader: ({ additionalInfo }: any) => <div data-testid="header">{additionalInfo}</div>,
}));

describe("RatingSummary", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders overall average and choices", () => {
    const questionSummary = {
      question: {
        id: "q1",
        scale: "star",
        headline: "Headline",
        type: "rating",
        range: [1, 5],
        isColorCodingEnabled: false,
      },
      average: 3.1415,
      choices: [
        { rating: 1, percentage: 50, count: 2 },
        { rating: 2, percentage: 50, count: 3 },
      ],
      dismissed: { count: 0 },
    } as unknown as TSurveyQuestionSummaryRating;
    const survey = {};
    const setFilter = vi.fn();
    render(<RatingSummary questionSummary={questionSummary} survey={survey as any} setFilter={setFilter} />);
    expect(screen.getByText("environments.surveys.summary.overall: 3.14")).toBeDefined();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  test("clicking a choice calls setFilter with correct args", async () => {
    const questionSummary = {
      question: {
        id: "q1",
        scale: "number",
        headline: "Headline",
        type: "rating",
        range: [1, 5],
        isColorCodingEnabled: false,
      },
      average: 2,
      choices: [{ rating: 3, percentage: 100, count: 1 }],
      dismissed: { count: 0 },
    } as unknown as TSurveyQuestionSummaryRating;
    const survey = {};
    const setFilter = vi.fn();
    render(<RatingSummary questionSummary={questionSummary} survey={survey as any} setFilter={setFilter} />);
    await userEvent.click(screen.getByRole("button"));
    expect(setFilter).toHaveBeenCalledWith(
      "q1",
      "Headline",
      "rating",
      "environments.surveys.summary.is_equal_to",
      "3"
    );
  });

  test("renders dismissed section when dismissed count > 0", () => {
    const questionSummary = {
      question: {
        id: "q1",
        scale: "smiley",
        headline: "Headline",
        type: "rating",
        range: [1, 5],
        isColorCodingEnabled: false,
      },
      average: 4,
      choices: [],
      dismissed: { count: 1 },
    } as unknown as TSurveyQuestionSummaryRating;
    const survey = {};
    const setFilter = vi.fn();
    render(<RatingSummary questionSummary={questionSummary} survey={survey as any} setFilter={setFilter} />);
    expect(screen.getByText("common.dismissed")).toBeDefined();
    expect(screen.getByText("1 common.response")).toBeDefined();
  });
});
