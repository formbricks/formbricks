import { QuestionsDroppable } from "@/modules/survey/editor/components/questions-droppable";
import { Project } from "@prisma/client";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

// Mock the QuestionCard component
vi.mock("@/modules/survey/editor/components/question-card", () => ({
  QuestionCard: vi.fn(({ isInvalid }) => (
    <div data-testid={isInvalid !== undefined ? `question-card-${isInvalid}` : "question-card"}></div>
  )),
}));

// Mock window.matchMedia
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
      dispatchEvent: vi.fn(),
    })),
  });

  vi.mock("@formkit/auto-animate/react", () => ({
    useAutoAnimate: () => [null],
  }));
});

// Mock SortableContext for testing strategy
vi.mock("@dnd-kit/sortable", async () => {
  const actual = await vi.importActual("@dnd-kit/sortable");
  return {
    ...actual,
    SortableContext: vi.fn(({ children, strategy }) => {
      const strategyName =
        strategy === actual.verticalListSortingStrategy ? "verticalListSortingStrategy" : "other";
      return (
        <div data-testid="sortable-context" data-strategy={strategyName}>
          {children}
        </div>
      );
    }),
  };
});

describe("QuestionsDroppable", () => {
  afterEach(() => {
    cleanup();
  });

  test("should render a QuestionCard for each question in localSurvey.questions", () => {
    const mockQuestions: TSurveyQuestion[] = [
      {
        id: "q1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Question 1" },
      } as any,
      {
        id: "q2",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        headline: { default: "Question 2" },
      } as any,
      {
        id: "q3",
        type: TSurveyQuestionTypeEnum.Rating,
        headline: { default: "Question 3" },
      } as any,
    ];

    const mockLocalSurvey: TSurvey = {
      id: "survey1",
      name: "Test Survey",
      type: "link",
      environmentId: "env123",
      status: "draft",
      questions: mockQuestions,
      endings: [],
      languages: [],
      triggers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      welcomeCard: { enabled: false } as any,
      styling: {},
      variables: [],
    } as any;

    const mockProject: Project = {
      id: "project1",
      name: "Test Project",
    } as any;

    render(
      <QuestionsDroppable
        localSurvey={mockLocalSurvey}
        project={mockProject}
        moveQuestion={vi.fn()}
        updateQuestion={vi.fn()}
        deleteQuestion={vi.fn()}
        duplicateQuestion={vi.fn()}
        activeQuestionId={null}
        setActiveQuestionId={vi.fn()}
        selectedLanguageCode="en"
        setSelectedLanguageCode={vi.fn()}
        invalidQuestions={null}
        addQuestion={vi.fn()}
        isFormbricksCloud={false}
        isCxMode={false}
        locale="en-US"
        responseCount={0}
        onAlertTrigger={vi.fn()}
      />
    );

    // Since we're using SortableContext mock, we need to check for question-card-false
    // as the default when invalidQuestions is null
    const questionCards = screen.getAllByTestId("question-card-false");
    expect(questionCards.length).toBe(mockQuestions.length);
  });

  test("should use verticalListSortingStrategy in SortableContext", () => {
    const mockQuestions: TSurveyQuestion[] = [
      {
        id: "q1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Question 1" },
      } as any,
      {
        id: "q2",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        headline: { default: "Question 2" },
      } as any,
      {
        id: "q3",
        type: TSurveyQuestionTypeEnum.Rating,
        headline: { default: "Question 3" },
      } as any,
    ];

    const mockLocalSurvey: TSurvey = {
      id: "survey1",
      name: "Test Survey",
      type: "link",
      environmentId: "env123",
      status: "draft",
      questions: mockQuestions,
      endings: [],
      languages: [],
      triggers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      welcomeCard: { enabled: false } as any,
      styling: {},
      variables: [],
    } as any;

    const mockProject: Project = {
      id: "project1",
      name: "Test Project",
    } as any;

    render(
      <QuestionsDroppable
        localSurvey={mockLocalSurvey}
        project={mockProject}
        moveQuestion={vi.fn()}
        updateQuestion={vi.fn()}
        deleteQuestion={vi.fn()}
        duplicateQuestion={vi.fn()}
        activeQuestionId={null}
        setActiveQuestionId={vi.fn()}
        selectedLanguageCode="en"
        setSelectedLanguageCode={vi.fn()}
        invalidQuestions={null}
        addQuestion={vi.fn()}
        isFormbricksCloud={false}
        isCxMode={false}
        locale="en-US"
        responseCount={0}
        onAlertTrigger={vi.fn()}
      />
    );

    const sortableContext = screen.getByTestId("sortable-context");
    expect(sortableContext).toHaveAttribute("data-strategy", "verticalListSortingStrategy");
  });

  test("should pass the isInvalid prop to each QuestionCard based on the invalidQuestions array", () => {
    const mockQuestions: TSurveyQuestion[] = [
      {
        id: "q1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Question 1" },
      } as any,
      {
        id: "q2",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        headline: { default: "Question 2" },
      } as any,
      {
        id: "q3",
        type: TSurveyQuestionTypeEnum.Rating,
        headline: { default: "Question 3" },
      } as any,
    ];

    const mockLocalSurvey: TSurvey = {
      id: "survey1",
      name: "Test Survey",
      type: "link",
      environmentId: "env123",
      status: "draft",
      questions: mockQuestions,
      endings: [],
      languages: [],
      triggers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      welcomeCard: { enabled: false } as any,
      styling: {},
      variables: [],
    } as any;

    const mockProject: Project = {
      id: "project1",
      name: "Test Project",
    } as any;

    const invalidQuestions = ["q1", "q3"];

    render(
      <QuestionsDroppable
        localSurvey={mockLocalSurvey}
        project={mockProject}
        moveQuestion={vi.fn()}
        updateQuestion={vi.fn()}
        deleteQuestion={vi.fn()}
        duplicateQuestion={vi.fn()}
        activeQuestionId={null}
        setActiveQuestionId={vi.fn()}
        selectedLanguageCode="en"
        setSelectedLanguageCode={vi.fn()}
        invalidQuestions={invalidQuestions}
        addQuestion={vi.fn()}
        isFormbricksCloud={false}
        isCxMode={false}
        locale="en-US"
        responseCount={0}
        onAlertTrigger={vi.fn()}
      />
    );

    expect(screen.getAllByTestId("question-card-true")).toHaveLength(2);
    expect(screen.getAllByTestId("question-card-false")).toHaveLength(1);
  });

  test("should handle null invalidQuestions without errors", () => {
    const mockQuestions: TSurveyQuestion[] = [
      {
        id: "q1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Question 1" },
      } as any,
    ];

    const mockLocalSurvey: TSurvey = {
      id: "survey1",
      name: "Test Survey",
      type: "link",
      environmentId: "env123",
      status: "draft",
      questions: mockQuestions,
      endings: [],
      languages: [],
      triggers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      welcomeCard: { enabled: false } as any,
      styling: {},
      variables: [],
    } as any;

    const mockProject: Project = {
      id: "project1",
      name: "Test Project",
    } as any;

    render(
      <QuestionsDroppable
        localSurvey={mockLocalSurvey}
        project={mockProject}
        moveQuestion={vi.fn()}
        updateQuestion={vi.fn()}
        deleteQuestion={vi.fn()}
        duplicateQuestion={vi.fn()}
        activeQuestionId={null}
        setActiveQuestionId={vi.fn()}
        selectedLanguageCode="en"
        setSelectedLanguageCode={vi.fn()}
        invalidQuestions={null}
        addQuestion={vi.fn()}
        isFormbricksCloud={false}
        isCxMode={false}
        locale="en-US"
        responseCount={0}
        onAlertTrigger={vi.fn()}
      />
    );

    // With our updated mock, we should look for question-card-false when invalidQuestions is null
    const questionCard = screen.getByTestId("question-card-false");
    expect(questionCard).toBeInTheDocument();
  });

  test("should render without errors when activeQuestionId is null", () => {
    const mockQuestions: TSurveyQuestion[] = [
      {
        id: "q1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Question 1" },
      } as any,
    ];

    const mockLocalSurvey: TSurvey = {
      id: "survey1",
      name: "Test Survey",
      type: "link",
      environmentId: "env123",
      status: "draft",
      questions: mockQuestions,
      endings: [],
      languages: [],
      triggers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      welcomeCard: { enabled: false } as any,
      styling: {},
      variables: [],
    } as any;

    const mockProject: Project = {
      id: "project1",
      name: "Test Project",
    } as any;

    render(
      <QuestionsDroppable
        localSurvey={mockLocalSurvey}
        project={mockProject}
        moveQuestion={vi.fn()}
        updateQuestion={vi.fn()}
        deleteQuestion={vi.fn()}
        duplicateQuestion={vi.fn()}
        activeQuestionId={null}
        setActiveQuestionId={vi.fn()}
        selectedLanguageCode="en"
        setSelectedLanguageCode={vi.fn()}
        invalidQuestions={null}
        addQuestion={vi.fn()}
        isFormbricksCloud={false}
        isCxMode={false}
        locale="en-US"
        responseCount={0}
        onAlertTrigger={vi.fn()}
      />
    );

    // With our updated mock, we should look for question-card-false when invalidQuestions is null
    const questionCards = screen.getAllByTestId("question-card-false");
    expect(questionCards.length).toBe(mockQuestions.length);
  });
});
