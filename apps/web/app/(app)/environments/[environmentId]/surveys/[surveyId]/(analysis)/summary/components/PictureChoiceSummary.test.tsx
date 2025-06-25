import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { PictureChoiceSummary } from "./PictureChoiceSummary";

vi.mock("@/modules/ui/components/progress-bar", () => ({
  ProgressBar: ({ progress }: { progress: number }) => (
    <div data-testid="progress-bar" data-progress={progress} />
  ),
}));
vi.mock("./QuestionSummaryHeader", () => ({
  QuestionSummaryHeader: ({ additionalInfo }: any) => <div data-testid="header">{additionalInfo}</div>,
}));

// mock next image
vi.mock("next/image", () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src }: { src: string }) => <img src={src} alt="" />,
}));

const survey = {} as TSurvey;

describe("PictureChoiceSummary", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders choices with formatted percentages and counts", () => {
    const choices = [
      { id: "1", imageUrl: "img1.png", percentage: 33.3333, count: 1 },
      { id: "2", imageUrl: "img2.png", percentage: 66.6667, count: 2 },
    ];
    const questionSummary = {
      choices,
      question: { id: "q1", type: TSurveyQuestionTypeEnum.PictureSelection, headline: "H", allowMulti: true },
      selectionCount: 3,
    } as any;
    render(<PictureChoiceSummary questionSummary={questionSummary} survey={survey} setFilter={() => {}} />);

    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByText("33.33%")).toBeInTheDocument();
    expect(screen.getByText("1 common.selection")).toBeInTheDocument();
    expect(screen.getByText("2 common.selections")).toBeInTheDocument();
    expect(screen.getAllByTestId("progress-bar")).toHaveLength(2);
  });

  test("calls setFilter with correct args on click", async () => {
    const choices = [{ id: "1", imageUrl: "img1.png", percentage: 25, count: 10 }];
    const questionSummary = {
      choices,
      question: {
        id: "q1",
        type: TSurveyQuestionTypeEnum.PictureSelection,
        headline: "H1",
        allowMulti: true,
      },
      selectionCount: 10,
    } as any;
    const setFilter = vi.fn();
    const user = userEvent.setup();
    render(<PictureChoiceSummary questionSummary={questionSummary} survey={survey} setFilter={setFilter} />);

    await user.click(screen.getByRole("button"));
    expect(setFilter).toHaveBeenCalledWith(
      "q1",
      "H1",
      TSurveyQuestionTypeEnum.PictureSelection,
      "environments.surveys.summary.includes_all",
      ["environments.surveys.edit.picture_idx"]
    );
  });

  test("hides additionalInfo when allowMulti is false", () => {
    const choices = [{ id: "1", imageUrl: "img1.png", percentage: 50, count: 5 }];
    const questionSummary = {
      choices,
      question: {
        id: "q1",
        type: TSurveyQuestionTypeEnum.PictureSelection,
        headline: "H2",
        allowMulti: false,
      },
      selectionCount: 5,
    } as any;
    render(<PictureChoiceSummary questionSummary={questionSummary} survey={survey} setFilter={() => {}} />);

    expect(screen.getByTestId("header")).toBeEmptyDOMElement();
  });
});
