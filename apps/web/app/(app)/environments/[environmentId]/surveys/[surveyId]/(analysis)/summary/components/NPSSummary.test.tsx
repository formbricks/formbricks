import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurveyQuestionSummaryNps } from "@formbricks/types/surveys/types";
import { NPSSummary } from "./NPSSummary";

vi.mock("@/modules/ui/components/progress-bar", () => ({
  ProgressBar: ({ progress, barColor }: { progress: number; barColor: string }) => (
    <div data-testid="progress-bar">{`${progress}-${barColor}`}</div>
  ),
  HalfCircle: ({ value }: { value: number }) => <div data-testid="half-circle">{value}</div>,
}));
vi.mock("./QuestionSummaryHeader", () => ({
  QuestionSummaryHeader: () => <div data-testid="question-summary-header" />,
}));

describe("NPSSummary", () => {
  afterEach(() => {
    cleanup();
  });

  const baseQuestion = { id: "q1", headline: "Question?", type: "nps" as const };
  const summary = {
    question: baseQuestion,
    promoters: { count: 2, percentage: 50 },
    passives: { count: 1, percentage: 25 },
    detractors: { count: 1, percentage: 25 },
    dismissed: { count: 0, percentage: 0 },
    score: 25,
  } as unknown as TSurveyQuestionSummaryNps;
  const survey = {} as any;

  test("renders header, groups, ProgressBar and HalfCircle", () => {
    render(<NPSSummary questionSummary={summary} survey={survey} setFilter={() => {}} />);
    expect(screen.getByTestId("question-summary-header")).toBeDefined();
    ["promoters", "passives", "detractors", "dismissed"].forEach((g) =>
      expect(screen.getByText(g)).toBeDefined()
    );
    expect(screen.getAllByTestId("progress-bar")[0]).toBeDefined();
    expect(screen.getByTestId("half-circle")).toHaveTextContent("25");
  });

  test.each([
    ["promoters", "environments.surveys.summary.includes_either", ["9", "10"]],
    ["passives", "environments.surveys.summary.includes_either", ["7", "8"]],
    ["detractors", "environments.surveys.summary.is_less_than", "7"],
    ["dismissed", "common.skipped", undefined],
  ])("clicking %s calls setFilter correctly", async (group, cmp, vals) => {
    const setFilter = vi.fn();
    render(<NPSSummary questionSummary={summary} survey={survey} setFilter={setFilter} />);
    await userEvent.click(screen.getByText(group));
    expect(setFilter).toHaveBeenCalledWith(
      baseQuestion.id,
      baseQuestion.headline,
      baseQuestion.type,
      cmp,
      vals
    );
  });
});
