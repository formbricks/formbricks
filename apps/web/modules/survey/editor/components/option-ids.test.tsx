import { getLocalizedValue } from "@/lib/i18n/utils";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { OptionIds } from "./option-ids";

vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: vi.fn((label: any, _languageCode: string) => label.default || ""),
}));

vi.mock("@/modules/ui/components/id-badge", () => ({
  IdBadge: ({ id, label }: { id: string; label?: string }) => (
    <div data-testid="id-badge" data-id={id} data-label={label}>
      {label ? `${label}: ${id}` : id}
    </div>
  ),
}));

vi.mock("@/modules/ui/components/label", () => ({
  Label: ({
    children,
    htmlFor,
    className,
  }: {
    children: React.ReactNode;
    htmlFor?: string;
    className?: string;
  }) => (
    <label htmlFor={htmlFor} className={className} data-testid="label">
      {children}
    </label>
  ),
}));

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, className }: { src: string; alt: string; className: string }) => (
    <img src={src} alt={alt} className={className} data-testid="choice-image" />
  ),
}));

describe("OptionIds", () => {
  const mockMultipleChoiceQuestion: TSurveyQuestion = {
    id: "question1",
    type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
    headline: { default: "Test Question" },
    required: false,
    choices: [
      { id: "choice1", label: { default: "Option 1" } },
      { id: "choice2", label: { default: "Option 2" } },
      { id: "choice3", label: { default: "Option 3" } },
    ],
  };

  const mockRankingQuestion: TSurveyQuestion = {
    id: "question2",
    type: TSurveyQuestionTypeEnum.Ranking,
    headline: { default: "Ranking Question" },
    required: false,
    choices: [
      { id: "rank1", label: { default: "First Choice" } },
      { id: "rank2", label: { default: "Second Choice" } },
    ],
  };

  const mockPictureSelectionQuestion: TSurveyQuestion = {
    id: "question3",
    type: TSurveyQuestionTypeEnum.PictureSelection,
    headline: { default: "Picture Question" },
    required: false,
    allowMulti: false,
    choices: [
      { id: "pic1", imageUrl: "https://example.com/image1.jpg" },
      { id: "pic2", imageUrl: "https://example.com/image2.jpg" },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders multiple choice question option IDs", () => {
    render(<OptionIds question={mockMultipleChoiceQuestion} selectedLanguageCode="en" />);

    expect(screen.getByTestId("label")).toBeInTheDocument();
    expect(screen.getByText("common.option_ids")).toBeInTheDocument();

    const idBadges = screen.getAllByTestId("id-badge");
    expect(idBadges).toHaveLength(3);
    expect(idBadges[0]).toHaveAttribute("data-id", "choice1");
    expect(idBadges[0]).toHaveAttribute("data-label", "Option 1");
    expect(idBadges[1]).toHaveAttribute("data-id", "choice2");
    expect(idBadges[1]).toHaveAttribute("data-label", "Option 2");
    expect(idBadges[2]).toHaveAttribute("data-id", "choice3");
    expect(idBadges[2]).toHaveAttribute("data-label", "Option 3");
  });

  test("renders multiple choice multi question option IDs", () => {
    const multiChoiceQuestion = {
      ...mockMultipleChoiceQuestion,
      type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
    } as TSurveyQuestion;

    render(<OptionIds question={multiChoiceQuestion} selectedLanguageCode="en" />);

    expect(screen.getByTestId("label")).toBeInTheDocument();
    expect(screen.getByText("common.option_ids")).toBeInTheDocument();

    const idBadges = screen.getAllByTestId("id-badge");
    expect(idBadges).toHaveLength(3);
  });

  test("renders ranking question option IDs", () => {
    render(<OptionIds question={mockRankingQuestion} selectedLanguageCode="en" />);

    expect(screen.getByTestId("label")).toBeInTheDocument();
    expect(screen.getByText("common.option_ids")).toBeInTheDocument();

    const idBadges = screen.getAllByTestId("id-badge");
    expect(idBadges).toHaveLength(2);
    expect(idBadges[0]).toHaveAttribute("data-id", "rank1");
    expect(idBadges[0]).toHaveAttribute("data-label", "First Choice");
    expect(idBadges[1]).toHaveAttribute("data-id", "rank2");
    expect(idBadges[1]).toHaveAttribute("data-label", "Second Choice");
  });

  test("renders picture selection question option IDs with images", () => {
    render(<OptionIds question={mockPictureSelectionQuestion} selectedLanguageCode="en" />);

    expect(screen.getByTestId("label")).toBeInTheDocument();
    expect(screen.getByText("common.option_ids")).toBeInTheDocument();

    const images = screen.getAllByTestId("choice-image");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", "https://example.com/image1.jpg");
    expect(images[0]).toHaveAttribute("alt", "Choice pic1");
    expect(images[1]).toHaveAttribute("src", "https://example.com/image2.jpg");
    expect(images[1]).toHaveAttribute("alt", "Choice pic2");

    const idBadges = screen.getAllByTestId("id-badge");
    expect(idBadges).toHaveLength(2);
    expect(idBadges[0]).toHaveAttribute("data-id", "pic1");
    expect(idBadges[1]).toHaveAttribute("data-id", "pic2");
  });

  test("handles picture selection with missing imageUrl", () => {
    const questionWithMissingImage = {
      ...mockPictureSelectionQuestion,
      choices: [
        { id: "pic1", imageUrl: "https://example.com/image1.jpg" },
        { id: "pic2", imageUrl: "" },
      ],
    } as TSurveyQuestion;

    render(<OptionIds question={questionWithMissingImage} selectedLanguageCode="en" />);

    const images = screen.getAllByTestId("choice-image");
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("src", "https://example.com/image1.jpg");
    // Next.js Image component doesn't render src attribute when imageUrl is empty
  });

  test("uses correct language code for localized values", () => {
    const getLocalizedValueMock = vi.mocked(getLocalizedValue);

    render(<OptionIds question={mockMultipleChoiceQuestion} selectedLanguageCode="fr" />);

    expect(getLocalizedValueMock).toHaveBeenCalledWith({ default: "Option 1" }, "fr");
    expect(getLocalizedValueMock).toHaveBeenCalledWith({ default: "Option 2" }, "fr");
    expect(getLocalizedValueMock).toHaveBeenCalledWith({ default: "Option 3" }, "fr");
  });
});
