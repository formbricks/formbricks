import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyQuestionSummaryRanking } from "@formbricks/types/surveys/types";
import { RankingSummary } from "./RankingSummary";

// Mock dependencies
vi.mock("./QuestionSummaryHeader", () => ({
  QuestionSummaryHeader: () => <div data-testid="question-summary-header" />,
}));

vi.mock("../lib/utils", () => ({
  convertFloatToNDecimal: (value: number) => value.toFixed(2),
}));

vi.mock("@/modules/ui/components/id-badge", () => ({
  IdBadge: ({ id }: { id: string }) => (
    <div data-testid="id-badge" data-id={id}>
      ID: {id}
    </div>
  ),
}));

describe("RankingSummary", () => {
  afterEach(() => {
    cleanup();
  });

  const survey = {} as TSurvey;

  test("renders ranking results in correct order", () => {
    const questionSummary = {
      question: {
        id: "q1",
        headline: "Rank the following",
        choices: [
          { id: "choice1", label: { default: "Option A" } },
          { id: "choice2", label: { default: "Option B" } },
          { id: "choice3", label: { default: "Option C" } },
        ],
      },
      choices: {
        option1: { value: "Option A", avgRanking: 1.5, others: [] },
        option2: { value: "Option B", avgRanking: 2.3, others: [] },
        option3: { value: "Option C", avgRanking: 1.2, others: [] },
      },
    } as unknown as TSurveyQuestionSummaryRanking;

    render(<RankingSummary questionSummary={questionSummary} survey={survey} />);

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

  test("doesn't show 'User' column for link survey type", () => {
    const questionSummary = {
      question: {
        id: "q1",
        headline: "Rank the following",
        choices: [{ id: "choice1", label: { default: "Option A" } }],
      },
      choices: {
        option1: {
          value: "Option A",
          avgRanking: 1.0,
          others: [{ value: "Other value", count: 1 }],
        },
      },
    } as unknown as TSurveyQuestionSummaryRanking;

    render(<RankingSummary questionSummary={questionSummary} survey={survey} />);

    expect(screen.queryByText("common.user")).not.toBeInTheDocument();
  });

  // New tests for IdBadge functionality
  test("renders IdBadge when choice ID is found via label", () => {
    const questionSummary = {
      question: {
        id: "q2",
        headline: "Rank these options",
        choices: [
          { id: "rank-choice-1", label: { default: "First Option" } },
          { id: "rank-choice-2", label: { default: "Second Option" } },
          { id: "rank-choice-3", label: { default: "Third Option" } },
        ],
      },
      choices: {
        option1: { value: "First Option", avgRanking: 1.5, others: [] },
        option2: { value: "Second Option", avgRanking: 2.1, others: [] },
        option3: { value: "Third Option", avgRanking: 2.8, others: [] },
      },
    } as unknown as TSurveyQuestionSummaryRanking;

    render(<RankingSummary questionSummary={questionSummary} survey={survey} />);

    const idBadges = screen.getAllByTestId("id-badge");
    expect(idBadges).toHaveLength(3);
    expect(idBadges[0]).toHaveAttribute("data-id", "rank-choice-1");
    expect(idBadges[1]).toHaveAttribute("data-id", "rank-choice-2");
    expect(idBadges[2]).toHaveAttribute("data-id", "rank-choice-3");
    expect(idBadges[0]).toHaveTextContent("ID: rank-choice-1");
    expect(idBadges[1]).toHaveTextContent("ID: rank-choice-2");
    expect(idBadges[2]).toHaveTextContent("ID: rank-choice-3");
  });

  test("getChoiceIdByValue function correctly maps ranking values to choice IDs", () => {
    const questionSummary = {
      question: {
        id: "q4",
        headline: "Rate importance",
        choices: [
          { id: "importance-high", label: { default: "Very Important" } },
          { id: "importance-medium", label: { default: "Somewhat Important" } },
          { id: "importance-low", label: { default: "Not Important" } },
        ],
      },
      choices: {
        option1: { value: "Very Important", avgRanking: 1.2, others: [] },
        option2: { value: "Somewhat Important", avgRanking: 2.0, others: [] },
        option3: { value: "Not Important", avgRanking: 2.8, others: [] },
      },
    } as unknown as TSurveyQuestionSummaryRanking;

    render(<RankingSummary questionSummary={questionSummary} survey={survey} />);

    const idBadges = screen.getAllByTestId("id-badge");
    expect(idBadges).toHaveLength(3);

    // Should be ordered by avgRanking (ascending)
    expect(screen.getByText("Very Important")).toBeInTheDocument(); // avgRanking: 1.2
    expect(screen.getByText("Somewhat Important")).toBeInTheDocument(); // avgRanking: 2.0
    expect(screen.getByText("Not Important")).toBeInTheDocument(); // avgRanking: 2.8

    expect(idBadges[0]).toHaveAttribute("data-id", "importance-high");
    expect(idBadges[1]).toHaveAttribute("data-id", "importance-medium");
    expect(idBadges[2]).toHaveAttribute("data-id", "importance-low");
  });

  test("handles mixed choices with and without matching IDs", () => {
    const questionSummary = {
      question: {
        id: "q5",
        headline: "Mixed options",
        choices: [
          { id: "valid-choice-1", label: { default: "Valid Option" } },
          { id: "valid-choice-2", label: { default: "Another Valid Option" } },
        ],
      },
      choices: {
        option1: { value: "Valid Option", avgRanking: 1.5, others: [] },
        option2: { value: "Unknown Option", avgRanking: 2.0, others: [] },
        option3: { value: "Another Valid Option", avgRanking: 2.5, others: [] },
      },
    } as unknown as TSurveyQuestionSummaryRanking;

    render(<RankingSummary questionSummary={questionSummary} survey={survey} />);

    const idBadges = screen.getAllByTestId("id-badge");
    expect(idBadges).toHaveLength(3); // Only 2 out of 3 should have badges

    // Check that all options are still displayed
    expect(screen.getByText("Valid Option")).toBeInTheDocument();
    expect(screen.getByText("Unknown Option")).toBeInTheDocument();
    expect(screen.getByText("Another Valid Option")).toBeInTheDocument();

    // Check that only the valid choices have badges
    expect(idBadges[0]).toHaveAttribute("data-id", "valid-choice-1");
    expect(idBadges[1]).toHaveAttribute("data-id", "other");
    expect(idBadges[2]).toHaveAttribute("data-id", "valid-choice-2");
  });

  test("handles special characters in choice labels", () => {
    const questionSummary = {
      question: {
        id: "q6",
        headline: "Special characters test",
        choices: [
          { id: "special-1", label: { default: "Option with 'quotes'" } },
          { id: "special-2", label: { default: "Option & Ampersand" } },
        ],
      },
      choices: {
        option1: { value: "Option with 'quotes'", avgRanking: 1.0, others: [] },
        option2: { value: "Option & Ampersand", avgRanking: 2.0, others: [] },
      },
    } as unknown as TSurveyQuestionSummaryRanking;

    render(<RankingSummary questionSummary={questionSummary} survey={survey} />);

    const idBadges = screen.getAllByTestId("id-badge");
    expect(idBadges).toHaveLength(2);
    expect(idBadges[0]).toHaveAttribute("data-id", "special-1");
    expect(idBadges[1]).toHaveAttribute("data-id", "special-2");

    expect(screen.getByText("Option with 'quotes'")).toBeInTheDocument();
    expect(screen.getByText("Option & Ampersand")).toBeInTheDocument();
  });
});
