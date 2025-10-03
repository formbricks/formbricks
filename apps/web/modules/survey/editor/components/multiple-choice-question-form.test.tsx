import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TLanguage } from "@formbricks/types/project";
import {
  TSurvey,
  TSurveyLanguage,
  TSurveyMultipleChoiceQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { MultipleChoiceQuestionForm } from "./multiple-choice-question-form";

vi.mock("@/modules/survey/components/question-form-input", () => ({
  QuestionFormInput: vi.fn((props) => (
    <input
      data-testid={`question-form-input-${props.id}`}
      value={props.value?.default || ""}
      onChange={() => {}}
    />
  )),
}));

vi.mock("@/modules/survey/editor/components/question-option-choice", () => ({
  QuestionOptionChoice: vi.fn(({ choice, addChoice, deleteChoice, choiceIdx }) => (
    <div data-testid={`question-option-choice-${choice.id}`}>
      <span data-testid={`choice-label-${choice.id}`}>{choice.label.default}</span>
      <button data-testid={`delete-choice-${choice.id}`} onClick={() => deleteChoice(choiceIdx)}>
        Delete
      </button>
      <button data-testid={`add-choice-${choice.id}`} onClick={() => addChoice(choiceIdx)}>
        Add Below
      </button>
    </div>
  )),
}));

vi.mock("@/modules/ui/components/shuffle-option-select", () => ({
  ShuffleOptionSelect: vi.fn(({ shuffleOption, updateQuestion, questionIdx }) => (
    <select
      data-testid="shuffle-option-select"
      value={shuffleOption || "none"}
      onChange={(e) => updateQuestion(questionIdx, { shuffleOption: e.target.value })}>
      <option value="none">Keep current order</option>
      <option value="all">Randomize all</option>
      <option value="exceptLast">Randomize all except last</option>
    </select>
  )),
}));

vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null],
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children, onDragEnd }: any) => (
    <div data-testid="dnd-context" data-ondragend={onDragEnd ? "true" : "false"}>
      {children}
    </div>
  ),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: any) => <>{children}</>,
  verticalListSortingStrategy: {},
}));

vi.mock("@/modules/survey/editor/lib/utils", () => ({
  findOptionUsedInLogic: vi.fn(() => -1),
}));

vi.mock("@paralleldrive/cuid2", () => ({
  createId: vi.fn(() => "test-id-" + Math.random().toString(36).substring(2, 9)),
}));

describe("MultipleChoiceQuestionForm", () => {
  const mockUpdateQuestion = vi.fn();
  const mockSetSelectedLanguageCode = vi.fn();

  const createMockSurvey = (): TSurvey =>
    ({
      id: "survey1",
      name: "Test Survey",
      type: "link",
      languages: [
        {
          language: { code: "default" } as unknown as TLanguage,
          default: true,
        } as unknown as TSurveyLanguage,
      ],
      questions: [],
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      environmentId: "env123",
    }) as unknown as TSurvey;

  const createMockQuestion = (overrides?: Partial<TSurveyMultipleChoiceQuestion>) => ({
    id: "q1",
    type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
    headline: { default: "Test Question" },
    choices: [
      { id: "c1", label: { default: "Choice 1" } },
      { id: "c2", label: { default: "Choice 2" } },
    ],
    shuffleOption: "none",
    required: false,
    ...overrides,
  });

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
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("should render the question headline input field with the correct label and value", () => {
    const question = createMockQuestion();
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const headlineInput = screen.getByTestId("question-form-input-headline");
    expect(headlineInput).toBeDefined();
    expect(headlineInput).toHaveValue("Test Question");
  });

  test("should render all choices", () => {
    const question = createMockQuestion();
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    expect(screen.getByTestId("question-option-choice-c1")).toBeDefined();
    expect(screen.getByTestId("question-option-choice-c2")).toBeDefined();
  });

  test("should render subheader when it exists", () => {
    const question = createMockQuestion({
      subheader: { default: "Test Description" },
    });
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const subheaderInput = screen.getByTestId("question-form-input-subheader");
    expect(subheaderInput).toBeDefined();
    expect(subheaderInput).toHaveValue("Test Description");
  });

  test("should show add description button when subheader is undefined", () => {
    const question = createMockQuestion();
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const addDescriptionButton = screen.getByText("environments.surveys.edit.add_description");
    expect(addDescriptionButton).toBeDefined();
  });

  test("should add subheader when add description button is clicked", async () => {
    const question = createMockQuestion();
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const addDescriptionButton = screen.getByText("environments.surveys.edit.add_description");
    await userEvent.click(addDescriptionButton);

    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      subheader: { default: "" },
    });
  });

  test("should show 'Add Other' button when 'other' choice is not present", () => {
    const question = createMockQuestion();
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const addOtherButton = screen.getByText("environments.surveys.edit.add_other");
    expect(addOtherButton).toBeDefined();
  });

  test("should not show 'Add Other' button when 'other' choice is present", () => {
    const question = createMockQuestion({
      choices: [
        { id: "c1", label: { default: "Choice 1" } },
        { id: "other", label: { default: "Other" } },
      ],
    });
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const addOtherButton = screen.queryByText("environments.surveys.edit.add_other");
    expect(addOtherButton).toBeNull();
  });

  test("should add 'other' choice when 'Add Other' button is clicked", async () => {
    const question = createMockQuestion();
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const addOtherButton = screen.getByText("environments.surveys.edit.add_other");
    await userEvent.click(addOtherButton);

    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      choices: [
        { id: "c1", label: { default: "Choice 1" } },
        { id: "c2", label: { default: "Choice 2" } },
        { id: "other", label: { default: "Other" } },
      ],
    });
  });

  test("should show 'Add None of the above' button when 'none' choice is not present", () => {
    const question = createMockQuestion();
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const addNoneButton = screen.getByText("environments.surveys.edit.add_none_of_the_above");
    expect(addNoneButton).toBeDefined();
  });

  test("should not show 'Add None of the above' button when 'none' choice is present", () => {
    const question = createMockQuestion({
      choices: [
        { id: "c1", label: { default: "Choice 1" } },
        { id: "none", label: { default: "None of the above" } },
      ],
    });
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const addNoneButton = screen.queryByText("environments.surveys.edit.add_none_of_the_above");
    expect(addNoneButton).toBeNull();
  });

  test("should add 'none' choice when 'Add None of the above' button is clicked", async () => {
    const question = createMockQuestion();
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const addNoneButton = screen.getByText("environments.surveys.edit.add_none_of_the_above");
    await userEvent.click(addNoneButton);

    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      choices: [
        { id: "c1", label: { default: "Choice 1" } },
        { id: "c2", label: { default: "Choice 2" } },
        { id: "none", label: { default: "None of the above" } },
      ],
    });
  });

  test("should convert from single to multi choice", async () => {
    const question = createMockQuestion({
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
    });
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const convertButton = screen.getByText("environments.surveys.edit.convert_to_multiple_choice");
    await userEvent.click(convertButton);

    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
    });
  });

  test("should convert from multi to single choice", async () => {
    const question = createMockQuestion({
      type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
    });
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const convertButton = screen.getByText("environments.surveys.edit.convert_to_single_choice");
    await userEvent.click(convertButton);

    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
    });
  });

  test("should render shuffle option select", () => {
    const question = createMockQuestion({
      shuffleOption: "none",
    });
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const shuffleSelect = screen.getByTestId("shuffle-option-select");
    expect(shuffleSelect).toBeDefined();
    expect(shuffleSelect).toHaveValue("none");
  });

  test("should change shuffleOption to 'exceptLast' when adding 'other' with 'all' shuffleOption", async () => {
    const question = createMockQuestion({
      shuffleOption: "all",
    });
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const addOtherButton = screen.getByText("environments.surveys.edit.add_other");
    await userEvent.click(addOtherButton);

    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      choices: expect.any(Array),
      shuffleOption: "exceptLast",
    });
  });

  test("should change shuffleOption to 'exceptLast' when adding 'none' with 'all' shuffleOption", async () => {
    const question = createMockQuestion({
      shuffleOption: "all",
    });
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const addNoneButton = screen.getByText("environments.surveys.edit.add_none_of_the_above");
    await userEvent.click(addNoneButton);

    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      choices: expect.any(Array),
      shuffleOption: "exceptLast",
    });
  });

  test("should maintain order with 'other' at the end when adding it", async () => {
    const question = createMockQuestion({
      choices: [
        { id: "c1", label: { default: "Choice 1" } },
        { id: "c2", label: { default: "Choice 2" } },
      ],
    });
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const addOtherButton = screen.getByText("environments.surveys.edit.add_other");
    await userEvent.click(addOtherButton);

    const updatedChoices = mockUpdateQuestion.mock.calls[0][1].choices;
    expect(updatedChoices[updatedChoices.length - 1].id).toBe("other");
  });

  test("should maintain order with 'none' at the end when adding it", async () => {
    const question = createMockQuestion({
      choices: [
        { id: "c1", label: { default: "Choice 1" } },
        { id: "c2", label: { default: "Choice 2" } },
      ],
    });
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const addNoneButton = screen.getByText("environments.surveys.edit.add_none_of_the_above");
    await userEvent.click(addNoneButton);

    const updatedChoices = mockUpdateQuestion.mock.calls[0][1].choices;
    expect(updatedChoices[updatedChoices.length - 1].id).toBe("none");
  });

  test("should maintain order with both 'other' and 'none' at the end", async () => {
    const question = createMockQuestion({
      choices: [
        { id: "c1", label: { default: "Choice 1" } },
        { id: "c2", label: { default: "Choice 2" } },
        { id: "other", label: { default: "Other" } },
      ],
    });
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const addNoneButton = screen.getByText("environments.surveys.edit.add_none_of_the_above");
    await userEvent.click(addNoneButton);

    const updatedChoices = mockUpdateQuestion.mock.calls[0][1].choices;
    expect(updatedChoices[updatedChoices.length - 2].id).toBe("other");
    expect(updatedChoices[updatedChoices.length - 1].id).toBe("none");
  });

  test("should not add 'other' if it already exists", async () => {
    const question = createMockQuestion({
      choices: [
        { id: "c1", label: { default: "Choice 1" } },
        { id: "other", label: { default: "Other" } },
      ],
    });
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const addOtherButton = screen.queryByText("environments.surveys.edit.add_other");
    expect(addOtherButton).toBeNull();
  });

  test("should not add 'none' if it already exists", async () => {
    const question = createMockQuestion({
      choices: [
        { id: "c1", label: { default: "Choice 1" } },
        { id: "none", label: { default: "None of the above" } },
      ],
    });
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const addNoneButton = screen.queryByText("environments.surveys.edit.add_none_of_the_above");
    expect(addNoneButton).toBeNull();
  });

  test("should handle deleting a choice", async () => {
    const question = createMockQuestion({
      choices: [
        { id: "c1", label: { default: "Choice 1" } },
        { id: "c2", label: { default: "Choice 2" } },
        { id: "c3", label: { default: "Choice 3" } },
      ],
    });
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const deleteButton = screen.getByTestId("delete-choice-c2");
    await userEvent.click(deleteButton);

    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      choices: [
        { id: "c1", label: { default: "Choice 1" } },
        { id: "c3", label: { default: "Choice 3" } },
      ],
    });
  });

  test("should show error toast when deleting a choice used in logic", async () => {
    const { findOptionUsedInLogic } = await import("@/modules/survey/editor/lib/utils");
    vi.mocked(findOptionUsedInLogic).mockReturnValueOnce(2);

    const question = createMockQuestion({
      choices: [
        { id: "c1", label: { default: "Choice 1" } },
        { id: "c2", label: { default: "Choice 2" } },
        { id: "c3", label: { default: "Choice 3" } },
      ],
    });
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const deleteButton = screen.getByTestId("delete-choice-c1");
    await userEvent.click(deleteButton);

    expect(toast.error).toHaveBeenCalled();
    expect(mockUpdateQuestion).not.toHaveBeenCalled();
  });

  test("should initialize new choices with empty strings for all configured survey languages", async () => {
    const question = createMockQuestion({
      choices: [
        { id: "c1", label: { default: "Choice 1", de: "Auswahl 1" } },
        { id: "c2", label: { default: "Choice 2", de: "Auswahl 2" } },
      ],
    });
    const localSurvey = {
      id: "survey1",
      name: "Test Survey",
      type: "link",
      languages: [
        {
          language: { code: "default" } as unknown as TLanguage,
          default: true,
        } as unknown as TSurveyLanguage,
        {
          language: { code: "de" } as unknown as TLanguage,
          default: false,
        } as unknown as TSurveyLanguage,
      ],
      questions: [],
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      environmentId: "env123",
    } as unknown as TSurvey;

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const addChoiceButton = screen.getByTestId("add-choice-c1");
    await userEvent.click(addChoiceButton);

    expect(mockUpdateQuestion).toHaveBeenCalled();
    const updatedChoices = mockUpdateQuestion.mock.calls[0][1].choices;
    const newChoice = updatedChoices[1];
    expect(newChoice.label).toEqual({ default: "", de: "" });
  });

  test("should render DndContext for drag and drop", () => {
    const question = createMockQuestion();
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const dndContext = screen.getByTestId("dnd-context");
    expect(dndContext).toBeDefined();
  });

  test("should handle adding choice at specific index", async () => {
    const question = createMockQuestion({
      choices: [
        { id: "c1", label: { default: "Choice 1" } },
        { id: "c2", label: { default: "Choice 2" } },
      ],
    });
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const addChoiceButton = screen.getByTestId("add-choice-c1");
    await userEvent.click(addChoiceButton);

    expect(mockUpdateQuestion).toHaveBeenCalled();
    const updatedChoices = mockUpdateQuestion.mock.calls[0][1].choices;
    expect(updatedChoices).toHaveLength(3);
    expect(updatedChoices[1].id).toMatch(/^test-id-/);
  });

  test("should add 'Other' with multi-language support", async () => {
    const question = createMockQuestion();
    const localSurvey = {
      id: "survey1",
      name: "Test Survey",
      type: "link",
      languages: [
        {
          language: { code: "default" } as unknown as TLanguage,
          default: true,
        } as unknown as TSurveyLanguage,
        {
          language: { code: "de" } as unknown as TLanguage,
          default: false,
        } as unknown as TSurveyLanguage,
      ],
      questions: [],
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      environmentId: "env123",
    } as unknown as TSurvey;

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const addOtherButton = screen.getByText("environments.surveys.edit.add_other");
    await userEvent.click(addOtherButton);

    const updatedChoices = mockUpdateQuestion.mock.calls[0][1].choices;
    const otherChoice = updatedChoices.find((c: any) => c.id === "other");
    expect(otherChoice.label).toHaveProperty("default");
    expect(otherChoice.label).toHaveProperty("de");
  });

  test("should add 'None' with multi-language support", async () => {
    const question = createMockQuestion();
    const localSurvey = {
      id: "survey1",
      name: "Test Survey",
      type: "link",
      languages: [
        {
          language: { code: "default" } as unknown as TLanguage,
          default: true,
        } as unknown as TSurveyLanguage,
        {
          language: { code: "de" } as unknown as TLanguage,
          default: false,
        } as unknown as TSurveyLanguage,
      ],
      questions: [],
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      environmentId: "env123",
    } as unknown as TSurvey;

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const addNoneButton = screen.getByText("environments.surveys.edit.add_none_of_the_above");
    await userEvent.click(addNoneButton);

    const updatedChoices = mockUpdateQuestion.mock.calls[0][1].choices;
    const noneChoice = updatedChoices.find((c: any) => c.id === "none");
    expect(noneChoice.label).toHaveProperty("default");
    expect(noneChoice.label).toHaveProperty("de");
  });

  test("should pass isInvalid prop to QuestionFormInput", () => {
    const question = createMockQuestion();
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={true}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    expect(screen.getByTestId("question-form-input-headline")).toBeDefined();
  });

  test("should pass isStorageConfigured prop to QuestionFormInput", () => {
    const question = createMockQuestion();
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={false}
      />
    );

    expect(screen.getByTestId("question-form-input-headline")).toBeDefined();
  });

  test("should handle empty choices array", () => {
    const question = createMockQuestion({
      choices: [],
    });
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    expect(screen.queryByTestId(/^question-option-choice-/)).toBeNull();
  });

  test("should delete 'other' choice without logic check", async () => {
    const question = createMockQuestion({
      choices: [
        { id: "c1", label: { default: "Choice 1" } },
        { id: "other", label: { default: "Other" } },
      ],
    });
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const deleteButton = screen.getByTestId("delete-choice-other");
    await userEvent.click(deleteButton);

    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      choices: [{ id: "c1", label: { default: "Choice 1" } }],
    });
  });

  test("should delete 'none' choice without logic check", async () => {
    const question = createMockQuestion({
      choices: [
        { id: "c1", label: { default: "Choice 1" } },
        { id: "none", label: { default: "None of the above" } },
      ],
    });
    const localSurvey = createMockSurvey();

    render(
      <MultipleChoiceQuestionForm
        localSurvey={localSurvey}
        question={question}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
        isInvalid={false}
        selectedLanguageCode="default"
        setSelectedLanguageCode={mockSetSelectedLanguageCode}
        locale="en-US"
        lastQuestion={false}
        isStorageConfigured={true}
      />
    );

    const deleteButton = screen.getByTestId("delete-choice-none");
    await userEvent.click(deleteButton);

    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      choices: [{ id: "c1", label: { default: "Choice 1" } }],
    });
  });
});
