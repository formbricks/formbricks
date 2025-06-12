import { checkForEmptyFallBackValue, extractIds } from "@/lib/utils/recall";
import { validateQuestion, validateSurveyQuestionsInBatch } from "@/modules/survey/editor/lib/validation";
import { DndContext } from "@dnd-kit/core";
import { createId } from "@paralleldrive/cuid2";
import { Language, Project } from "@prisma/client";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Mock, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TOrganizationBillingPlan } from "@formbricks/types/organizations";
import { TLanguage } from "@formbricks/types/project";
import {
  TSurvey,
  TSurveyLanguage,
  TSurveyQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { QuestionsView } from "./questions-view";

// Mock dependencies
vi.mock("@/app/lib/survey-builder", () => ({
  getDefaultEndingCard: vi.fn((_, t) => ({
    id: createId(),
    type: "endScreen",
    headline: { default: t("templates.thank_you") },
    subheader: { default: t("templates.thank_you_subtitle") },
    buttonLabel: { default: t("templates.create_another_response") },
    buttonLink: null,
    enabled: true,
  })),
}));

vi.mock("@/lib/i18n/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/i18n/utils")>();
  return {
    ...actual,
    addMultiLanguageLabels: vi.fn((question, languages) => ({
      ...question,
      headline: languages.reduce((acc, lang) => ({ ...acc, [lang]: "" }), { default: "" }),
    })),
    extractLanguageCodes: vi.fn((languages) => languages.map((l) => l.language.code)),
  };
});

vi.mock("@/lib/pollyfills/structuredClone", () => ({
  structuredClone: vi.fn((obj) => JSON.parse(JSON.stringify(obj))),
}));

vi.mock("@/lib/surveyLogic/utils", () => ({
  isConditionGroup: vi.fn(),
}));

vi.mock("@/lib/utils/recall", () => ({
  checkForEmptyFallBackValue: vi.fn(),
  extractRecallInfo: vi.fn(),
  extractIds: vi.fn(),
  removeRecallFromText: vi.fn(),
}));

vi.mock("@/modules/ee/multi-language-surveys/components/multi-language-card", () => ({
  MultiLanguageCard: vi.fn(() => <div>MultiLanguageCard</div>),
}));

vi.mock("@/modules/survey/editor/components/add-ending-card-button", () => ({
  AddEndingCardButton: vi.fn(({ addEndingCard }) => (
    <button onClick={() => addEndingCard(0)}>AddEndingCardButton</button>
  )),
}));

vi.mock("@/modules/survey/editor/components/add-question-button", () => ({
  AddQuestionButton: vi.fn(({ addQuestion }) => (
    <button
      onClick={() =>
        addQuestion({
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "New Question" },
          required: true,
        })
      }>
      AddQuestionButton
    </button>
  )),
}));

vi.mock("@/modules/survey/editor/components/edit-ending-card", () => ({
  EditEndingCard: vi.fn(({ endingCardIndex }) => <div>EditEndingCard {endingCardIndex}</div>),
}));

vi.mock("@/modules/survey/editor/components/edit-welcome-card", () => ({
  EditWelcomeCard: vi.fn(() => <div>EditWelcomeCard</div>),
}));

vi.mock("@/modules/survey/editor/components/hidden-fields-card", () => ({
  HiddenFieldsCard: vi.fn(() => <div>HiddenFieldsCard</div>),
}));

vi.mock("@/modules/survey/editor/components/questions-droppable", () => ({
  QuestionsDroppable: vi.fn(
    ({
      localSurvey,
      moveQuestion,
      updateQuestion,
      duplicateQuestion,
      deleteQuestion,
      addQuestion,
      activeQuestionId,
      setActiveQuestionId,
    }) => (
      <div>
        {localSurvey.questions.map((q, idx) => (
          <div key={q.id} data-testid={`question-card-${q.id}`}>
            QuestionCard {idx}
            <button onClick={() => moveQuestion(idx, true)}>Move Up</button>
            <button onClick={() => moveQuestion(idx, false)}>Move Down</button>
            <button onClick={() => updateQuestion(idx, { required: !q.required })}>Update</button>
            <button onClick={() => duplicateQuestion(idx)}>Duplicate</button>
            <button onClick={() => deleteQuestion(idx)}>Delete</button>
            <button
              onClick={() => addQuestion({ id: "newAdd", type: TSurveyQuestionTypeEnum.OpenText }, idx)}>
              Add Specific
            </button>
            <button onClick={() => setActiveQuestionId(q.id)}>Set Active</button>
            {activeQuestionId === q.id && <span>Active</span>}
          </div>
        ))}
      </div>
    )
  ),
}));

vi.mock("@/modules/survey/editor/components/survey-variables-card", () => ({
  SurveyVariablesCard: vi.fn(() => <div>SurveyVariablesCard</div>),
}));

vi.mock("@/modules/survey/editor/lib/utils", () => ({
  findQuestionUsedInLogic: vi.fn(() => -1),
}));

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    DndContext: vi.fn(({ children, onDragEnd, id }) => (
      <div data-testid={`dnd-context-${id}`}>
        {children}
        <button
          onClick={() => {
            if (onDragEnd) {
              onDragEnd({
                active: { id: "q1" },
                over: { id: "q2" },
              } as any);
            }
          }}>
          Simulate Drag End {id}
        </button>
      </div>
    )),
    useSensor: vi.fn(),
    useSensors: vi.fn(),
    closestCorners: vi.fn(),
  };
});

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: vi.fn(({ children }) => <div>{children}</div>),
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: vi.fn(() => [vi.fn()]),
}));

vi.mock("@paralleldrive/cuid2", () => ({
  createId: vi.fn(() => "test-id"),
}));

vi.mock("@formbricks/types/surveys/validation", () => ({
  findQuestionsWithCyclicLogic: vi.fn(() => []),
}));

vi.mock("../lib/validation", () => ({
  isEndingCardValid: vi.fn(() => true),
  isWelcomeCardValid: vi.fn(() => true),
  validateQuestion: vi.fn(() => true),
  // Updated mock: Accumulates invalid questions based on the condition
  validateSurveyQuestionsInBatch: vi.fn(
    (question, currentInvalidList, _surveyLanguages, _isFirstQuestion) => {
      const isInvalid = question.headline.default === "invalid";
      const questionExists = currentInvalidList.includes(question.id);

      if (isInvalid && !questionExists) {
        return [...currentInvalidList, question.id];
      } else if (!isInvalid && questionExists) {
        return currentInvalidList.filter((id) => id !== question.id);
      }
      return currentInvalidList;
    }
  ),
}));

const mockSurvey = {
  id: "survey1",
  name: "Test Survey",
  type: "app",
  environmentId: "env1",
  status: "draft",
  questions: [
    {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Q1" },
      required: true,
    } as unknown as TSurveyQuestion,
    {
      id: "q2",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Q2" },
      required: false,
    } as unknown as TSurveyQuestion,
  ],
  endings: [{ id: "end1", type: "endScreen", headline: { default: "End" } }],
  languages: [
    {
      language: { id: "lang1", code: "default" } as unknown as TLanguage,
      default: true,
    } as unknown as TSurveyLanguage,
  ],
  triggers: [],
  recontactDays: null,
  displayOption: "displayOnce",
  autoClose: null,
  delay: 0,
  autoComplete: null,
  styling: null,
  surveyClosedMessage: null,
  singleUse: null,
  pin: null,
  resultShareKey: null,
  displayPercentage: null,
  welcomeCard: { enabled: true, headline: { default: "Welcome" } } as unknown as TSurvey["welcomeCard"],
  variables: [],
  hiddenFields: { enabled: true, fieldIds: [] },
  createdAt: new Date(),
  updatedAt: new Date(),
  runOnDate: null,
  closeOnDate: null,
} as unknown as TSurvey;

const mockProject = {
  id: "proj1",
  name: "Test Project",
  createdAt: new Date(),
  updatedAt: new Date(),
  organizationId: "org1",
  styling: { allowStyleOverwrite: true },
  recontactDays: 1,
  inAppSurveyBranding: true,
  linkSurveyBranding: true,
  placement: "bottomRight",
  clickOutsideClose: true,
  darkOverlay: false,
} as unknown as Project;

const mockProjectLanguages: Language[] = [{ id: "lang1", code: "default" } as unknown as Language];

describe("QuestionsView", () => {
  let localSurvey: TSurvey;
  let setLocalSurvey: Mock;
  let setActiveQuestionId: Mock;
  let setInvalidQuestions: Mock;
  let setSelectedLanguageCode: Mock;
  let setIsCautionDialogOpen: Mock;

  beforeEach(() => {
    localSurvey = structuredClone(mockSurvey);
    setLocalSurvey = vi.fn((update) => {
      if (typeof update === "function") {
        localSurvey = update(localSurvey);
      } else {
        localSurvey = update;
      }
    });
    setActiveQuestionId = vi.fn();
    setInvalidQuestions = vi.fn();
    setSelectedLanguageCode = vi.fn();
    setIsCautionDialogOpen = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <QuestionsView
        localSurvey={localSurvey}
        setLocalSurvey={setLocalSurvey}
        activeQuestionId={null}
        setActiveQuestionId={setActiveQuestionId}
        project={mockProject}
        projectLanguages={mockProjectLanguages}
        invalidQuestions={[]}
        setInvalidQuestions={setInvalidQuestions}
        selectedLanguageCode="default"
        setSelectedLanguageCode={setSelectedLanguageCode}
        isMultiLanguageAllowed={true}
        isFormbricksCloud={true}
        plan={"free" as TOrganizationBillingPlan}
        isCxMode={false}
        locale={"en" as TUserLocale}
        responseCount={0}
        setIsCautionDialogOpen={setIsCautionDialogOpen}
        {...props}
      />
    );
  };

  test("renders correctly with initial data", () => {
    renderComponent();
    expect(screen.getByText("EditWelcomeCard")).toBeInTheDocument();
    expect(screen.getByTestId("question-card-q1")).toBeInTheDocument();
    expect(screen.getByTestId("question-card-q2")).toBeInTheDocument();
    expect(screen.getByText("AddQuestionButton")).toBeInTheDocument();
    expect(screen.getByText("EditEndingCard 0")).toBeInTheDocument();
    expect(screen.getByText("AddEndingCardButton")).toBeInTheDocument();
    expect(screen.getByText("HiddenFieldsCard")).toBeInTheDocument();
    expect(screen.getByText("SurveyVariablesCard")).toBeInTheDocument();
    expect(screen.getByText("MultiLanguageCard")).toBeInTheDocument();
  });

  test("renders correctly in CX mode", () => {
    renderComponent({ isCxMode: true });
    expect(screen.queryByText("EditWelcomeCard")).not.toBeInTheDocument();
    expect(screen.queryByText("AddEndingCardButton")).not.toBeInTheDocument();
    expect(screen.queryByText("HiddenFieldsCard")).not.toBeInTheDocument();
    expect(screen.queryByText("SurveyVariablesCard")).not.toBeInTheDocument();
    expect(screen.queryByText("MultiLanguageCard")).not.toBeInTheDocument();
    expect(screen.getByTestId("question-card-q1")).toBeInTheDocument();
    expect(screen.getByTestId("question-card-q2")).toBeInTheDocument();
    expect(screen.getByText("AddQuestionButton")).toBeInTheDocument();
    expect(screen.getByText("EditEndingCard 0")).toBeInTheDocument(); // Endings still show in CX
  });

  test("adds a question", async () => {
    renderComponent();
    const addButton = screen.getByText("AddQuestionButton");
    await userEvent.click(addButton);
    expect(setLocalSurvey).toHaveBeenCalledTimes(1);
    const updatedSurvey = setLocalSurvey.mock.calls[0][0];
    expect(updatedSurvey.questions.length).toBe(3);
    expect(updatedSurvey.questions[2].headline.default).toBe(""); // Due to addMultiLanguageLabels mock
    expect(setActiveQuestionId).toHaveBeenCalledWith("test-id");
  });

  test("adds a question at a specific index", async () => {
    renderComponent();
    const addSpecificButton = screen.getAllByText("Add Specific")[0];
    await userEvent.click(addSpecificButton);
    expect(setLocalSurvey).toHaveBeenCalledTimes(1);
    const updatedSurvey = setLocalSurvey.mock.calls[0][0];
    expect(updatedSurvey.questions.length).toBe(3);
    expect(updatedSurvey.questions[0].id).toBe("newAdd");
    expect(setActiveQuestionId).toHaveBeenCalledWith("newAdd");
  });

  test("deletes a question", async () => {
    renderComponent();
    const deleteButton = screen.getAllByText("Delete")[0];
    await userEvent.click(deleteButton);
    expect(setLocalSurvey).toHaveBeenCalledTimes(1);
    const updatedSurvey = setLocalSurvey.mock.calls[0][0];
    expect(updatedSurvey.questions.length).toBe(1);
    expect(updatedSurvey.questions[0].id).toBe("q2");
    expect(setActiveQuestionId).toHaveBeenCalledWith("q2"); // Falls back to next question
  });

  test("duplicates a question", async () => {
    renderComponent();
    const duplicateButton = screen.getAllByText("Duplicate")[0];
    await userEvent.click(duplicateButton);
    expect(setLocalSurvey).toHaveBeenCalledTimes(1);
    const updatedSurvey = setLocalSurvey.mock.calls[0][0];
    expect(updatedSurvey.questions.length).toBe(3);
    expect(updatedSurvey.questions[1].id).toBe("test-id"); // New duplicated ID
    expect(updatedSurvey.questions[1].headline.default).toBe("Q1");
    expect(setActiveQuestionId).toHaveBeenCalledWith("test-id");
  });

  test("updates a question", async () => {
    renderComponent();
    const updateButton = screen.getAllByText("Update")[0];
    await userEvent.click(updateButton);
    expect(setLocalSurvey).toHaveBeenCalledTimes(1);
    const updatedSurvey = setLocalSurvey.mock.calls[0][0];
    expect(updatedSurvey.questions[0].required).toBe(false);
    expect(vi.mocked(validateQuestion)).toHaveBeenCalled();
  });

  test("moves a question up", async () => {
    renderComponent();
    const moveUpButton = screen.getAllByText("Move Up")[1]; // Move q2 up
    await userEvent.click(moveUpButton);
    expect(setLocalSurvey).toHaveBeenCalledTimes(1);
    const updatedSurvey = setLocalSurvey.mock.calls[0][0];
    expect(updatedSurvey.questions[0].id).toBe("q2");
    expect(updatedSurvey.questions[1].id).toBe("q1");
  });

  test("moves a question down", async () => {
    renderComponent();
    const moveDownButton = screen.getAllByText("Move Down")[0]; // Move q1 down
    await userEvent.click(moveDownButton);
    expect(setLocalSurvey).toHaveBeenCalledTimes(1);
    const updatedSurvey = setLocalSurvey.mock.calls[0][0];
    expect(updatedSurvey.questions[0].id).toBe("q2");
    expect(updatedSurvey.questions[1].id).toBe("q1");
  });

  test("adds an ending card", async () => {
    renderComponent();
    const addEndingButton = screen.getByText("AddEndingCardButton");
    await userEvent.click(addEndingButton);
    expect(setLocalSurvey).toHaveBeenCalledTimes(1);
    const updatedSurvey = setLocalSurvey.mock.calls[0][0];
    expect(updatedSurvey.endings.length).toBe(2);
    expect(updatedSurvey.endings[0].id).toBe("test-id"); // New ending ID
    expect(setActiveQuestionId).toHaveBeenCalledWith("test-id");
  });

  test("handles question card drag end", async () => {
    vi.mocked(extractIds).mockReturnValue([]);
    renderComponent();
    const dragButton = screen.getByText("Simulate Drag End questions");
    await userEvent.click(dragButton);
    // setLocalSurvey is called first to save questions with reprocessed recalls
    // and then to save questions in reordered state.
    expect(setLocalSurvey).toHaveBeenCalledTimes(2);
    const updatedSurvey = setLocalSurvey.mock.calls[1][0];
    // Based on the hardcoded IDs in the mock DndContext
    expect(updatedSurvey.questions[0].id).toBe("q2");
    expect(updatedSurvey.questions[1].id).toBe("q1");
  });

  test("handles ending card drag end", async () => {
    // Add a second ending card for the test
    localSurvey.endings.push({ id: "end2", type: "endScreen", headline: { default: "End 2" } });
    vi.mocked(DndContext).mockImplementation(({ children, onDragEnd, id }) => (
      <div>
        {children}
        <button
          onClick={() => {
            if (onDragEnd) {
              onDragEnd({
                active: { id: "end1" },
                over: { id: "end2" },
              } as any);
            }
          }}>
          Simulate Drag End {id}
        </button>
      </div>
    ));

    renderComponent();
    const dragButton = screen.getByText("Simulate Drag End endings");
    await userEvent.click(dragButton);
    expect(setLocalSurvey).toHaveBeenCalledTimes(1);
    const updatedSurvey = setLocalSurvey.mock.calls[0][0];
    expect(updatedSurvey.endings[0].id).toBe("end2");
    expect(updatedSurvey.endings[1].id).toBe("end1");
  });

  test("calls validation useEffect on mount and updates", () => {
    const invalidQuestionsProp = ["q-invalid"]; // Prop passed initially
    renderComponent({ invalidQuestions: invalidQuestionsProp });

    // Initial validation check on mount
    expect(vi.mocked(validateSurveyQuestionsInBatch)).toHaveBeenCalledTimes(2); // Called for q1, q2

    // In the first render:
    // - validateSurveyQuestionsInBatch is called with initial invalidQuestionsProp = ["q-invalid"]
    // - For q1 (headline "Q1"): returns ["q-invalid"] (no change)
    // - For q2 (headline "Q2"): returns ["q-invalid"] (no change)
    // - The final calculated list inside the effect is ["q-invalid"]
    // - Comparison: JSON.stringify(["q-invalid"]) !== JSON.stringify(["q-invalid"]) is false
    expect(setInvalidQuestions).not.toHaveBeenCalled();

    // Simulate adding a new question and re-rendering
    const newSurvey = {
      ...localSurvey,
      questions: [
        ...localSurvey.questions,
        {
          id: "q3",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "Q3" },
        } as unknown as TSurveyQuestion,
      ],
    };
    cleanup();

    vi.mocked(validateSurveyQuestionsInBatch).mockClear();
    vi.mocked(setInvalidQuestions).mockClear();

    // Render again with the new survey but the same initial prop
    renderComponent({ localSurvey: newSurvey, invalidQuestions: invalidQuestionsProp });

    expect(vi.mocked(validateSurveyQuestionsInBatch)).toHaveBeenCalledTimes(3); // Called for q1, q2, q3

    // In the second render:
    // - validateSurveyQuestionsInBatch is called with initial invalidQuestionsProp = ["q-invalid"]
    // - For q1 (headline "Q1"): returns ["q-invalid"]
    // - For q2 (headline "Q2"): returns ["q-invalid"]
    // - For q3 (headline "Q3"): returns ["q-invalid"]
    // - The final calculated list inside the effect is ["q-invalid"]
    // - Comparison: JSON.stringify(["q-invalid"]) !== JSON.stringify(["q-invalid"]) is false
    // The previous assertion was incorrect. Let's adjust the test slightly to force a change.

    // Let's modify the scenario slightly: Assume the initial prop was [], but validation finds an issue.
    cleanup();
    vi.mocked(validateSurveyQuestionsInBatch).mockClear();
    vi.mocked(setInvalidQuestions).mockClear();

    // Add an "invalid" question to the survey for the test
    const surveyWithInvalidQ = {
      ...localSurvey,
      questions: [
        ...localSurvey.questions,
        {
          id: "q-invalid-real",
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "invalid" },
        } as unknown as TSurveyQuestion,
      ],
    };

    renderComponent({ localSurvey: surveyWithInvalidQ, invalidQuestions: [] }); // Start with empty invalid prop

    expect(vi.mocked(validateSurveyQuestionsInBatch)).toHaveBeenCalledTimes(3); // q1, q2, q-invalid-real

    // In this render:
    // - Initial prop is []
    // - For q1: returns []
    // - For q2: returns []
    // - For q-invalid-real: returns ["q-invalid-real"]
    // - Final calculated list is ["q-invalid-real"]
    // - Comparison: JSON.stringify(["q-invalid-real"]) !== JSON.stringify([]) is true
    expect(setInvalidQuestions).toHaveBeenCalledTimes(1);
    expect(setInvalidQuestions).toHaveBeenCalledWith(["q-invalid-real"]);
  });

  test("calls fallback check useEffect on mount and updates", () => {
    renderComponent();
    expect(vi.mocked(checkForEmptyFallBackValue)).toHaveBeenCalledTimes(1);

    // Simulate activeQuestionId change
    cleanup();
    renderComponent({ activeQuestionId: "q1" });
    expect(vi.mocked(checkForEmptyFallBackValue)).toHaveBeenCalledTimes(2);
  });

  test("sets active question id", async () => {
    renderComponent();
    const setActiveButton = screen.getAllByText("Set Active")[0];
    await userEvent.click(setActiveButton);
    expect(setActiveQuestionId).toHaveBeenCalledWith("q1");
  });
});
