import { createI18nString } from "@/lib/i18n/utils";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  TSurvey,
  TSurveyLanguage,
  TSurveyMatrixQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { MatrixColumnChoice } from "./matrix-column-choice";

// Mock survey languages
const mockSurveyLanguages: TSurveyLanguage[] = [
  {
    default: true,
    enabled: true,
    language: {
      id: "en",
      code: "en",
      alias: "English",
      createdAt: new Date(),
      updatedAt: new Date(),
      projectId: "project-1",
    },
  },
];

// Mock matrix question
const mockQuestion: TSurveyMatrixQuestion = {
  id: "matrix-1",
  type: TSurveyQuestionTypeEnum.Matrix,
  headline: createI18nString("Matrix Question", ["en"]),
  required: false,
  logic: [],
  rows: [createI18nString("Row 1", ["en"]), createI18nString("Row 2", ["en"])],
  columns: [
    createI18nString("Column 1", ["en"]),
    createI18nString("Column 2", ["en"]),
    createI18nString("Column 3", ["en"]),
  ],
  shuffleOption: "none",
};

// Mock survey
const mockSurvey: TSurvey = {
  id: "survey-1",
  name: "Test Survey",
  questions: [mockQuestion],
  languages: mockSurveyLanguages,
} as unknown as TSurvey;

const defaultProps = {
  columnIdx: 0,
  questionIdx: 0,
  updateMatrixLabel: vi.fn(),
  handleDeleteLabel: vi.fn(),
  handleKeyDown: vi.fn(),
  isInvalid: false,
  localSurvey: mockSurvey,
  selectedLanguageCode: "en",
  setSelectedLanguageCode: vi.fn(),
  question: mockQuestion,
  locale: "en-US" as TUserLocale,
};

const renderWithDndContext = (props = {}) => {
  const finalProps = { ...defaultProps, ...props };
  return render(
    <DndContext>
      <SortableContext items={["column-0"]} strategy={verticalListSortingStrategy}>
        <MatrixColumnChoice {...finalProps} />
      </SortableContext>
    </DndContext>
  );
};

describe("MatrixColumnChoice", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders the column choice with drag handle and input", () => {
    renderWithDndContext();

    expect(screen.getByDisplayValue("Column 1")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  test("shows delete button when there are more than 2 columns", () => {
    renderWithDndContext();

    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  test("hides delete button when there are only 2 columns", () => {
    const questionWith2Columns = {
      ...mockQuestion,
      columns: [createI18nString("Column 1", ["en"]), createI18nString("Column 2", ["en"])],
    };

    renderWithDndContext({ question: questionWith2Columns });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  test("calls handleDeleteLabel when delete button is clicked", async () => {
    const user = userEvent.setup();
    const handleDeleteLabel = vi.fn();

    renderWithDndContext({ handleDeleteLabel });

    const deleteButton = screen.getByRole("button");
    await user.click(deleteButton);

    expect(handleDeleteLabel).toHaveBeenCalledWith("column", 0);
  });

  test("calls updateMatrixLabel when input value changes", async () => {
    const user = userEvent.setup();
    const updateMatrixLabel = vi.fn();

    renderWithDndContext({ updateMatrixLabel });

    const input = screen.getByDisplayValue("Column 1");
    await user.clear(input);
    await user.type(input, "Updated Column");

    expect(updateMatrixLabel).toHaveBeenCalled();
  });

  test("calls handleKeyDown when Enter key is pressed", async () => {
    const user = userEvent.setup();
    const handleKeyDown = vi.fn();

    renderWithDndContext({ handleKeyDown });

    const input = screen.getByDisplayValue("Column 1");
    await user.type(input, "{Enter}");

    expect(handleKeyDown).toHaveBeenCalled();
  });

  test("applies invalid styling when isInvalid is true", () => {
    renderWithDndContext({ isInvalid: true });

    const input = screen.getByDisplayValue("Column 1");
    expect(input).toHaveClass("border-red-300");
  });
});
