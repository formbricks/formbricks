import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyQuestionSummaryCta } from "@formbricks/types/surveys/types";
import { CTASummary } from "./CTASummary";

vi.mock("@/modules/ui/components/progress-bar", () => ({
  ProgressBar: ({ progress, barColor }: { progress: number; barColor: string }) => (
    <div data-testid="progress-bar">{`${progress}-${barColor}`}</div>
  ),
}));

vi.mock("./QuestionSummaryHeader", () => ({
  QuestionSummaryHeader: ({
    additionalInfo,
  }: {
    showResponses: boolean;
    additionalInfo: React.ReactNode;
  }) => <div data-testid="question-summary-header">{additionalInfo}</div>,
}));

vi.mock("lucide-react", () => ({
  InboxIcon: () => <div data-testid="inbox-icon" />,
}));

vi.mock("../lib/utils", () => ({
  convertFloatToNDecimal: (value: number) => value.toFixed(2),
}));

describe("CTASummary", () => {
  afterEach(() => {
    cleanup();
  });

  const survey = {} as TSurvey;

  test("renders with all metrics and required question", () => {
    const questionSummary = {
      question: { id: "q1", headline: "CTA Question", required: true },
      impressionCount: 100,
      clickCount: 25,
      skipCount: 10,
      ctr: { count: 25, percentage: 25 },
    } as unknown as TSurveyQuestionSummaryCta;

    render(<CTASummary questionSummary={questionSummary} survey={survey} />);

    expect(screen.getByTestId("question-summary-header")).toBeInTheDocument();
    expect(screen.getByText("100 common.impressions")).toBeInTheDocument();
    // Use getAllByText instead of getByText for multiple matching elements
    expect(screen.getAllByText("25 common.clicks")).toHaveLength(2);
    expect(screen.queryByText("10 common.skips")).not.toBeInTheDocument(); // Should not show skips for required questions

    // Check CTR section
    expect(screen.getByText("CTR")).toBeInTheDocument();
    expect(screen.getByText("25.00%")).toBeInTheDocument();

    // Check progress bar
    expect(screen.getByTestId("progress-bar")).toHaveTextContent("0.25-bg-brand-dark");
  });

  test("renders skip count for non-required questions", () => {
    const questionSummary = {
      question: { id: "q1", headline: "CTA Question", required: false },
      impressionCount: 100,
      clickCount: 20,
      skipCount: 30,
      ctr: { count: 20, percentage: 20 },
    } as unknown as TSurveyQuestionSummaryCta;

    render(<CTASummary questionSummary={questionSummary} survey={survey} />);

    expect(screen.getByText("30 common.skips")).toBeInTheDocument();
  });

  test("renders singular form for count = 1", () => {
    const questionSummary = {
      question: { id: "q1", headline: "CTA Question", required: true },
      impressionCount: 10,
      clickCount: 1,
      skipCount: 0,
      ctr: { count: 1, percentage: 10 },
    } as unknown as TSurveyQuestionSummaryCta;

    render(<CTASummary questionSummary={questionSummary} survey={survey} />);

    // Use getAllByText instead of getByText for multiple matching elements
    expect(screen.getAllByText("1 common.click")).toHaveLength(1);
  });
});
