import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyQuestionTypeEnum, TSurveySummary } from "@formbricks/types/surveys/types";
import { SummaryDropOffs } from "./SummaryDropOffs";

// Mock dependencies
vi.mock("@/lib/utils/recall", () => ({
  recallToHeadline: () => ({ default: "Recalled Question" }),
}));

vi.mock("@/modules/survey/editor/lib/utils", () => ({
  formatTextWithSlashes: (text) => <span data-testid="formatted-text">{text}</span>,
}));

vi.mock("@/modules/survey/lib/questions", () => ({
  getQuestionIcon: () => () => <div data-testid="question-icon" />,
}));

vi.mock("@/modules/ui/components/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-trigger">{children}</div>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

vi.mock("lucide-react", () => ({
  TimerIcon: () => <div data-testid="timer-icon" />,
}));

describe("SummaryDropOffs", () => {
  afterEach(() => {
    cleanup();
  });

  const mockSurvey = {} as TSurvey;
  const mockDropOff: TSurveySummary["dropOff"] = [
    {
      questionId: "q1",
      headline: "First Question",
      questionType: TSurveyQuestionTypeEnum.OpenText,
      ttc: 15000, // 15 seconds
      impressions: 100,
      dropOffCount: 20,
      dropOffPercentage: 20,
    },
    {
      questionId: "q2",
      headline: "Second Question",
      questionType: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
      ttc: 30000, // 30 seconds
      impressions: 80,
      dropOffCount: 15,
      dropOffPercentage: 18.75,
    },
    {
      questionId: "q3",
      headline: "Third Question",
      questionType: TSurveyQuestionTypeEnum.Rating,
      ttc: 0, // No time data
      impressions: 65,
      dropOffCount: 10,
      dropOffPercentage: 15.38,
    },
  ];

  test("renders header row with correct columns", () => {
    render(<SummaryDropOffs dropOff={mockDropOff} survey={mockSurvey} />);

    // Check header
    expect(screen.getByText("common.questions")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("timer-icon")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.impressions")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.drop_offs")).toBeInTheDocument();
  });

  test("renders tooltip with correct content", () => {
    render(<SummaryDropOffs dropOff={mockDropOff} survey={mockSurvey} />);

    expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.ttc_tooltip")).toBeInTheDocument();
  });

  test("renders all drop-off items with correct data", () => {
    render(<SummaryDropOffs dropOff={mockDropOff} survey={mockSurvey} />);

    // There should be 3 rows of data (one for each question)
    expect(screen.getAllByTestId("question-icon")).toHaveLength(3);
    expect(screen.getAllByTestId("formatted-text")).toHaveLength(3);

    // Check time to complete values
    expect(screen.getByText("15.00s")).toBeInTheDocument(); // 15000ms converted to seconds
    expect(screen.getByText("30.00s")).toBeInTheDocument(); // 30000ms converted to seconds
    expect(screen.getByText("N/A")).toBeInTheDocument(); // 0ms shown as N/A

    // Check impressions values
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("65")).toBeInTheDocument();

    // Check drop-off counts and percentages
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("(20%)")).toBeInTheDocument();

    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("(19%)")).toBeInTheDocument(); // 18.75% rounded to 19%

    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("(15%)")).toBeInTheDocument(); // 15.38% rounded to 15%
  });

  test("renders empty state when dropOff array is empty", () => {
    render(<SummaryDropOffs dropOff={[]} survey={mockSurvey} />);

    // Header should still be visible
    expect(screen.getByText("common.questions")).toBeInTheDocument();

    // But no question icons
    expect(screen.queryByTestId("question-icon")).not.toBeInTheDocument();
  });
});
