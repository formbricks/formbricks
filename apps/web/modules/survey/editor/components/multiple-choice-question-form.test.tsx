import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurveyMultipleChoiceQuestion } from "@formbricks/types/surveys/types";
import { MultipleChoiceQuestionForm } from "./multiple-choice-question-form";

vi.mock("@/modules/survey/components/question-form-input", () => ({
  QuestionFormInput: vi.fn((props) => (
    <input data-testid="question-form-input" value={props.value?.default} onChange={() => {}} />
  )),
}));

vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null],
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }) => <>{children}</>,
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }) => <>{children}</>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: null,
  }),
  verticalListSortingStrategy: () => {},
}));

describe("MultipleChoiceQuestionForm", () => {
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

  test("should render the question headline input field with the correct label and value", () => {
    const question = {
      id: "1",
      type: "multipleChoiceSingle",
      headline: { default: "Test Headline" },
      choices: [],
    } as unknown as TSurveyMultipleChoiceQuestion;
    const localSurvey = {
      id: "survey1",
      languages: [{ language: { code: "default" }, default: true }],
    } as any;

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={vi.fn()}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={vi.fn()}
        locale="en-US"
        lastQuestion={false}
      />
    );

    const questionFormInput = screen.getByTestId("question-form-input");
    expect(questionFormInput).toBeDefined();
    expect(questionFormInput).toHaveValue("Test Headline");
  });
});
