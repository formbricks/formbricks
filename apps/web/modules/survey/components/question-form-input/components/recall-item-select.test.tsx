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

    expect(screen.getByText("_Question 1_")).toBeInTheDocument();
    expect(screen.getByText("_Question 2_")).toBeInTheDocument();
    expect(screen.getByText("_hidden1_")).toBeInTheDocument();
    expect(screen.getByText("_hidden2_")).toBeInTheDocument();
    expect(screen.getByText("_Variable 1_")).toBeInTheDocument();
    expect(screen.getByText("_Variable 2_")).toBeInTheDocument();

    expect(screen.queryByText("_Current Question_")).not.toBeInTheDocument();
    expect(screen.queryByText("_File Upload Question_")).not.toBeInTheDocument();
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

    expect(screen.getByText("_Variable 1_")).toBeInTheDocument();
    expect(screen.getByText("_Variable 2_")).toBeInTheDocument();
    expect(screen.queryByText("_Question 1_")).not.toBeInTheDocument();
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

    const firstItem = screen.getByText("_Question 1_");
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

    expect(screen.queryByText("_Question 1_")).not.toBeInTheDocument();
    expect(screen.getByText("_Question 2_")).toBeInTheDocument();
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

    expect(screen.getByText("No recall items found 🤷")).toBeInTheDocument();
  });
});
