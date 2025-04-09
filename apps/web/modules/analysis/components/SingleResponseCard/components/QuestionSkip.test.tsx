import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TSurveyQuestion } from "@formbricks/types/surveys/types";
import { QuestionSkip } from "./QuestionSkip";

vi.mock("@/modules/ui/components/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/modules/i18n/utils", () => ({
  getLocalizedValue: vi.fn((value, locale) => value),
}));

// Mock recall utils
vi.mock("@/modules/lib/utils/recall", () => ({
  parseRecallInfo: vi.fn((headline, responseData) => `parsed: ${headline}`),
}));

const dummyQuestions = [
  { id: "f1", headline: "headline1" },
  { id: "f2", headline: "headline2" },
] as unknown as TSurveyQuestion[];

const dummyResponseData = { f1: "Answer 1", f2: "Answer 2" };

describe("QuestionSkip", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when skippedQuestions is falsy", () => {
    render(
      <QuestionSkip
        skippedQuestions={undefined}
        status="skipped"
        questions={dummyQuestions}
        responseData={dummyResponseData}
      />
    );
    expect(screen.queryByText("headline1")).toBeNull();
    expect(screen.queryByText("headline2")).toBeNull();
  });

  it("renders welcomeCard branch", () => {
    render(
      <QuestionSkip
        skippedQuestions={["f1"]}
        status="welcomeCard"
        questions={dummyQuestions}
        responseData={{ f1: "Answer 1" }}
        isFirstQuestionAnswered={false}
      />
    );
    expect(screen.getByText("common.welcome_card")).toBeInTheDocument();
  });

  it("renders skipped branch with tooltip and parsed headlines", () => {
    render(
      <QuestionSkip
        skippedQuestions={["f1", "f2"]}
        status="skipped"
        questions={dummyQuestions}
        responseData={dummyResponseData}
      />
    );
    // Check tooltip text from TooltipContent
    expect(screen.getByTestId("tooltip-respondent_skipped_questions")).toBeInTheDocument();
    // Check mapping: parseRecallInfo should be called on each headline value, so expect the parsed text to appear.
    expect(screen.getByText("parsed: headline1")).toBeInTheDocument();
    expect(screen.getByText("parsed: headline2")).toBeInTheDocument();
  });

  it("renders aborted branch with closed message and parsed headlines", () => {
    render(
      <QuestionSkip
        skippedQuestions={["f1", "f2"]}
        status="aborted"
        questions={dummyQuestions}
        responseData={dummyResponseData}
      />
    );
    expect(screen.getByTestId("tooltip-survey_closed")).toBeInTheDocument();
    expect(screen.getByText("parsed: headline1")).toBeInTheDocument();
    expect(screen.getByText("parsed: headline2")).toBeInTheDocument();
  });
});
