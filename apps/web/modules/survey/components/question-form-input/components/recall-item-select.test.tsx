import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  TSurvey,
  TSurveyQuestion,
  TSurveyQuestionTypeEnum,
  TSurveyRecallItem,
} from "@formbricks/types/surveys/types";
import { RecallItemSelect } from "./recall-item-select";

vi.mock("@/lib/utils/recall", () => ({
  replaceRecallInfoWithUnderline: vi.fn((text) => `_${text}_`),
  getTextContentWithRecallTruncated: vi.fn((text: string, maxLength: number = 25) => {
    // Simple mock: clean text and truncate
    const cleaned = text
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const withRecallReplaced = cleaned.replace(/#recall:[^#]+#/g, "___");

    if (withRecallReplaced.length <= maxLength) {
      return withRecallReplaced;
    }

    const start = withRecallReplaced.slice(0, 10);
    const end = withRecallReplaced.slice(-10);
    return `${start}...${end}`;
  }),
}));

describe("RecallItemSelect", () => {
  afterEach(() => {
    cleanup();
  });

  const mockAddRecallItem = vi.fn();
  const mockSetShowRecallItemSelect = vi.fn();

  const mockSurvey = {
    id: "survey-1",
    name: "Test Survey",
    createdAt: new Date("2023-01-01T00:00:00Z"),
    updatedAt: new Date("2023-01-01T00:00:00Z"),
    questions: [
      {
        id: "q1",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        headline: { en: "Question 1" },
      } as unknown as TSurveyQuestion,
      {
        id: "q2",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        headline: { en: "Question 2" },
      } as unknown as TSurveyQuestion,
      {
        id: "current-q",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { en: "Current Question" },
      } as unknown as TSurveyQuestion,
      {
        id: "q4",
        type: TSurveyQuestionTypeEnum.FileUpload,
        headline: { en: "File Upload Question" },
      } as unknown as TSurveyQuestion,
    ],
    hiddenFields: {
      enabled: true,
      fieldIds: ["hidden1", "hidden2"],
    },
    variables: [
      { id: "var1", name: "Variable 1", type: "text" } as unknown as TSurvey["variables"][0],
      { id: "var2", name: "Variable 2", type: "number" } as unknown as TSurvey["variables"][1],
    ],
    welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
    status: "draft",
    environmentId: "env-1",
    type: "app",
  } as unknown as TSurvey;

  const mockRecallItems: TSurveyRecallItem[] = [];

  test("renders recall items from questions, hidden fields, and variables", async () => {
    render(
      <RecallItemSelect
        localSurvey={mockSurvey}
        questionId="current-q"
        addRecallItem={mockAddRecallItem}
        setShowRecallItemSelect={mockSetShowRecallItemSelect}
        recallItems={mockRecallItems}
        selectedLanguageCode="en"
        hiddenFields={mockSurvey.hiddenFields}
      />
    );

    expect(screen.getByText("Question 1")).toBeInTheDocument();
    expect(screen.getByText("Question 2")).toBeInTheDocument();
    expect(screen.getByText("hidden1")).toBeInTheDocument();
    expect(screen.getByText("hidden2")).toBeInTheDocument();
    expect(screen.getByText("Variable 1")).toBeInTheDocument();
    expect(screen.getByText("Variable 2")).toBeInTheDocument();

    expect(screen.queryByText("Current Question")).not.toBeInTheDocument();
    expect(screen.queryByText("File Upload Question")).not.toBeInTheDocument();
  });

  test("do not render questions if questionId is 'start' (welcome card)", async () => {
    render(
      <RecallItemSelect
        localSurvey={mockSurvey}
        questionId="start"
        addRecallItem={mockAddRecallItem}
        setShowRecallItemSelect={mockSetShowRecallItemSelect}
        recallItems={mockRecallItems}
        selectedLanguageCode="en"
        hiddenFields={mockSurvey.hiddenFields}
      />
    );

    expect(screen.queryByText("Question 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Question 2")).not.toBeInTheDocument();

    expect(screen.getByText("hidden1")).toBeInTheDocument();
    expect(screen.getByText("hidden2")).toBeInTheDocument();
    expect(screen.getByText("Variable 1")).toBeInTheDocument();
    expect(screen.getByText("Variable 2")).toBeInTheDocument();

    expect(screen.queryByText("Current Question")).not.toBeInTheDocument();
    expect(screen.queryByText("File Upload Question")).not.toBeInTheDocument();
  });

  test("filters recall items based on search input", async () => {
    const user = userEvent.setup();
    render(
      <RecallItemSelect
        localSurvey={mockSurvey}
        questionId="current-q"
        addRecallItem={mockAddRecallItem}
        setShowRecallItemSelect={mockSetShowRecallItemSelect}
        recallItems={mockRecallItems}
        selectedLanguageCode="en"
        hiddenFields={mockSurvey.hiddenFields}
      />
    );

    const searchInput = screen.getByPlaceholderText("Search options");
    await user.type(searchInput, "Variable");

    expect(screen.getByText("Variable 1")).toBeInTheDocument();
    expect(screen.getByText("Variable 2")).toBeInTheDocument();
    expect(screen.queryByText("Question 1")).not.toBeInTheDocument();
  });

  test("calls addRecallItem and setShowRecallItemSelect when item is selected", async () => {
    const user = userEvent.setup();
    render(
      <RecallItemSelect
        localSurvey={mockSurvey}
        questionId="current-q"
        addRecallItem={mockAddRecallItem}
        setShowRecallItemSelect={mockSetShowRecallItemSelect}
        recallItems={mockRecallItems}
        selectedLanguageCode="en"
        hiddenFields={mockSurvey.hiddenFields}
      />
    );

    const firstItem = screen.getByText("Question 1");
    await user.click(firstItem);

    expect(mockAddRecallItem).toHaveBeenCalledWith({
      id: "q1",
      label: "Question 1",
      type: "question",
    });
    expect(mockSetShowRecallItemSelect).toHaveBeenCalledWith(false);
  });

  test("doesn't show already selected recall items", async () => {
    const selectedRecallItems: TSurveyRecallItem[] = [{ id: "q1", label: "Question 1", type: "question" }];

    render(
      <RecallItemSelect
        localSurvey={mockSurvey}
        questionId="current-q"
        addRecallItem={mockAddRecallItem}
        setShowRecallItemSelect={mockSetShowRecallItemSelect}
        recallItems={selectedRecallItems}
        selectedLanguageCode="en"
        hiddenFields={mockSurvey.hiddenFields}
      />
    );

    expect(screen.queryByText("Question 1")).not.toBeInTheDocument();
    expect(screen.getByText("Question 2")).toBeInTheDocument();
  });

  test("shows 'No recall items found' when search has no results", async () => {
    const user = userEvent.setup();
    render(
      <RecallItemSelect
        localSurvey={mockSurvey}
        questionId="current-q"
        addRecallItem={mockAddRecallItem}
        setShowRecallItemSelect={mockSetShowRecallItemSelect}
        recallItems={mockRecallItems}
        selectedLanguageCode="en"
        hiddenFields={mockSurvey.hiddenFields}
      />
    );

    const searchInput = screen.getByPlaceholderText("Search options");
    await user.type(searchInput, "nonexistent");

    expect(screen.getByText("environments.surveys.edit.no_recall_items_found")).toBeInTheDocument();
  });
});
