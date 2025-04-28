import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MatrixQuestionSummary } from "./MatrixQuestionSummary";

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/QuestionSummaryHeader",
  () => ({
    QuestionSummaryHeader: () => <div>QuestionSummaryHeader</div>,
  })
);

describe("MatrixQuestionSummary", () => {
  afterEach(() => {
    cleanup();
  });

  const survey = { id: "s1" } as any;
  const questionSummary = {
    question: { id: "q1", headline: "Q Head", type: "matrix" },
    data: [
      {
        rowLabel: "Row1",
        totalResponsesForRow: 10,
        columnPercentages: [
          { column: "Yes", percentage: 50 },
          { column: "No", percentage: 50 },
        ],
      },
    ],
  } as any;

  test("renders headers and buttons, click triggers setFilter", async () => {
    const setFilter = vi.fn();
    render(<MatrixQuestionSummary questionSummary={questionSummary} survey={survey} setFilter={setFilter} />);

    // column headers
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
    // row label
    expect(screen.getByText("Row1")).toBeInTheDocument();
    // buttons
    const btn = screen.getAllByRole("button", { name: /50/ });
    await userEvent.click(btn[0]);
    expect(setFilter).toHaveBeenCalledWith("q1", "Q Head", "matrix", "Row1", "Yes");
  });
});
