import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyQuestionSummaryRanking, TSurveyType } from "@formbricks/types/surveys/types";
import { RankingSummary } from "./RankingSummary";

// Mock dependencies
vi.mock("./QuestionSummaryHeader", () => ({
  QuestionSummaryHeader: () => <div data-testid="question-summary-header" />,
}));

vi.mock("../lib/utils", () => ({
  convertFloatToNDecimal: (value: number) => value.toFixed(2),
}));

describe("RankingSummary", () => {
  afterEach(() => {
    cleanup();
  });

  const survey = {} as TSurvey;
  const surveyType: TSurveyType = "app";

  test("renders ranking results in correct order", () => {
    const questionSummary = {
      question: { id: "q1", headline: "Rank the following" },
      choices: {
        option1: { value: "Option A", avgRanking: 1.5, others: [] },
        option2: { value: "Option B", avgRanking: 2.3, others: [] },
        option3: { value: "Option C", avgRanking: 1.2, others: [] },
      },
    } as unknown as TSurveyQuestionSummaryRanking;

    render(<RankingSummary questionSummary={questionSummary} survey={survey} surveyType={surveyType} />);

    expect(screen.getByTestId("question-summary-header")).toBeInTheDocument();

    // Check order: should be sorted by avgRanking (ascending)
    const options = screen.getAllByText(/Option [A-C]/);
    expect(options[0]).toHaveTextContent("Option C"); // 1.2 (lowest avgRanking first)
    expect(options[1]).toHaveTextContent("Option A"); // 1.5
    expect(options[2]).toHaveTextContent("Option B"); // 2.3

    // Check rankings are displayed
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();

    // Check average values are displayed
    expect(screen.getByText("#1.20")).toBeInTheDocument();
    expect(screen.getByText("#1.50")).toBeInTheDocument();
    expect(screen.getByText("#2.30")).toBeInTheDocument();
  });

  test("renders 'other values found' section when others exist", () => {
    const questionSummary = {
      question: { id: "q1", headline: "Rank the following" },
      choices: {
        option1: {
          value: "Option A",
          avgRanking: 1.0,
          others: [{ value: "Other value", count: 2 }],
        },
      },
    } as unknown as TSurveyQuestionSummaryRanking;

    render(<RankingSummary questionSummary={questionSummary} survey={survey} surveyType={surveyType} />);

    expect(screen.getByText("environments.surveys.summary.other_values_found")).toBeInTheDocument();
  });

  test("shows 'User' column in other values section for app survey type", () => {
    const questionSummary = {
      question: { id: "q1", headline: "Rank the following" },
      choices: {
        option1: {
          value: "Option A",
          avgRanking: 1.0,
          others: [{ value: "Other value", count: 1 }],
        },
      },
    } as unknown as TSurveyQuestionSummaryRanking;

    render(<RankingSummary questionSummary={questionSummary} survey={survey} surveyType="app" />);

    expect(screen.getByText("common.user")).toBeInTheDocument();
  });

  test("doesn't show 'User' column for link survey type", () => {
    const questionSummary = {
      question: { id: "q1", headline: "Rank the following" },
      choices: {
        option1: {
          value: "Option A",
          avgRanking: 1.0,
          others: [{ value: "Other value", count: 1 }],
        },
      },
    } as unknown as TSurveyQuestionSummaryRanking;

    render(<RankingSummary questionSummary={questionSummary} survey={survey} surveyType="link" />);

    expect(screen.queryByText("common.user")).not.toBeInTheDocument();
  });
});
