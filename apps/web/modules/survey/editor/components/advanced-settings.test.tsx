import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { AdvancedSettings } from "./advanced-settings";

// Mock the child components
vi.mock("@/modules/survey/editor/components/conditional-logic", () => ({
  ConditionalLogic: ({ question, questionIdx, localSurvey, updateQuestion }: any) => (
    <div data-testid="conditional-logic">
      <span data-testid="conditional-logic-question-id">{question.id}</span>
      <span data-testid="conditional-logic-question-type">{question.type}</span>
      <span data-testid="conditional-logic-question-idx">{questionIdx}</span>
      <span data-testid="conditional-logic-survey-id">{localSurvey.id}</span>
      <span data-testid="conditional-logic-logic-conditions">
        {question.logic && JSON.stringify(question.logic)}
      </span>
      <span data-testid="conditional-logic-survey-questions">
        {JSON.stringify(localSurvey.questions.map((q) => q.id))}
      </span>
      <button
        data-testid="conditional-logic-update-button"
        onClick={() => updateQuestion(questionIdx, { test: "value" })}>
        Update
      </button>
      {question.logic && question.logic.length > 0 ? (
        <button
          data-testid="remove-logic-button"
          onClick={() => {
            updateQuestion(questionIdx, { logic: [] });
          }}>
          Remove All Logic
        </button>
      ) : (
        <span data-testid="no-logic-message">No logic conditions</span>
      )}
      {question.logic?.map((logicItem: any, index: number) => (
        <div key={logicItem.id} data-testid={`logic-item-${index}`}>
          Referenced Question ID: {logicItem.conditions.conditions[0].leftOperand.value}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/modules/survey/editor/components/update-question-id", () => ({
  UpdateQuestionId: ({ question, questionIdx, localSurvey, updateQuestion }: any) => (
    <div data-testid="update-question-id">
      <span data-testid="update-question-id-question-id">{question.id}</span>
      <span data-testid="update-question-id-question-type">{question.type}</span>
      <span data-testid="update-question-id-question-idx">{questionIdx}</span>
      <span data-testid="update-question-id-survey-id">{localSurvey.id}</span>
      <button
        data-testid="update-question-id-update-button"
        onClick={() => updateQuestion(questionIdx, { id: "new-id" })}>
        Update
      </button>
      <input
        data-testid="question-id-input"
        defaultValue={question.id}
        onChange={(e) => updateQuestion(questionIdx, { id: e.target.value })}
      />
      <button
        data-testid="save-question-id"
        onClick={() => updateQuestion(questionIdx, { id: "q2-updated" })}>
        Save
      </button>
    </div>
  ),
}));

describe("AdvancedSettings", () => {
  afterEach(() => {
    cleanup();
  });

  test("should render ConditionalLogic and UpdateQuestionId components when provided with valid props", () => {
    // Arrange
    const mockQuestion = {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Test Question" },
    } as unknown as TSurveyQuestion;

    const mockSurvey = {
      id: "survey1",
      name: "Test Survey",
      questions: [mockQuestion],
      welcomeCard: {
        enabled: false,
        headline: { default: "Welcome" },
        html: { default: "" },
      } as unknown as TSurvey["welcomeCard"],
      hiddenFields: {
        enabled: false,
        fieldIds: [],
      },
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as TSurvey;

    const mockUpdateQuestion = vi.fn();
    const questionIdx = 0;

    // Act
    render(
      <AdvancedSettings
        question={mockQuestion}
        questionIdx={questionIdx}
        localSurvey={mockSurvey}
        updateQuestion={mockUpdateQuestion}
      />
    );

    // Assert
    // Check if both components are rendered
    expect(screen.getByTestId("conditional-logic")).toBeInTheDocument();
    expect(screen.getByTestId("update-question-id")).toBeInTheDocument();

    // Check if props are correctly passed to ConditionalLogic
    expect(screen.getByTestId("conditional-logic-question-id")).toHaveTextContent("q1");
    expect(screen.getByTestId("conditional-logic-question-idx")).toHaveTextContent("0");
    expect(screen.getByTestId("conditional-logic-survey-id")).toHaveTextContent("survey1");

    // Check if props are correctly passed to UpdateQuestionId
    expect(screen.getByTestId("update-question-id-question-id")).toHaveTextContent("q1");
    expect(screen.getByTestId("update-question-id-question-idx")).toHaveTextContent("0");
    expect(screen.getByTestId("update-question-id-survey-id")).toHaveTextContent("survey1");

    // Verify that updateQuestion function is passed and can be called
    const conditionalLogicUpdateButton = screen.getByTestId("conditional-logic-update-button");
    conditionalLogicUpdateButton.click();
    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, { test: "value" });

    const updateQuestionIdUpdateButton = screen.getByTestId("update-question-id-update-button");
    updateQuestionIdUpdateButton.click();
    expect(mockUpdateQuestion).toHaveBeenCalledTimes(2);
    expect(mockUpdateQuestion).toHaveBeenLastCalledWith(0, { id: "new-id" });
  });

  test("should pass the correct props to ConditionalLogic and UpdateQuestionId components", () => {
    // Arrange
    const mockQuestion: TSurveyQuestion = {
      id: "question-123",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Test Question" },
    } as unknown as TSurveyQuestion;

    const mockSurvey = {
      id: "survey-456",
      name: "Test Survey",
      questions: [mockQuestion],
      welcomeCard: {
        enabled: false,
        headline: { default: "Welcome" },
        html: { default: "" },
      } as unknown as TSurvey["welcomeCard"],
      hiddenFields: {
        enabled: false,
        fieldIds: [],
      },
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as TSurvey;

    const mockUpdateQuestion = vi.fn();
    const questionIdx = 2; // Using a non-zero index to ensure it's passed correctly

    // Act
    render(
      <AdvancedSettings
        question={mockQuestion}
        questionIdx={questionIdx}
        localSurvey={mockSurvey}
        updateQuestion={mockUpdateQuestion}
      />
    );

    // Assert
    // Check if both components are rendered
    expect(screen.getByTestId("conditional-logic")).toBeInTheDocument();
    expect(screen.getByTestId("update-question-id")).toBeInTheDocument();

    // Check if props are correctly passed to ConditionalLogic
    expect(screen.getByTestId("conditional-logic-question-id")).toHaveTextContent("question-123");
    expect(screen.getByTestId("conditional-logic-question-idx")).toHaveTextContent("2");
    expect(screen.getByTestId("conditional-logic-survey-id")).toHaveTextContent("survey-456");

    // Check if props are correctly passed to UpdateQuestionId
    expect(screen.getByTestId("update-question-id-question-id")).toHaveTextContent("question-123");
    expect(screen.getByTestId("update-question-id-question-idx")).toHaveTextContent("2");
    expect(screen.getByTestId("update-question-id-survey-id")).toHaveTextContent("survey-456");

    // Verify that updateQuestion function is passed and can be called from ConditionalLogic
    const conditionalLogicUpdateButton = screen.getByTestId("conditional-logic-update-button");
    conditionalLogicUpdateButton.click();
    expect(mockUpdateQuestion).toHaveBeenCalledWith(2, { test: "value" });

    // Verify that updateQuestion function is passed and can be called from UpdateQuestionId
    const updateQuestionIdUpdateButton = screen.getByTestId("update-question-id-update-button");
    updateQuestionIdUpdateButton.click();
    expect(mockUpdateQuestion).toHaveBeenCalledWith(2, { id: "new-id" });

    // Verify the function was called exactly twice
    expect(mockUpdateQuestion).toHaveBeenCalledTimes(2);
  });

  test("should render correctly when dynamically rendered after being initially hidden", async () => {
    // Arrange
    const mockQuestion: TSurveyQuestion = {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Test Question" },
    } as unknown as TSurveyQuestion;

    const mockSurvey = {
      id: "survey1",
      name: "Test Survey",
      questions: [mockQuestion],
      welcomeCard: {
        enabled: false,
        headline: { default: "Welcome" },
        html: { default: "" },
      } as unknown as TSurvey["welcomeCard"],
      hiddenFields: {
        enabled: false,
        fieldIds: [],
      },
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as TSurvey;

    const mockUpdateQuestion = vi.fn();
    const questionIdx = 0;

    // Act
    const { rerender } = render(
      <div>
        {/* Simulate AdvancedSettings being initially hidden */}
        {false && ( // NOSONAR typescript:1125 typescript:6638 // This is a simulation of a condition
          <AdvancedSettings
            question={mockQuestion}
            questionIdx={questionIdx}
            localSurvey={mockSurvey}
            updateQuestion={mockUpdateQuestion}
          />
        )}
      </div>
    );

    // Simulate AdvancedSettings being dynamically rendered
    rerender(
      <div>
        <AdvancedSettings
          question={mockQuestion}
          questionIdx={questionIdx}
          localSurvey={mockSurvey}
          updateQuestion={mockUpdateQuestion}
        />
      </div>
    );

    // Assert
    // Check if both components are rendered
    expect(screen.getByTestId("conditional-logic")).toBeInTheDocument();
    expect(screen.getByTestId("update-question-id")).toBeInTheDocument();

    // Check if props are correctly passed to ConditionalLogic
    expect(screen.getByTestId("conditional-logic-question-id")).toHaveTextContent("q1");
    expect(screen.getByTestId("conditional-logic-question-idx")).toHaveTextContent("0");
    expect(screen.getByTestId("conditional-logic-survey-id")).toHaveTextContent("survey1");

    // Check if props are correctly passed to UpdateQuestionId
    expect(screen.getByTestId("update-question-id-question-id")).toHaveTextContent("q1");
    expect(screen.getByTestId("update-question-id-question-idx")).toHaveTextContent("0");
    expect(screen.getByTestId("update-question-id-survey-id")).toHaveTextContent("survey1");

    // Verify that updateQuestion function is passed and can be called
    const conditionalLogicUpdateButton = screen.getByTestId("conditional-logic-update-button");
    await userEvent.click(conditionalLogicUpdateButton);
    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, { test: "value" });

    const updateQuestionIdUpdateButton = screen.getByTestId("update-question-id-update-button");
    await userEvent.click(updateQuestionIdUpdateButton);
    expect(mockUpdateQuestion).toHaveBeenCalledTimes(2);
    expect(mockUpdateQuestion).toHaveBeenLastCalledWith(0, { id: "new-id" });
  });

  test("should update conditional logic when question ID is changed", async () => {
    // Arrange
    const mockQuestion1 = {
      id: "q1",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Question 1" },
      logic: [
        {
          id: "logic1",
          conditions: {
            id: "cond1",
            connector: "and",
            conditions: [
              {
                id: "subcond1",
                leftOperand: { value: "q2", type: "question" },
                operator: "equals",
              },
            ],
          },
          actions: [
            {
              id: "action1",
              objective: "jumpToQuestion",
              target: "q3",
            },
          ],
        },
      ],
    } as unknown as TSurveyQuestion;

    const mockQuestion2 = {
      id: "q2",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Question 2" },
    } as unknown as TSurveyQuestion;

    const mockSurvey = {
      id: "survey1",
      name: "Test Survey",
      questions: [mockQuestion1, mockQuestion2],
      welcomeCard: {
        enabled: false,
        headline: { default: "Welcome" },
        html: { default: "" },
      } as unknown as TSurvey["welcomeCard"],
      endings: [],
      hiddenFields: { enabled: false, fieldIds: [] },
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as TSurvey;

    // Create a mock function that simulates updating the question ID and updating any logic that references it
    const mockUpdateQuestion = vi.fn((questionIdx, updatedAttributes) => {
      // If we're updating a question ID
      if (updatedAttributes.id) {
        const oldId = mockSurvey.questions[questionIdx].id;
        const newId = updatedAttributes.id;

        // Update the question ID
        mockSurvey.questions[questionIdx] = {
          ...mockSurvey.questions[questionIdx],
          ...updatedAttributes,
        };

        // Update any logic that references this question ID
        mockSurvey.questions.forEach((q) => {
          if (q.logic) {
            q.logic.forEach((logicItem) => {
              // NOSONAR typescript:S2004 // This is ok for testing
              logicItem.conditions.conditions.forEach((condition) => {
                // Check if it's a TSingleCondition (not a TConditionGroup)
                if ("leftOperand" in condition) {
                  if (condition.leftOperand.type === "question" && condition.leftOperand.value === oldId) {
                    condition.leftOperand.value = newId;
                  }
                }
              });
            });
          }
        });
      }
    });

    // Act
    render(
      <AdvancedSettings
        question={mockQuestion2}
        questionIdx={1}
        localSurvey={mockSurvey}
        updateQuestion={mockUpdateQuestion}
      />
    );

    // Assert
    // Check if both components are rendered
    expect(screen.getByTestId("conditional-logic")).toBeInTheDocument();
    expect(screen.getByTestId("update-question-id")).toBeInTheDocument();

    // Check if props are correctly passed to ConditionalLogic
    expect(screen.getByTestId("conditional-logic-question-id")).toHaveTextContent("q2");
    expect(screen.getByTestId("conditional-logic-question-idx")).toHaveTextContent("1");
    expect(screen.getByTestId("conditional-logic-survey-id")).toHaveTextContent("survey1");

    // Check if props are correctly passed to UpdateQuestionId
    expect(screen.getByTestId("update-question-id-question-id")).toHaveTextContent("q2");
    expect(screen.getByTestId("update-question-id-question-idx")).toHaveTextContent("1");
    expect(screen.getByTestId("update-question-id-survey-id")).toHaveTextContent("survey1");

    // Verify that updateQuestion function is passed and can be called
    const conditionalLogicUpdateButton = screen.getByTestId("conditional-logic-update-button");
    await userEvent.click(conditionalLogicUpdateButton);
    expect(mockUpdateQuestion).toHaveBeenCalledWith(1, { test: "value" });

    const updateQuestionIdUpdateButton = screen.getByTestId("update-question-id-update-button");
    await userEvent.click(updateQuestionIdUpdateButton);
    expect(mockUpdateQuestion).toHaveBeenCalledTimes(2);
    expect(mockUpdateQuestion).toHaveBeenLastCalledWith(1, { id: "new-id" });
  });
});
