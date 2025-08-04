import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  TSurvey,
  TSurveyPictureSelectionQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { PictureChoiceSummary } from "./PictureChoiceSummary";

vi.mock("@/modules/ui/components/progress-bar", () => ({
  ProgressBar: ({ progress }: { progress: number }) => (
    <div data-testid="progress-bar" data-progress={progress} />
  ),
}));
vi.mock("./QuestionSummaryHeader", () => ({
  QuestionSummaryHeader: ({ additionalInfo }: any) => <div data-testid="header">{additionalInfo}</div>,
}));
vi.mock("@/modules/ui/components/id-badge", () => ({
  IdBadge: ({ id }: { id: string }) => (
    <div data-testid="id-badge" data-id={id}>
      ID: {id}
    </div>
  ),
}));

vi.mock("@/lib/response/utils", () => ({
  getChoiceIdByValue: (value: string, question: TSurveyPictureSelectionQuestion) => {
    return question.choices?.find((choice) => choice.imageUrl === value)?.id ?? "other";
  },
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

  // New tests for IdBadge functionality
  test("renders IdBadge when choice ID is found via imageUrl", () => {
    const choices = [
      { id: "choice1", imageUrl: "https://example.com/img1.png", percentage: 50, count: 5 },
      { id: "choice2", imageUrl: "https://example.com/img2.png", percentage: 50, count: 5 },
    ];
    const questionSummary = {
      choices,
      question: {
        id: "q2",
        type: TSurveyQuestionTypeEnum.PictureSelection,
        headline: "Picture Question",
        allowMulti: true,
        choices: [
          { id: "pic-choice-1", imageUrl: "https://example.com/img1.png" },
          { id: "pic-choice-2", imageUrl: "https://example.com/img2.png" },
        ],
      },
      selectionCount: 10,
    } as any;

    render(<PictureChoiceSummary questionSummary={questionSummary} survey={survey} setFilter={() => {}} />);

    const idBadges = screen.getAllByTestId("id-badge");
    expect(idBadges).toHaveLength(2);
    expect(idBadges[0]).toHaveAttribute("data-id", "pic-choice-1");
    expect(idBadges[1]).toHaveAttribute("data-id", "pic-choice-2");
    expect(idBadges[0]).toHaveTextContent("ID: pic-choice-1");
    expect(idBadges[1]).toHaveTextContent("ID: pic-choice-2");
  });

  test("getChoiceIdByValue function correctly maps imageUrl to choice ID", () => {
    const choices = [
      { id: "choice1", imageUrl: "https://cdn.example.com/photo1.jpg", percentage: 33.33, count: 2 },
      { id: "choice2", imageUrl: "https://cdn.example.com/photo2.jpg", percentage: 33.33, count: 2 },
      { id: "choice3", imageUrl: "https://cdn.example.com/photo3.jpg", percentage: 33.33, count: 2 },
    ];
    const questionSummary = {
      choices,
      question: {
        id: "q4",
        type: TSurveyQuestionTypeEnum.PictureSelection,
        headline: "Photo Selection",
        allowMulti: true,
        choices: [
          { id: "photo-a", imageUrl: "https://cdn.example.com/photo1.jpg" },
          { id: "photo-b", imageUrl: "https://cdn.example.com/photo2.jpg" },
          { id: "photo-c", imageUrl: "https://cdn.example.com/photo3.jpg" },
        ],
      },
      selectionCount: 6,
    } as any;

    render(<PictureChoiceSummary questionSummary={questionSummary} survey={survey} setFilter={() => {}} />);

    const idBadges = screen.getAllByTestId("id-badge");
    expect(idBadges).toHaveLength(3);
    expect(idBadges[0]).toHaveAttribute("data-id", "photo-a");
    expect(idBadges[1]).toHaveAttribute("data-id", "photo-b");
    expect(idBadges[2]).toHaveAttribute("data-id", "photo-c");

    // Verify the images are also rendered correctly
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3);
    expect(images[0]).toHaveAttribute("src", "https://cdn.example.com/photo1.jpg");
    expect(images[1]).toHaveAttribute("src", "https://cdn.example.com/photo2.jpg");
    expect(images[2]).toHaveAttribute("src", "https://cdn.example.com/photo3.jpg");
  });
});
