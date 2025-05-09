import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyQuestionSummary, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { QuestionSummaryHeader } from "./QuestionSummaryHeader";

// Mock dependencies
vi.mock("@/lib/utils/recall", () => ({
  recallToHeadline: () => ({ default: "Recalled Headline" }),
}));

vi.mock("@/modules/survey/editor/lib/utils", () => ({
  formatTextWithSlashes: (text: string) => <span data-testid="formatted-headline">{text}</span>,
}));

vi.mock("@/modules/survey/lib/questions", () => ({
  getQuestionTypes: () => [
    {
      id: "openText",
      label: "Open Text",
      icon: () => <div data-testid="question-icon">Icon</div>,
    },
    {
      id: "multipleChoice",
      label: "Multiple Choice",
      icon: () => <div data-testid="question-icon">Icon</div>,
    },
  ],
}));

vi.mock("@/modules/ui/components/settings-id", () => ({
  SettingsId: ({ title, id }: { title: string; id: string }) => (
    <div data-testid="settings-id">
      {title}: {id}
    </div>
  ),
}));

// Mock InboxIcon
vi.mock("lucide-react", () => ({
  InboxIcon: () => <div data-testid="inbox-icon"></div>,
}));

describe("QuestionSummaryHeader", () => {
  afterEach(() => {
    cleanup();
  });

  const survey = {} as TSurvey;

  test("renders header with question headline and type", () => {
    const questionSummary = {
      question: {
        id: "q1",
        headline: { default: "Test Question" },
        type: "openText" as TSurveyQuestionTypeEnum,
        required: true,
      },
      responseCount: 42,
    } as unknown as TSurveyQuestionSummary;

    render(<QuestionSummaryHeader questionSummary={questionSummary} survey={survey} />);

    expect(screen.getByTestId("formatted-headline")).toHaveTextContent("Recalled Headline");

    // Look for text content with a more specific approach
    const questionTypeElement = screen.getByText((content) => {
      return content.includes("Open Text") && !content.includes("common.question_id");
    });
    expect(questionTypeElement).toBeInTheDocument();

    // Check for responses text specifically
    expect(
      screen.getByText((content) => {
        return content.includes("42") && content.includes("common.responses");
      })
    ).toBeInTheDocument();

    expect(screen.getByTestId("question-icon")).toBeInTheDocument();
    expect(screen.getByTestId("settings-id")).toHaveTextContent("common.question_id: q1");
    expect(screen.queryByText("environments.surveys.edit.optional")).not.toBeInTheDocument();
  });

  test("shows 'optional' tag when question is not required", () => {
    const questionSummary = {
      question: {
        id: "q2",
        headline: { default: "Optional Question" },
        type: "multipleChoice" as TSurveyQuestionTypeEnum,
        required: false,
      },
      responseCount: 10,
    } as unknown as TSurveyQuestionSummary;

    render(<QuestionSummaryHeader questionSummary={questionSummary} survey={survey} />);

    expect(screen.getByText("environments.surveys.edit.optional")).toBeInTheDocument();
  });

  test("hides response count when showResponses is false", () => {
    const questionSummary = {
      question: {
        id: "q3",
        headline: { default: "No Response Count Question" },
        type: "openText" as TSurveyQuestionTypeEnum,
        required: true,
      },
      responseCount: 15,
    } as unknown as TSurveyQuestionSummary;

    render(<QuestionSummaryHeader questionSummary={questionSummary} survey={survey} showResponses={false} />);

    expect(
      screen.queryByText((content) => content.includes("15") && content.includes("common.responses"))
    ).not.toBeInTheDocument();
  });

  test("shows unknown question type for unrecognized type", () => {
    const questionSummary = {
      question: {
        id: "q4",
        headline: { default: "Unknown Type Question" },
        type: "unknownType" as TSurveyQuestionTypeEnum,
        required: true,
      },
      responseCount: 5,
    } as unknown as TSurveyQuestionSummary;

    render(<QuestionSummaryHeader questionSummary={questionSummary} survey={survey} />);

    // Look for text in the question type element specifically
    const unknownTypeElement = screen.getByText((content) => {
      return (
        content.includes("environments.surveys.summary.unknown_question_type") &&
        !content.includes("common.question_id")
      );
    });
    expect(unknownTypeElement).toBeInTheDocument();
  });

  test("renders additional info when provided", () => {
    const questionSummary = {
      question: {
        id: "q5",
        headline: { default: "With Additional Info" },
        type: "openText" as TSurveyQuestionTypeEnum,
        required: true,
      },
      responseCount: 20,
    } as unknown as TSurveyQuestionSummary;

    const additionalInfo = <div data-testid="additional-info">Extra Information</div>;

    render(
      <QuestionSummaryHeader
        questionSummary={questionSummary}
        survey={survey}
        additionalInfo={additionalInfo}
      />
    );

    expect(screen.getByTestId("additional-info")).toBeInTheDocument();
    expect(screen.getByText("Extra Information")).toBeInTheDocument();
  });
});
