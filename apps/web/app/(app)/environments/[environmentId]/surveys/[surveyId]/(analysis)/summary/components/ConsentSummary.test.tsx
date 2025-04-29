import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  TSurvey,
  TSurveyConsentQuestion,
  TSurveyQuestionSummaryConsent,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { ConsentSummary } from "./ConsentSummary";

vi.mock(
  "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/QuestionSummaryHeader",
  () => ({
    QuestionSummaryHeader: () => <div>QuestionSummaryHeader</div>,
  })
);

describe("ConsentSummary", () => {
  afterEach(() => {
    cleanup();
  });

  const mockSetFilter = vi.fn();
  const questionSummary = {
    question: {
      id: "q1",
      headline: { en: "Headline" },
      type: TSurveyQuestionTypeEnum.Consent,
    } as unknown as TSurveyConsentQuestion,
    accepted: { percentage: 60.5, count: 61 },
    dismissed: { percentage: 39.5, count: 40 },
  } as unknown as TSurveyQuestionSummaryConsent;
  const survey = {} as TSurvey;

  test("renders accepted and dismissed with correct values", () => {
    render(<ConsentSummary questionSummary={questionSummary} survey={survey} setFilter={mockSetFilter} />);
    expect(screen.getByText("common.accepted")).toBeInTheDocument();
    expect(screen.getByText(/60\.5%/)).toBeInTheDocument();
    expect(screen.getByText(/61/)).toBeInTheDocument();
    expect(screen.getByText("common.dismissed")).toBeInTheDocument();
    expect(screen.getByText(/39\.5%/)).toBeInTheDocument();
    expect(screen.getByText(/40/)).toBeInTheDocument();
  });

  test("calls setFilter with correct args on accepted click", async () => {
    render(<ConsentSummary questionSummary={questionSummary} survey={survey} setFilter={mockSetFilter} />);
    await userEvent.click(screen.getByText("common.accepted"));
    expect(mockSetFilter).toHaveBeenCalledWith(
      "q1",
      { en: "Headline" },
      TSurveyQuestionTypeEnum.Consent,
      "is",
      "common.accepted"
    );
  });

  test("calls setFilter with correct args on dismissed click", async () => {
    render(<ConsentSummary questionSummary={questionSummary} survey={survey} setFilter={mockSetFilter} />);
    await userEvent.click(screen.getByText("common.dismissed"));
    expect(mockSetFilter).toHaveBeenCalledWith(
      "q1",
      { en: "Headline" },
      TSurveyQuestionTypeEnum.Consent,
      "is",
      "common.dismissed"
    );
  });

  test("renders singular and plural response labels", () => {
    const oneAndTwo = {
      ...questionSummary,
      accepted: { percentage: questionSummary.accepted.percentage, count: 1 },
      dismissed: { percentage: questionSummary.dismissed.percentage, count: 2 },
    };
    render(<ConsentSummary questionSummary={oneAndTwo} survey={survey} setFilter={mockSetFilter} />);
    expect(screen.getByText(/1 common\.response/)).toBeInTheDocument();
    expect(screen.getByText(/2 common\.responses/)).toBeInTheDocument();
  });
});
