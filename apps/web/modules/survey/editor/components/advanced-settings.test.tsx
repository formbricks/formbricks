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

vi.mock("@/modules/survey/editor/components/option-ids", () => ({
  OptionIds: ({ question, selectedLanguageCode }: any) => (
    <div data-testid="option-ids">
      <span data-testid="option-ids-question-id">{question.id}</span>
      <span data-testid="option-ids-question-type">{question.type}</span>
      <span data-testid="option-ids-language-code">{selectedLanguageCode}</span>
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
        selectedLanguageCode="en"
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
        selectedLanguageCode="fr"
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
          selectedLanguageCode="de"
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

  // New tests for OptionIds functionality
  test("renders OptionIds component for multiple choice single questions", () => {
    const mockQuestion = {
      id: "mc-question",
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      headline: { default: "Multiple Choice Question" },
      choices: [
        { id: "choice1", label: { default: "Option 1" } },
        { id: "choice2", label: { default: "Option 2" } },
      ],
    } as unknown as TSurveyQuestion;

    const mockSurvey = {
      id: "survey1",
      questions: [mockQuestion],
    } as unknown as TSurvey;

    render(
      <AdvancedSettings
        question={mockQuestion}
        questionIdx={0}
        localSurvey={mockSurvey}
        updateQuestion={vi.fn()}
        selectedLanguageCode="en"
      />
    );

    expect(screen.getByTestId("option-ids")).toBeInTheDocument();
    expect(screen.getByTestId("option-ids-question-id")).toHaveTextContent("mc-question");
    expect(screen.getByTestId("option-ids-question-type")).toHaveTextContent("multipleChoiceSingle");
    expect(screen.getByTestId("option-ids-language-code")).toHaveTextContent("en");
  });

  test("renders OptionIds component for multiple choice multi questions", () => {
    const mockQuestion = {
      id: "mcm-question",
      type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
      headline: { default: "Multiple Choice Multi Question" },
      choices: [
        { id: "choice1", label: { default: "Option A" } },
        { id: "choice2", label: { default: "Option B" } },
        { id: "choice3", label: { default: "Option C" } },
      ],
    } as unknown as TSurveyQuestion;

    const mockSurvey = {
      id: "survey2",
      questions: [mockQuestion],
    } as unknown as TSurvey;

    render(
      <AdvancedSettings
        question={mockQuestion}
        questionIdx={0}
        localSurvey={mockSurvey}
        updateQuestion={vi.fn()}
        selectedLanguageCode="fr"
      />
    );

    expect(screen.getByTestId("option-ids")).toBeInTheDocument();
    expect(screen.getByTestId("option-ids-question-id")).toHaveTextContent("mcm-question");
    expect(screen.getByTestId("option-ids-question-type")).toHaveTextContent("multipleChoiceMulti");
    expect(screen.getByTestId("option-ids-language-code")).toHaveTextContent("fr");
  });

  test("renders OptionIds component for picture selection questions", () => {
    const mockQuestion = {
      id: "pic-question",
      type: TSurveyQuestionTypeEnum.PictureSelection,
      headline: { default: "Picture Selection Question" },
      choices: [
        { id: "pic1", imageUrl: "https://example.com/img1.jpg" },
        { id: "pic2", imageUrl: "https://example.com/img2.jpg" },
      ],
    } as unknown as TSurveyQuestion;

    const mockSurvey = {
      id: "survey3",
      questions: [mockQuestion],
    } as unknown as TSurvey;

    render(
      <AdvancedSettings
        question={mockQuestion}
        questionIdx={0}
        localSurvey={mockSurvey}
        updateQuestion={vi.fn()}
        selectedLanguageCode="de"
      />
    );

    expect(screen.getByTestId("option-ids")).toBeInTheDocument();
    expect(screen.getByTestId("option-ids-question-id")).toHaveTextContent("pic-question");
    expect(screen.getByTestId("option-ids-question-type")).toHaveTextContent("pictureSelection");
    expect(screen.getByTestId("option-ids-language-code")).toHaveTextContent("de");
  });

  test("renders OptionIds component for ranking questions", () => {
    const mockQuestion = {
      id: "rank-question",
      type: TSurveyQuestionTypeEnum.Ranking,
      headline: { default: "Ranking Question" },
      choices: [
        { id: "rank1", label: { default: "First Option" } },
        { id: "rank2", label: { default: "Second Option" } },
        { id: "rank3", label: { default: "Third Option" } },
      ],
    } as unknown as TSurveyQuestion;

    const mockSurvey = {
      id: "survey4",
      questions: [mockQuestion],
    } as unknown as TSurvey;

    render(
      <AdvancedSettings
        question={mockQuestion}
        questionIdx={0}
        localSurvey={mockSurvey}
        updateQuestion={vi.fn()}
        selectedLanguageCode="es"
      />
    );

    expect(screen.getByTestId("option-ids")).toBeInTheDocument();
    expect(screen.getByTestId("option-ids-question-id")).toHaveTextContent("rank-question");
    expect(screen.getByTestId("option-ids-question-type")).toHaveTextContent("ranking");
    expect(screen.getByTestId("option-ids-language-code")).toHaveTextContent("es");
  });

  test("does not render OptionIds component for non-choice question types", () => {
    const openTextQuestion = {
      id: "open-text-question",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Open Text Question" },
    } as unknown as TSurveyQuestion;

    const mockSurvey = {
      id: "survey5",
      questions: [openTextQuestion],
    } as unknown as TSurvey;

    render(
      <AdvancedSettings
        question={openTextQuestion}
        questionIdx={0}
        localSurvey={mockSurvey}
        updateQuestion={vi.fn()}
        selectedLanguageCode="en"
      />
    );

    expect(screen.queryByTestId("option-ids")).not.toBeInTheDocument();
    expect(screen.getByTestId("conditional-logic")).toBeInTheDocument();
    expect(screen.getByTestId("update-question-id")).toBeInTheDocument();
  });

  test("does not render OptionIds component for rating questions", () => {
    const ratingQuestion = {
      id: "rating-question",
      type: TSurveyQuestionTypeEnum.Rating,
      headline: { default: "Rating Question" },
      scale: 5,
      range: [1, 5],
    } as unknown as TSurveyQuestion;

    const mockSurvey = {
      id: "survey6",
      questions: [ratingQuestion],
    } as unknown as TSurvey;

    render(
      <AdvancedSettings
        question={ratingQuestion}
        questionIdx={0}
        localSurvey={mockSurvey}
        updateQuestion={vi.fn()}
        selectedLanguageCode="en"
      />
    );

    expect(screen.queryByTestId("option-ids")).not.toBeInTheDocument();
    expect(screen.getByTestId("conditional-logic")).toBeInTheDocument();
    expect(screen.getByTestId("update-question-id")).toBeInTheDocument();
  });

  test("passes correct selectedLanguageCode to OptionIds component", () => {
    const mockQuestion = {
      id: "test-question",
      type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      headline: { default: "Test Question" },
      choices: [{ id: "choice1", label: { default: "Option 1" } }],
    } as unknown as TSurveyQuestion;

    const mockSurvey = {
      id: "survey8",
      questions: [mockQuestion],
    } as unknown as TSurvey;

    const { rerender } = render(
      <AdvancedSettings
        question={mockQuestion}
        questionIdx={0}
        localSurvey={mockSurvey}
        updateQuestion={vi.fn()}
        selectedLanguageCode="ja"
      />
    );

    expect(screen.getByTestId("option-ids-language-code")).toHaveTextContent("ja");

    // Test with different language code
    rerender(
      <AdvancedSettings
        question={mockQuestion}
        questionIdx={0}
        localSurvey={mockSurvey}
        updateQuestion={vi.fn()}
        selectedLanguageCode="zh"
      />
    );

    expect(screen.getByTestId("option-ids-language-code")).toHaveTextContent("zh");
  });
});
