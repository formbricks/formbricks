import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyQuestionSummaryCal } from "@formbricks/types/surveys/types";
import { CalSummary } from "./CalSummary";

vi.mock("@/modules/ui/components/progress-bar", () => ({
  ProgressBar: ({ progress, barColor }: { progress: number; barColor: string }) => (
    <div data-testid="progress-bar">{`${progress}-${barColor}`}</div>
  ),
}));

vi.mock("./QuestionSummaryHeader", () => ({
  QuestionSummaryHeader: () => <div data-testid="question-summary-header" />,
}));

vi.mock("../lib/utils", () => ({
  convertFloatToNDecimal: (value: number) => value.toFixed(2),
}));

describe("CalSummary", () => {
  afterEach(() => {
    cleanup();
  });

  const environmentId = "env-123";
  const survey = {} as TSurvey;

  test("renders the correct components and data", () => {
    const questionSummary = {
      question: { id: "q1", headline: "Calendar Question" },
      booked: { count: 5, percentage: 75 },
      skipped: { count: 1, percentage: 25 },
    } as unknown as TSurveyQuestionSummaryCal;

    render(<CalSummary questionSummary={questionSummary} environmentId={environmentId} survey={survey} />);

    expect(screen.getByTestId("question-summary-header")).toBeInTheDocument();

    // Check if booked section is displayed
    expect(screen.getByText("common.booked")).toBeInTheDocument();
    expect(screen.getByText("75.00%")).toBeInTheDocument();
    expect(screen.getByText("5 common.responses")).toBeInTheDocument();

    // Check if skipped section is displayed
    expect(screen.getByText("common.dismissed")).toBeInTheDocument();
    expect(screen.getByText("25.00%")).toBeInTheDocument();
    expect(screen.getByText("1 common.response")).toBeInTheDocument();

    // Check progress bars
    const progressBars = screen.getAllByTestId("progress-bar");
    expect(progressBars).toHaveLength(2);
    expect(progressBars[0]).toHaveTextContent("0.75-bg-brand-dark");
    expect(progressBars[1]).toHaveTextContent("0.25-bg-brand-dark");
  });

  test("renders singular and plural response counts correctly", () => {
    const questionSummary = {
      question: { id: "q1", headline: "Calendar Question" },
      booked: { count: 1, percentage: 50 },
      skipped: { count: 1, percentage: 50 },
    } as unknown as TSurveyQuestionSummaryCal;

    render(<CalSummary questionSummary={questionSummary} environmentId={environmentId} survey={survey} />);

    // Use getAllByText directly since we know there are multiple matching elements
    const responseElements = screen.getAllByText("1 common.response");
    expect(responseElements).toHaveLength(2);
  });
});
