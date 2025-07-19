import * as recallUtils from "@/lib/utils/recall";
import { cleanup } from "@testing-library/react";
import { TFnType } from "@tolgee/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  TSingleCondition,
  TSurvey,
  TSurveyLogicAction,
  TSurveyLogicActions,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import {
  MAX_STRING_LENGTH,
  extractParts,
  findEndingCardUsedInLogic,
  findHiddenFieldUsedInLogic,
  findOptionUsedInLogic,
  findQuestionUsedInLogic,
  findVariableUsedInLogic,
  getActionObjectiveOptions,
  getActionOperatorOptions,
  getActionTargetOptions,
  getActionValueOptions,
  getActionVariableOptions,
  getConditionOperatorOptions,
  getConditionValueOptions,
  getDefaultOperatorForQuestion,
  getMatchValueProps,
  getSurveyFollowUpActionDefaultBody,
  hasJumpToQuestionAction,
  replaceEndingCardHeadlineRecall,
} from "./utils";

// Mock required modules
vi.mock("@/lib/i18n/utils", () => ({
  getLocalizedValue: vi.fn((obj, lang) => obj?.[lang] || "Localized Text"),
}));

vi.mock("@/lib/utils/recall", () => ({
  recallToHeadline: vi.fn((headline) => headline || {}),
}));

vi.mock("@/lib/surveyLogic/utils", () => ({
  isConditionGroup: vi.fn((condition) => condition && "conditions" in condition),
}));

vi.mock("@/modules/survey/lib/questions", () => ({
  getQuestionTypes: vi.fn(() => [
    { id: TSurveyQuestionTypeEnum.OpenText, label: "Open Text", icon: "OpenTextIcon" },
    { id: TSurveyQuestionTypeEnum.Rating, label: "Rating", icon: "RatingIcon" },
    {
      id: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
      label: "Multiple Choice",
      icon: "MultipleChoiceSingleIcon",
    },
    {
      id: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
      label: "Multiple Choice Multi",
      icon: "MultipleChoiceMultiIcon",
    },
    {
      id: TSurveyQuestionTypeEnum.PictureSelection,
      label: "Picture Selection",
      icon: "PictureSelectionIcon",
    },
    { id: TSurveyQuestionTypeEnum.Date, label: "Date", icon: "DateIcon" },
    { id: TSurveyQuestionTypeEnum.NPS, label: "NPS", icon: "NPSIcon" },
    { id: TSurveyQuestionTypeEnum.CTA, label: "CTA", icon: "CTAIcon" },
    { id: TSurveyQuestionTypeEnum.Consent, label: "Consent", icon: "ConsentIcon" },
    { id: TSurveyQuestionTypeEnum.Matrix, label: "Matrix", icon: "MatrixIcon" },
  ]),
}));

// More proper mocking for JSX elements
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    // Mock the JSX.Element type
    JSX: {
      Element: {},
    },
  };
});

// Create a complete mock for getLogicRules with the exact structure needed
vi.mock("./logic-rule-engine", () => {
  return {
    getLogicRules: vi.fn(() => ({
      question: {
        openText: {
          options: [
            { label: "is", value: "equals" },
            { label: "is not", value: "doesNotEqual" },
          ],
        },
        "openText.text": {
          options: [
            { label: "is", value: "equals" },
            { label: "is not", value: "doesNotEqual" },
          ],
        },
        "openText.number": {
          options: [
            { label: "equals", value: "equals" },
            { label: "does not equal", value: "doesNotEqual" },
          ],
        },
        rating: {
          options: [
            { label: "equals", value: "equals" },
            { label: "does not equal", value: "doesNotEqual" },
          ],
        },
        multipleChoiceSingle: {
          options: [
            { label: "is", value: "equals" },
            { label: "is not", value: "doesNotEqual" },
          ],
        },
        multipleChoiceMulti: {
          options: [
            { label: "includes", value: "includesAll" },
            { label: "excludes", value: "excludesAll" },
          ],
        },
        nps: {
          options: [
            { label: "equals", value: "equals" },
            { label: "does not equal", value: "doesNotEqual" },
          ],
        },
        ctaQuestion: {
          options: [
            { label: "clicked", value: "isClicked" },
            { label: "is skipped", value: "isSkipped" },
          ],
        },
        pictureSelection: {
          options: [
            { label: "includes", value: "includesAll" },
            { label: "excludes", value: "excludesAll" },
          ],
        },
        consent: {
          options: [
            { label: "accepted", value: "isAccepted" },
            { label: "skipped", value: "isSkipped" },
          ],
        },
        date: {
          options: [
            { label: "is", value: "equals" },
            { label: "is before", value: "lessThan" },
          ],
        },
        matrix: {
          options: [
            { label: "is complete", value: "isCompletelySubmitted" },
            { label: "is partial", value: "isPartiallySubmitted" },
          ],
        },
        "matrix.row": {
          options: [
            { label: "selected", value: "selected" },
            { label: "not selected", value: "notSelected" },
          ],
        },
      },
      "variable.text": {
        options: [
          { label: "is", value: "equals" },
          { label: "is not", value: "doesNotEqual" },
        ],
      },
      "variable.number": {
        options: [
          { label: "equals", value: "equals" },
          { label: "does not equal", value: "doesNotEqual" },
        ],
      },
      hiddenField: {
        options: [
          { label: "is", value: "equals" },
          { label: "is not", value: "doesNotEqual" },
        ],
      },
    })),
  };
});

// Mock the implementations of extractParts and formatTextWithSlashes for testing
const mockExtractParts = vi.fn((text) => {
  if (text === "This is a /highlighted/ text with /multiple/ highlights") {
    return ["This is a ", "highlighted", " text with ", "multiple", " highlights"];
  } else if (text === "This has /highlighted/ text") {
    return ["This has ", "highlighted", " text"];
  } else if (text === "This is plain text") {
    return ["This is plain text"];
  } else if (text.length > MAX_STRING_LENGTH) {
    return [text];
  } else if (text === "") {
    return [""];
  } else if (text === "This has an /unclosed slash") {
    return ["This has an /unclosed slash"];
  }
  return [text];
});

const mockFormatTextWithSlashes = vi.fn((text, prefix = "", classNames = ["text-xs"]) => {
  const parts = mockExtractParts(text);
  return parts.map((part, index) => {
    if (index % 2 !== 0) {
      return {
        type: "span",
        key: index,
        props: {
          className: `mx-1 rounded-md bg-slate-100 p-1 px-2 ${classNames.join(" ")}`,
          children: prefix ? [prefix, part] : part,
        },
      };
    } else {
      return part;
    }
  });
});

// Mock translation function
const mockT: TFnType = (key) => key as string;

// Create mock survey data
const createMockSurvey = (): TSurvey =>
  ({
    id: "survey123",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Test Survey",
    status: "draft",
    environmentId: "env123",
    type: "app",
    welcomeCard: {
      enabled: true,
      timeToFinish: false,
      headline: { default: "Welcome" },
      buttonLabel: { default: "Start" },
      showResponseCount: false,
    },
    autoClose: null,
    closeOnDate: null,
    delay: 0,
    displayOption: "displayOnce",
    recontactDays: null,
    displayLimit: null,
    runOnDate: null,
    questions: [
      {
        id: "question1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Open Text Question" },
        subheader: { default: "" },
        required: false,
        inputType: "text",
        placeholder: { default: "Enter text" },
        longAnswer: false,
        logic: [],
        charLimit: {
          enabled: false,
        },
      },
      {
        id: "question2",
        type: TSurveyQuestionTypeEnum.Rating,
        headline: { default: "Rating Question" },
        subheader: { default: "" },
        required: true,
        range: 5,
        scale: "number",
        logic: [],
        isColorCodingEnabled: false,
      },
      {
        id: "question3",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        headline: { default: "Multiple Choice Question" },
        subheader: { default: "" },
        required: false,
        choices: [
          { id: "choice1", label: { default: "Choice 1" } },
          { id: "choice2", label: { default: "Choice 2" } },
        ],
        shuffleOption: "none",
        logic: [],
      },
      {
        id: "question4",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Open Text Question (Number)" },
        subheader: { default: "" },
        required: false,
        inputType: "number",
        placeholder: { default: "Enter number" },
        longAnswer: false,
        logic: [],
        charLimit: {
          enabled: false,
        },
      },
      {
        id: "question5",
        type: TSurveyQuestionTypeEnum.Date,
        headline: { default: "Date Question" },
        subheader: { default: "" },
        required: false,
        logic: [],
        format: "M-d-y",
      },
      {
        id: "question6",
        type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
        headline: { default: "Multiple Choice Multi Question" },
        subheader: { default: "" },
        required: false,
        choices: [
          { id: "choice1", label: { default: "Choice 1" } },
          { id: "choice2", label: { default: "Choice 2" } },
        ],
        shuffleOption: "none",
        logic: [],
      },
      {
        id: "question7",
        type: TSurveyQuestionTypeEnum.NPS,
        headline: { default: "NPS Question" },
        subheader: { default: "" },
        required: false,
        lowerLabel: { default: "Not likely" },
        upperLabel: { default: "Very likely" },
        logic: [],
        isColorCodingEnabled: false,
      },
      {
        id: "question8",
        type: TSurveyQuestionTypeEnum.CTA,
        headline: { default: "CTA Question" },
        subheader: { default: "" },
        required: false,
        buttonLabel: { default: "Click me" },
        buttonUrl: "https://example.com",
        buttonExternal: true,
        logic: [],
      },
      {
        id: "question9",
        type: TSurveyQuestionTypeEnum.PictureSelection,
        headline: { default: "Picture Selection" },
        subheader: { default: "" },
        required: false,
        allowMulti: false,
        choices: [
          { id: "pic1", imageUrl: "https://example.com/pic1.jpg" },
          { id: "pic2", imageUrl: "https://example.com/pic2.jpg" },
        ],
        logic: [],
      },
      {
        id: "question10",
        type: TSurveyQuestionTypeEnum.Matrix,
        headline: { default: "Matrix Question" },
        subheader: { default: "" },
        required: false,
        rows: [
          { id: "row1", label: { default: "Row 1" } },
          { id: "row2", label: { default: "Row 2" } },
        ],
        columns: [
          { id: "col1", label: { default: "Column 1" } },
          { id: "col2", label: { default: "Column 2" } },
        ],
        logic: [],
        shuffleOption: "none",
      },
    ],
    endings: [
      {
        id: "ending1",
        type: "endScreen",
        headline: { default: "End Screen" },
        subheader: { default: "Thank you for completing the survey" },
      },
      {
        id: "ending2",
        type: "redirectToUrl",
        label: "Redirect to website",
        url: "https://example.com",
      },
    ],
    hiddenFields: {
      enabled: true,
      fieldIds: ["field1", "field2"],
    },
    variables: [
      {
        id: "var1",
        name: "textVar",
        type: "text",
        value: "default text",
      },
      {
        id: "var2",
        name: "numberVar",
        type: "number",
        value: 42,
      },
    ],
  }) as unknown as TSurvey;

// Mock condition
const createMockCondition = (leftOperandType: string): TSingleCondition => ({
  id: "condition1",
  leftOperand: {
    type: leftOperandType as "question" | "variable" | "hiddenField",
    value: leftOperandType === "question" ? "question1" : leftOperandType === "variable" ? "var1" : "field1",
  },
  operator: "equals",
  rightOperand: {
    type: "static",
    value: "test",
  },
});

describe("Survey Editor Utils", () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("extractParts", () => {
    test("returns the original text if no slashes are found", () => {
      const text = "This is a simple text without slashes";
      const result = extractParts(text);
      expect(result).toEqual([text]);
    });

    test("handles unclosed slashes properly", () => {
      const text = "This has an /unclosed slash";
      const result = extractParts(text);
      expect(result).toEqual([text]);
    });

    test("returns the entire text if it exceeds MAX_STRING_LENGTH", () => {
      const longText = "a".repeat(MAX_STRING_LENGTH + 1);
      const result = extractParts(longText);
      expect(result).toEqual([longText]);
    });

    test("handles empty text", () => {
      const result = extractParts("");
      expect(result).toEqual([""]);
    });
  });

  describe("getConditionValueOptions", () => {
    test("returns grouped options with questions, variables and hidden fields", () => {
      const survey = createMockSurvey();
      const result = getConditionValueOptions(survey, 2, mockT);

      expect(result).toHaveLength(3); // questions, variables, hidden fields

      // Check question options
      expect(result[0].label).toBe("common.questions");
      expect(result[0].options.length).toBeGreaterThan(0);

      // Check variable options
      expect(result[1].label).toBe("common.variables");
      expect(result[1].options).toHaveLength(2); // two variables in mock survey

      // Check hidden fields options
      expect(result[2].label).toBe("common.hidden_fields");
      expect(result[2].options).toHaveLength(2); // two hidden fields in mock survey
    });

    test("handles matrix questions properly", () => {
      const survey = createMockSurvey();
      const result = getConditionValueOptions(survey, 9, mockT);

      // Find matrix question options
      const matrixOptions = result[0].options.filter(
        (option) => typeof option.value === "string" && option.value.startsWith("question10")
      );

      // Should have 1 main option for the matrix and 2 additional options for rows
      expect(matrixOptions.length).toBeGreaterThan(1);

      // Verify that the matrix rows are properly included
      const rowOptions = matrixOptions.filter((option) => option.meta?.rowIdx !== undefined);
      expect(rowOptions.length).toBe(2); // Two rows in our mock matrix question
    });

    test("filters questions correctly based on the current question index", () => {
      const survey = createMockSurvey();
      // Check with different current question indexes
      const result1 = getConditionValueOptions(survey, 0, mockT);
      const result9 = getConditionValueOptions(survey, 9, mockT);

      // First question should only have itself
      expect(result1[0].options.length).toBe(1);

      // Last question should have all questions
      expect(result9[0].options.length).toBeGreaterThan(result1[0].options.length);
    });
  });

  describe("replaceEndingCardHeadlineRecall", () => {
    test("replaces ending card headlines with recalled values", () => {
      const survey = createMockSurvey();
      const recallToHeadlineSpy = vi.spyOn(recallUtils, "recallToHeadline");

      replaceEndingCardHeadlineRecall(survey, "en");

      // Should call recallToHeadline for the ending with type 'endScreen'
      expect(recallToHeadlineSpy).toHaveBeenCalledTimes(1);
      expect(recallToHeadlineSpy).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), false, "en");
    });

    test("returns a new survey object without modifying the original", () => {
      const survey = createMockSurvey();
      if (survey.endings[0].type !== "endScreen") return;
      const originalEndingHeadline = survey.endings[0].headline;

      const newSurvey = replaceEndingCardHeadlineRecall(survey, "en");

      expect(newSurvey).not.toBe(survey); // Should be a new object (cloned)
      expect(survey.endings[0].headline).toBe(originalEndingHeadline); // Original should not change
    });
  });

  describe("getActionObjectiveOptions", () => {
    test("returns the correct action objective options", () => {
      const options = getActionObjectiveOptions(mockT);

      expect(options).toHaveLength(3);
      expect(options[0].value).toBe("calculate");
      expect(options[1].value).toBe("requireAnswer");
      expect(options[2].value).toBe("jumpToQuestion");
    });
  });

  describe("hasJumpToQuestionAction", () => {
    test("returns true if actions contain jumpToQuestion objective", () => {
      const actions: TSurveyLogicActions = [
        {
          id: "action1",
          objective: "calculate",
          variableId: "var1",
          operator: "add",
          value: { type: "static", value: 1 },
        },
        { id: "action2", objective: "jumpToQuestion", target: "question2" },
      ];

      expect(hasJumpToQuestionAction(actions)).toBe(true);
    });

    test("returns false if actions do not contain jumpToQuestion objective", () => {
      const actions: TSurveyLogicActions = [
        {
          id: "action1",
          objective: "calculate",
          variableId: "var1",
          operator: "add",
          value: { type: "static", value: 1 },
        },
        { id: "action2", objective: "requireAnswer", target: "question2" },
      ];

      expect(hasJumpToQuestionAction(actions)).toBe(false);
    });

    test("returns false for empty actions array", () => {
      expect(hasJumpToQuestionAction([])).toBe(false);
    });
  });

  describe("getDefaultOperatorForQuestion", () => {
    test("returns the first operator for the question type", () => {
      const survey = createMockSurvey();
      const openTextQuestion = survey.questions[0];
      const ratingQuestion = survey.questions[1];

      expect(getDefaultOperatorForQuestion(openTextQuestion, mockT)).toBe("equals");
      expect(getDefaultOperatorForQuestion(ratingQuestion, mockT)).toBe("equals");
    });
  });

  describe("getConditionOperatorOptions", () => {
    test("returns operator options for question condition", () => {
      const survey = createMockSurvey();
      const condition = createMockCondition("question");

      const result = getConditionOperatorOptions(condition, survey, mockT);

      expect(result.length).toBeGreaterThan(0);
    });

    test("returns operator options for variable condition", () => {
      const survey = createMockSurvey();
      const condition = createMockCondition("variable");

      const result = getConditionOperatorOptions(condition, survey, mockT);

      expect(result.length).toBeGreaterThan(0);
    });

    test("returns operator options for hidden field condition", () => {
      const survey = createMockSurvey();
      const condition = createMockCondition("hiddenField");

      const result = getConditionOperatorOptions(condition, survey, mockT);

      expect(result.length).toBeGreaterThan(0);
    });

    test("returns empty array if question not found", () => {
      const survey = createMockSurvey();
      const condition: TSingleCondition = {
        id: "condition1",
        leftOperand: {
          type: "question",
          value: "nonexistentQuestion",
        },
        operator: "equals",
        rightOperand: {
          type: "static",
          value: "test",
        },
      };

      const result = getConditionOperatorOptions(condition, survey, mockT);

      expect(result).toEqual([]);
    });

    test("handles matrix question special case", () => {
      const survey = createMockSurvey();
      const condition: TSingleCondition = {
        id: "condition1",
        leftOperand: {
          type: "question",
          value: "question10",
          meta: { row: "0" },
        },
        operator: "equals",
        rightOperand: {
          type: "static",
          value: "test",
        },
      };

      const result = getConditionOperatorOptions(condition, survey, mockT);

      expect(result.length).toBeGreaterThan(0);
      // Should use the matrix.row options when row is specified in meta
      expect(result[0].value).toBe("selected");
    });
  });

  describe("getMatchValueProps", () => {
    test("returns show: false for operators that don't need match value", () => {
      const survey = createMockSurvey();
      const condition: TSingleCondition = {
        ...createMockCondition("question"),
        operator: "isSkipped",
      };

      const result = getMatchValueProps(condition, survey, 5, mockT);

      expect(result.show).toBe(false);
    });

    test("returns appropriate options for OpenText question", () => {
      const survey = createMockSurvey();
      const condition: TSingleCondition = {
        ...createMockCondition("question"),
        leftOperand: { type: "question", value: "question1" },
      };

      const result = getMatchValueProps(condition, survey, 5, mockT);

      expect(result.show).toBe(true);
      expect(result.showInput).toBe(true);
      expect(result.inputType).toBe("text");
    });

    test("returns appropriate options for MultipleChoiceSingle question", () => {
      const survey = createMockSurvey();
      const condition: TSingleCondition = {
        ...createMockCondition("question"),
        leftOperand: { type: "question", value: "question3" },
      };

      const result = getMatchValueProps(condition, survey, 5, mockT);

      expect(result.show).toBe(true);
      expect(result.showInput).toBe(false);
      expect(result.options[0].label).toBe("common.choices");
    });

    test("returns appropriate options for PictureSelection question", () => {
      const survey = createMockSurvey();
      const condition: TSingleCondition = {
        ...createMockCondition("question"),
        leftOperand: { type: "question", value: "question9" },
      };

      const result = getMatchValueProps(condition, survey, 9, mockT);

      expect(result.show).toBe(true);
      expect(result.showInput).toBe(false);
      expect(result.options[0].options[0]).toHaveProperty("imgSrc");
    });

    test("returns appropriate options for Rating question", () => {
      const survey = createMockSurvey();
      const condition: TSingleCondition = {
        ...createMockCondition("question"),
        leftOperand: { type: "question", value: "question2" },
      };

      const result = getMatchValueProps(condition, survey, 5, mockT);

      expect(result.show).toBe(true);
      expect(result.showInput).toBe(false);
      expect(result.options[0].options).toHaveLength(5); // Based on range: 5 from mock survey
    });

    test("returns appropriate options for NPS question", () => {
      const survey = createMockSurvey();
      const condition: TSingleCondition = {
        ...createMockCondition("question"),
        leftOperand: { type: "question", value: "question7" },
      };

      const result = getMatchValueProps(condition, survey, 7, mockT);

      expect(result.show).toBe(true);
      expect(result.showInput).toBe(false);
      expect(result.options[0].options).toHaveLength(11); // NPS is 0-10
    });

    test("returns appropriate options for Date question", () => {
      const survey = createMockSurvey();
      const condition: TSingleCondition = {
        ...createMockCondition("question"),
        leftOperand: { type: "question", value: "question5" },
      };

      const result = getMatchValueProps(condition, survey, 5, mockT);

      expect(result.show).toBe(true);
      expect(result.showInput).toBe(true);
      expect(result.inputType).toBe("date");
    });

    test("returns appropriate options for Matrix question", () => {
      const survey = createMockSurvey();
      const condition: TSingleCondition = {
        ...createMockCondition("question"),
        leftOperand: { type: "question", value: "question10" },
      };

      const result = getMatchValueProps(condition, survey, 9, mockT);

      expect(result.show).toBe(true);
      expect(result.showInput).toBe(false);
      expect(result.options[0].options).toHaveLength(2); // 2 columns in mock Matrix question

      // Verify the column options have the correct structure
      const columnOption = result.options[0].options[0];
      expect(columnOption.value).toBe("0"); // First column index
      expect(columnOption.label).toBe("Column 1"); // From the mock Matrix question
    });

    test("returns appropriate options for text variable", () => {
      const survey = createMockSurvey();
      const condition: TSingleCondition = {
        ...createMockCondition("variable"),
        leftOperand: { type: "variable", value: "var1" },
      };

      const result = getMatchValueProps(condition, survey, 5, mockT);

      expect(result.show).toBe(true);
      expect(result.showInput).toBe(true);
      expect(result.inputType).toBe("text");
    });

    test("returns appropriate options for number variable", () => {
      const survey = createMockSurvey();
      const condition: TSingleCondition = {
        ...createMockCondition("variable"),
        leftOperand: { type: "variable", value: "var2" },
      };

      const result = getMatchValueProps(condition, survey, 5, mockT);

      expect(result.show).toBe(true);
      expect(result.showInput).toBe(true);
      expect(result.inputType).toBe("number");
    });

    test("returns appropriate options for hidden field", () => {
      const survey = createMockSurvey();
      const condition = createMockCondition("hiddenField");

      const result = getMatchValueProps(condition, survey, 5, mockT);

      expect(result.show).toBe(true);
      expect(result.showInput).toBe(true);
      expect(result.inputType).toBe("text");
    });
  });

  describe("getActionTargetOptions", () => {
    test("returns question options for requireAnswer objective", () => {
      const survey = createMockSurvey();
      const action: TSurveyLogicAction = { id: "action1", objective: "requireAnswer" } as TSurveyLogicAction;
      const currQuestionIdx = 2;

      const result = getActionTargetOptions(action, survey, currQuestionIdx, mockT);

      // Should only include questions after currQuestionIdx that are not required
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((option) => option.value === "question1")).toBe(false); // Before currentQuestionIdx
      expect(result.some((option) => option.value === "question2")).toBe(false); // Already required
    });

    test("returns questions and endings for jumpToQuestion objective", () => {
      const survey = createMockSurvey();
      const action: TSurveyLogicAction = { id: "action1", objective: "jumpToQuestion" } as TSurveyLogicAction;
      const currQuestionIdx = 2;

      const result = getActionTargetOptions(action, survey, currQuestionIdx, mockT);

      // Should include questions after currQuestionIdx and endings
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((option) => option.value === "question1")).toBe(false); // Before currentQuestionIdx
      expect(result.some((option) => option.value === "ending1")).toBe(true); // Should include endings
    });
  });

  describe("getActionVariableOptions", () => {
    test("returns a list of all variables from the survey", () => {
      const survey = createMockSurvey();

      const result = getActionVariableOptions(survey);

      expect(result).toHaveLength(2); // Two variables in mock survey
      expect(result[0].value).toBe("var1");
      expect(result[0].meta?.variableType).toBe("text");
      expect(result[1].value).toBe("var2");
      expect(result[1].meta?.variableType).toBe("number");
    });

    test("returns empty array when survey has no variables", () => {
      const survey = { ...createMockSurvey(), variables: [] };

      const result = getActionVariableOptions(survey);

      expect(result).toEqual([]);
    });
  });

  describe("getActionOperatorOptions", () => {
    test("returns operators for number variables", () => {
      const result = getActionOperatorOptions(mockT, "number");

      expect(result.length).toBe(5);
      expect(result.map((op) => op.value)).toContain("add");
      expect(result.map((op) => op.value)).toContain("subtract");
      expect(result.map((op) => op.value)).toContain("multiply");
      expect(result.map((op) => op.value)).toContain("divide");
      expect(result.map((op) => op.value)).toContain("assign");
    });

    test("returns operators for text variables", () => {
      const result = getActionOperatorOptions(mockT, "text");

      expect(result.length).toBe(2);
      expect(result.map((op) => op.value)).toContain("assign");
      expect(result.map((op) => op.value)).toContain("concat");
    });

    test("returns empty array for undefined variable type", () => {
      const result = getActionOperatorOptions(mockT);

      expect(result).toEqual([]);
    });
  });

  describe("getActionValueOptions", () => {
    test("returns appropriate options for text variables", () => {
      const survey = createMockSurvey();
      const result = getActionValueOptions("var1", survey, 5, mockT);

      // Should return grouped options with questions for text
      expect(result.length).toBeGreaterThan(0);
    });

    test("returns appropriate options for number variables", () => {
      const survey = createMockSurvey();
      const result = getActionValueOptions("var2", survey, 5, mockT);

      // Should return grouped options with numeric questions
      expect(result.length).toBeGreaterThan(0);
    });

    test("returns empty array for non-existent variable", () => {
      const survey = createMockSurvey();
      const result = getActionValueOptions("nonExistent", survey, 5, mockT);

      expect(result).toEqual([]);
    });
  });

  describe("findQuestionUsedInLogic", () => {
    test("finds question used in logic rules conditions", () => {
      const survey = createMockSurvey();
      // Add logic to a question that references another question
      survey.questions[1].logic = [
        {
          id: "logic1",
          conditions: {
            id: "condGroup1",
            connector: "and",
            conditions: [
              {
                id: "cond1",
                leftOperand: { type: "question", value: "question1" },
                operator: "equals",
                rightOperand: { type: "static", value: "test" },
              },
            ],
          },
          actions: [],
        },
      ];

      const result = findQuestionUsedInLogic(survey, "question1");

      expect(result).toBe(1); // Index of the question with logic referencing question1
    });

    test("finds question used in logic fallback", () => {
      const survey = createMockSurvey();
      survey.questions[1].logicFallback = "question3";

      const result = findQuestionUsedInLogic(survey, "question3");

      expect(result).toBe(1); // Index of the question with logicFallback
    });

    test("finds question used in logic action target", () => {
      const survey = createMockSurvey();
      survey.questions[1].logic = [
        {
          id: "logic1",
          conditions: {
            id: "condGroup1",
            connector: "and",
            conditions: [
              {
                id: "cond1",
                leftOperand: { type: "variable", value: "var1" },
                operator: "equals",
                rightOperand: { type: "static", value: "test" },
              },
            ],
          },
          actions: [
            {
              id: "action1",
              objective: "jumpToQuestion",
              target: "question3",
            },
          ],
        },
      ];

      const result = findQuestionUsedInLogic(survey, "question3");

      expect(result).toBe(1); // Index of the question with logic action targeting question3
    });

    test("returns -1 if question is not used in logic", () => {
      const survey = createMockSurvey();

      const result = findQuestionUsedInLogic(survey, "question3");

      expect(result).toBe(-1);
    });
  });

  describe("findOptionUsedInLogic", () => {
    let mockSurvey: TSurvey;

    beforeEach(() => {
      mockSurvey = createMockSurvey();

      // Set up a question with logic using an option
      mockSurvey.questions[1].logic = [
        {
          id: "logic1",
          conditions: {
            id: "condGroup1",
            connector: "and",
            conditions: [
              {
                id: "cond1",
                leftOperand: { type: "question", value: "question3" },
                operator: "equals",
                rightOperand: { type: "static", value: "choice1" },
              },
            ],
          },
          actions: [],
        },
      ];
    });

    test("finds option used in right operand static value", () => {
      const result = findOptionUsedInLogic(mockSurvey, "question3", "choice1", false);

      expect(result).toBe(1); // Index of the question with logic using choice1
    });

    test("finds option used in left operand meta", () => {
      mockSurvey.questions[1].logic = [
        {
          id: "logic1",
          conditions: {
            id: "condGroup1",
            connector: "and",
            conditions: [
              {
                id: "cond1",
                leftOperand: {
                  type: "question",
                  value: "question3",
                  meta: {
                    optionId: "choice1",
                  },
                },
                operator: "equals",
                rightOperand: { type: "static", value: "something" },
              },
            ],
          },
          actions: [],
        },
      ];

      const result = findOptionUsedInLogic(mockSurvey, "question3", "choice1", true);

      expect(result).toBe(1); // Index of the question with logic using choice1 in meta
    });

    test("returns -1 if option is not used in logic", () => {
      const result = findOptionUsedInLogic(mockSurvey, "question3", "nonExistentChoice", false);

      expect(result).toBe(-1);
    });
  });

  describe("findVariableUsedInLogic", () => {
    test("finds variable used in logic conditions", () => {
      const survey = createMockSurvey();
      survey.questions[1].logic = [
        {
          id: "logic1",
          conditions: {
            id: "condGroup1",
            connector: "and",
            conditions: [
              {
                id: "cond1",
                leftOperand: { type: "variable", value: "var1" },
                operator: "equals",
                rightOperand: { type: "static", value: "test" },
              },
            ],
          },
          actions: [],
        },
      ];

      const result = findVariableUsedInLogic(survey, "var1");

      expect(result).toBe(1); // Index of the question with logic using var1
    });

    test("finds variable used in logic actions", () => {
      const survey = createMockSurvey();
      survey.questions[1].logic = [
        {
          id: "logic1",
          conditions: {
            id: "condGroup1",
            connector: "and",
            conditions: [
              {
                id: "cond1",
                leftOperand: { type: "question", value: "question3" },
                operator: "equals",
                rightOperand: { type: "static", value: "test" },
              },
            ],
          },
          actions: [
            {
              id: "action1",
              objective: "calculate",
              variableId: "var1",
              operator: "add",
              value: { type: "static", value: 10 },
            },
          ],
        },
      ];

      const result = findVariableUsedInLogic(survey, "var1");

      expect(result).toBe(1); // Index of the question with action using var1
    });

    test("returns -1 if variable is not used in logic", () => {
      const survey = createMockSurvey();

      const result = findVariableUsedInLogic(survey, "var1");

      expect(result).toBe(-1);
    });
  });

  describe("findHiddenFieldUsedInLogic", () => {
    test("finds hidden field used in logic conditions", () => {
      const survey = createMockSurvey();
      survey.questions[1].logic = [
        {
          id: "logic1",
          conditions: {
            id: "condGroup1",
            connector: "and",
            conditions: [
              {
                id: "cond1",
                leftOperand: { type: "hiddenField", value: "field1" },
                operator: "equals",
                rightOperand: { type: "static", value: "test" },
              },
            ],
          } as any,
          actions: [],
        },
      ];

      const result = findHiddenFieldUsedInLogic(survey, "field1");

      expect(result).toBe(1); // Index of the question with logic using field1
    });

    test("returns -1 if hidden field is not used in logic", () => {
      const survey = createMockSurvey();

      const result = findHiddenFieldUsedInLogic(survey, "field1");

      expect(result).toBe(-1);
    });
  });

  describe("getSurveyFollowUpActionDefaultBody", () => {
    test("returns the default body text", () => {
      const result = getSurveyFollowUpActionDefaultBody(mockT);

      expect(result).toBe("templates.follow_ups_modal_action_body");
    });
  });

  describe("findEndingCardUsedInLogic", () => {
    test("finds ending card used in logic actions", () => {
      const survey = createMockSurvey();
      survey.questions[1].logic = [
        {
          id: "logic1",
          conditions: {
            id: "condGroup1",
            connector: "and",
            conditions: [
              {
                id: "cond1",
                leftOperand: { type: "question", value: "question3" },
                operator: "equals",
                rightOperand: { type: "static", value: "test" },
              },
            ],
          } as any,
          actions: [
            {
              id: "action1",
              objective: "jumpToQuestion",
              target: "ending1",
            },
          ],
        },
      ];

      const result = findEndingCardUsedInLogic(survey, "ending1");

      expect(result).toBe(1); // Index of the question with logic using ending1
    });

    test("finds ending card used in logic fallback", () => {
      const survey = createMockSurvey();
      survey.questions[1].logicFallback = "ending1";

      const result = findEndingCardUsedInLogic(survey, "ending1");

      expect(result).toBe(1); // Index of the question with logicFallback
    });

    test("returns -1 if ending card is not used in logic", () => {
      const survey = createMockSurvey();

      const result = findEndingCardUsedInLogic(survey, "ending1");

      expect(result).toBe(-1);
    });
  });
});
