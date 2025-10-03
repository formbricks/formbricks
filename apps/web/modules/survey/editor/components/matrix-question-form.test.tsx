import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TLanguage } from "@formbricks/types/project";
import {
  TSurvey,
  TSurveyLanguage,
  TSurveyMatrixQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { MatrixQuestionForm } from "./matrix-question-form";

vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null],
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: null,
  }),
  verticalListSortingStrategy: () => {},
}));

// Keep QuestionFormInput simple and forward keydown
vi.mock("@/modules/survey/components/question-form-input", () => ({
  QuestionFormInput: ({ id, value, onKeyDown }: { id: string; value: any; onKeyDown?: any }) => (
    <input
      data-testid={`qfi-${id}`}
      value={value?.en || value?.de || value?.default || ""}
      onChange={() => {}}
      onKeyDown={onKeyDown}
    />
  ),
}));

describe("MatrixQuestionForm - handleKeyDown", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  const makeSurvey = (languages: Array<Pick<TSurveyLanguage, "language" | "default">>): TSurvey =>
    ({
      id: "s1",
      name: "Survey",
      type: "link",
      languages: languages as unknown as TSurveyLanguage[],
      questions: [] as any,
      endings: [] as any,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      environmentId: "env1",
    }) as unknown as TSurvey;

  const langDefault: TSurveyLanguage = {
    language: { code: "default" } as unknown as TLanguage,
    default: true,
  } as unknown as TSurveyLanguage;

  const baseQuestion = (): TSurveyMatrixQuestion => ({
    id: "q1",
    type: TSurveyQuestionTypeEnum.Matrix,
    headline: { default: "Matrix" },
    required: false,
    rows: [
      { id: "r1", label: { default: "Row 1" } },
      { id: "r2", label: { default: "" } },
    ],
    columns: [
      { id: "c1", label: { default: "Col 1" } },
      { id: "c2", label: { default: "" } },
    ],
    shuffleOption: "none",
  });

  test("Enter on last row adds a new row", async () => {
    const question = baseQuestion();
    const localSurvey = makeSurvey([langDefault]);
    (localSurvey as any).questions = [question];

    const updateQuestion = vi.fn();

    render(
      <MatrixQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={updateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={vi.fn()}
        locale="en-US"
        isStorageConfigured={true}
      />
    );

    const lastRowInput = screen.getByTestId("qfi-row-1");
    await userEvent.type(lastRowInput, "{enter}");

    expect(updateQuestion).toHaveBeenCalledTimes(1);
    const [, payload] = updateQuestion.mock.calls[0];
    expect(payload.rows.length).toBe(3);
    expect(payload.rows[2]).toEqual(
      expect.objectContaining({ id: expect.any(String), label: expect.objectContaining({ default: "" }) })
    );
  });

  test("Enter on non-last row focuses next row", async () => {
    const question = baseQuestion();
    const localSurvey = makeSurvey([langDefault]);
    (localSurvey as any).questions = [question];

    const updateQuestion = vi.fn();

    render(
      <MatrixQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={updateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={vi.fn()}
        locale="en-US"
        isStorageConfigured={true}
      />
    );

    const firstRowInput = screen.getByTestId("qfi-row-0");
    await userEvent.type(firstRowInput, "{enter}");

    expect(updateQuestion).not.toHaveBeenCalled();
  });

  test("Enter on last column adds a new column", async () => {
    const question = baseQuestion();
    const localSurvey = makeSurvey([langDefault]);
    (localSurvey as any).questions = [question];

    const updateQuestion = vi.fn();

    render(
      <MatrixQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={updateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={vi.fn()}
        locale="en-US"
        isStorageConfigured={true}
      />
    );

    const lastColInput = screen.getByTestId("qfi-column-1");
    await userEvent.type(lastColInput, "{enter}");

    expect(updateQuestion).toHaveBeenCalledTimes(1);
    const [, payload] = updateQuestion.mock.calls[0];
    expect(payload.columns.length).toBe(3);
    expect(payload.columns[2]).toEqual(
      expect.objectContaining({ id: expect.any(String), label: expect.objectContaining({ default: "" }) })
    );
  });

  test("Enter on non-last column focuses next column", async () => {
    const question = baseQuestion();
    const localSurvey = makeSurvey([langDefault]);
    (localSurvey as any).questions = [question];

    const updateQuestion = vi.fn();

    render(
      <MatrixQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={updateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={vi.fn()}
        locale="en-US"
        isStorageConfigured={true}
      />
    );

    const firstColInput = screen.getByTestId("qfi-column-0");
    await userEvent.type(firstColInput, "{enter}");

    expect(updateQuestion).not.toHaveBeenCalled();
  });

  test("Arrow Down on row focuses next row", async () => {
    const question = baseQuestion();
    const localSurvey = makeSurvey([langDefault]);
    (localSurvey as any).questions = [question];

    const updateQuestion = vi.fn();

    render(
      <MatrixQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={updateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={vi.fn()}
        locale="en-US"
        isStorageConfigured={true}
      />
    );

    const firstRowInput = screen.getByTestId("qfi-row-0");
    await userEvent.type(firstRowInput, "{arrowdown}");

    expect(updateQuestion).not.toHaveBeenCalled();
  });

  test("Arrow Up on row focuses previous row", async () => {
    const question = baseQuestion();
    const localSurvey = makeSurvey([langDefault]);
    (localSurvey as any).questions = [question];

    const updateQuestion = vi.fn();

    render(
      <MatrixQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={updateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={vi.fn()}
        locale="en-US"
        isStorageConfigured={true}
      />
    );

    const secondRowInput = screen.getByTestId("qfi-row-1");
    await userEvent.type(secondRowInput, "{arrowup}");

    expect(updateQuestion).not.toHaveBeenCalled();
  });
});
