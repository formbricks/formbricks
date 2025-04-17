import { describe, expect, test, vi } from "vitest";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TResponseData, TResponseVariables } from "@formbricks/types/responses";
import {
  TConditionGroup,
  TSingleCondition,
  TSurveyLogicAction,
  TSurveyQuestionTypeEnum,
  TSurveyVariable,
} from "@formbricks/types/surveys/types";
import { evaluateLogic, isConditionGroup, performActions } from "./logic";

// Mock the imported function
vi.mock("@/lib/i18n", () => ({
  getLocalizedValue: vi.fn((value, language) => {
    if (typeof value === "object") {
      return value[language] || value["default"] || "";
    }
    return value;
  }),
}));

describe("Survey Logic", () => {
  // Mock data for reuse across tests
  const mockVariables: TSurveyVariable[] = [
    { id: "var1", name: "Variable 1", type: "text", value: "string value" },
    { id: "var2", name: "Variable 2", type: "number", value: 50 },
    { id: "var3", name: "Variable 3", type: "text", value: "another string" },
  ];

  const mockSurvey: TJsEnvironmentStateSurvey = {
    id: "survey1",
    name: "Test Survey",
    questions: [
      {
        id: "q1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Question 1" },
        subheader: { default: "Enter some text" },
        required: true,
        inputType: "text",
        charLimit: { enabled: false },
      },
      {
        id: "q2",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Question 2" },
        subheader: { default: "Enter a number" },
        required: true,
        inputType: "number",
        charLimit: { enabled: false },
      },
      {
        id: "q3",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        headline: { default: "Question 3" },
        subheader: { default: "Select one option" },
        required: true,
        choices: [
          { id: "opt1", label: { default: "Option 1", es: "Opción 1" } },
          { id: "opt2", label: { default: "Option 2", es: "Opción 2" } },
          { id: "other", label: { default: "Other", es: "Otro" } },
        ],
      },
      {
        id: "q4",
        type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
        headline: { default: "Question 4" },
        subheader: { default: "Select multiple options" },
        required: true,
        choices: [
          { id: "opt1", label: { default: "Option 1", es: "Opción 1" } },
          { id: "opt2", label: { default: "Option 2", es: "Opción 2" } },
          { id: "opt3", label: { default: "Option 3", es: "Opción 3" } },
        ],
      },
      {
        id: "q5",
        type: TSurveyQuestionTypeEnum.Date,
        headline: { default: "Question 5" },
        subheader: { default: "Select a date" },
        required: true,
        format: "d-M-y",
      },
      {
        id: "q6",
        type: TSurveyQuestionTypeEnum.FileUpload,
        headline: { default: "Question 6" },
        subheader: { default: "Upload a file" },
        required: true,
        allowMultipleFiles: true,
      },
      {
        id: "q7",
        type: TSurveyQuestionTypeEnum.PictureSelection,
        headline: { default: "Question 7" },
        subheader: { default: "Select pictures" },
        required: true,
        allowMulti: true,
        choices: [
          { id: "pic1", imageUrl: "url1" },
          { id: "pic2", imageUrl: "url2" },
        ],
      },
      {
        id: "q8",
        type: TSurveyQuestionTypeEnum.Matrix,
        headline: { default: "Question 8" },
        subheader: { default: "Matrix question" },
        required: true,
        rows: [
          { default: "Row 1", es: "Fila 1" },
          { default: "Row 2", es: "Fila 2" },
        ],
        columns: [
          { default: "Column 1", es: "Columna 1" },
          { default: "Column 2", es: "Columna 2" },
        ],
        shuffleOption: "none",
      },
    ],
    variables: mockVariables,
    hiddenFields: {
      enabled: true,
      fieldIds: ["fieldId1"],
    },
    autoClose: null,
    type: "link",
    delay: 0,
    displayLimit: 0,
    displayOption: "displayMultiple",
    displayPercentage: 0,
    isBackButtonHidden: false,
    segment: null,
    welcomeCard: {
      enabled: true,
      showResponseCount: true,
      timeToFinish: true,
    },
    triggers: [],
    styling: null,
    status: "inProgress",
    showLanguageSwitch: false,
    languages: [],
    endings: [],
    projectOverwrites: null,
    recontactDays: null,
  };

  describe("isConditionGroup", () => {
    test("returns true for condition groups", () => {
      const conditionGroup: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [],
      };
      expect(isConditionGroup(conditionGroup)).toBe(true);
    });

    test("returns false for single conditions", () => {
      const singleCondition: TSingleCondition = {
        id: "condition1",
        operator: "equals",
        leftOperand: { type: "question", value: "q1" },
        rightOperand: { type: "static", value: "test" },
      };
      expect(isConditionGroup(singleCondition)).toBe(false);
    });
  });

  describe("evaluateLogic", () => {
    const mockData: TResponseData = {
      q1: "test answer",
      q2: 42,
      q3: "Option 1",
      q4: ["Option 1", "Option 2"],
      q5: "2023-01-01",
      q7: ["pic1", "pic2"],
      q8: { "Row 1": "Column 1", "Row 2": "Column 2" },
      fieldId1: "hidden value",
    };

    const mockVariablesData: TResponseVariables = {
      var1: "string value",
      var2: 123,
      var3: "another string",
    };

    test("evaluates a simple condition group with AND connector", () => {
      const conditions: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "equals",
            leftOperand: { type: "question", value: "q1" },
            rightOperand: { type: "static", value: "test answer" },
          },
          {
            id: "condition2",
            operator: "equals",
            leftOperand: { type: "question", value: "q2" },
            rightOperand: { type: "static", value: 42 },
          },
        ],
      };

      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, conditions, "default")).toBe(true);
    });

    test("evaluates a simple condition group with OR connector", () => {
      const conditions: TConditionGroup = {
        id: "group1",
        connector: "or",
        conditions: [
          {
            id: "condition1",
            operator: "equals",
            leftOperand: { type: "question", value: "q1" },
            rightOperand: { type: "static", value: "wrong answer" },
          },
          {
            id: "condition2",
            operator: "equals",
            leftOperand: { type: "question", value: "q2" },
            rightOperand: { type: "static", value: 42 },
          },
        ],
      };

      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, conditions, "default")).toBe(true);
    });

    test("evaluates a nested condition group", () => {
      const conditions: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "equals",
            leftOperand: { type: "question", value: "q1" },
            rightOperand: { type: "static", value: "test answer" },
          },
          {
            id: "group2",
            connector: "or",
            conditions: [
              {
                id: "condition2",
                operator: "equals",
                leftOperand: { type: "question", value: "q2" },
                rightOperand: { type: "static", value: "wrong" },
              },
              {
                id: "condition3",
                operator: "equals",
                leftOperand: { type: "variable", value: "var1" },
                rightOperand: { type: "static", value: "string value" },
              },
            ],
          },
        ],
      };

      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, conditions, "default")).toBe(true);
    });

    test("evaluates false when any condition fails in AND group", () => {
      const conditions: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "equals",
            leftOperand: { type: "question", value: "q1" },
            rightOperand: { type: "static", value: "test answer" },
          },
          {
            id: "condition2",
            operator: "equals",
            leftOperand: { type: "question", value: "q2" },
            rightOperand: { type: "static", value: "wrong value" },
          },
        ],
      };

      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, conditions, "default")).toBe(false);
    });

    test("evaluates false when all conditions fail in OR group", () => {
      const conditions: TConditionGroup = {
        id: "group1",
        connector: "or",
        conditions: [
          {
            id: "condition1",
            operator: "equals",
            leftOperand: { type: "question", value: "q1" },
            rightOperand: { type: "static", value: "wrong answer" },
          },
          {
            id: "condition2",
            operator: "equals",
            leftOperand: { type: "question", value: "q2" },
            rightOperand: { type: "static", value: "wrong value" },
          },
        ],
      };

      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, conditions, "default")).toBe(false);
    });

    test("evaluates conditions with variable as left operand", () => {
      const conditions: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "equals",
            leftOperand: { type: "variable", value: "var1" },
            rightOperand: { type: "static", value: "string value" },
          },
        ],
      };

      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, conditions, "default")).toBe(true);
    });

    test("evaluates conditions with hidden field as left operand", () => {
      const conditions: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "equals",
            leftOperand: { type: "hiddenField", value: "fieldId1" },
            rightOperand: { type: "static", value: "hidden value" },
          },
        ],
      };

      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, conditions, "default")).toBe(true);
    });
  });

  describe("performActions", () => {
    const mockData: TResponseData = {
      q1: "test answer",
      q2: "42",
      q3: "opt1",
    };

    const mockVariablesData: TResponseVariables = {
      var1: "string value",
      var2: 50,
      var3: "",
    };

    test("performs jump action", () => {
      const actions: TSurveyLogicAction[] = [
        {
          id: "var1",
          objective: "jumpToQuestion",
          target: "q5",
        },
      ];

      const result = performActions(mockSurvey, actions, mockData, mockVariablesData);
      expect(result.jumpTarget).toBe("q5");
      expect(result.requiredQuestionIds).toEqual([]);
      expect(result.calculations).toEqual(mockVariablesData);
    });

    test("performs require answer action", () => {
      const actions: TSurveyLogicAction[] = [
        {
          id: "var1",
          objective: "requireAnswer",
          target: "q4",
        },
      ];

      const result = performActions(mockSurvey, actions, mockData, mockVariablesData);
      expect(result.jumpTarget).toBeUndefined();
      expect(result.requiredQuestionIds).toEqual(["q4"]);
      expect(result.calculations).toEqual(mockVariablesData);
    });

    test("performs calculate action - add", () => {
      const actions: TSurveyLogicAction[] = [
        {
          id: "var2",
          objective: "calculate",
          variableId: "var2",
          operator: "add",
          value: { type: "static", value: 10 },
        },
      ];

      const result = performActions(mockSurvey, actions, mockData, mockVariablesData);
      expect(result.calculations.var2).toBe(60);
    });

    test("performs calculate action - subtract", () => {
      const actions: TSurveyLogicAction[] = [
        {
          id: "var2",
          objective: "calculate",
          variableId: "var2",
          operator: "subtract",
          value: { type: "static", value: 10 },
        },
      ];

      const result = performActions(mockSurvey, actions, mockData, mockVariablesData);
      expect(result.calculations.var2).toBe(40);
    });

    test("performs calculate action - multiply", () => {
      const actions: TSurveyLogicAction[] = [
        {
          id: "var2",
          objective: "calculate",
          variableId: "var2",
          operator: "multiply",
          value: { type: "static", value: 2 },
        },
      ];

      const result = performActions(mockSurvey, actions, mockData, mockVariablesData);
      expect(result.calculations.var2).toBe(100);
    });

    test("performs calculate action - divide", () => {
      const actions: TSurveyLogicAction[] = [
        {
          id: "var2",
          objective: "calculate",
          variableId: "var2",
          operator: "divide",
          value: { type: "static", value: 2 },
        },
      ];

      const result = performActions(mockSurvey, actions, mockData, mockVariablesData);
      expect(result.calculations.var2).toBe(25);
    });

    test("handles divide by zero", () => {
      const actions: TSurveyLogicAction[] = [
        {
          id: "var2",
          objective: "calculate",
          variableId: "var2",
          operator: "divide",
          value: { type: "static", value: 0 },
        },
      ];

      const result = performActions(mockSurvey, actions, mockData, mockVariablesData);
      expect(result.calculations.var2).toBe(50); // Original value preserved
    });

    test("performs calculate action - assign", () => {
      const actions: TSurveyLogicAction[] = [
        {
          id: "var2",
          objective: "calculate",
          variableId: "var2",
          operator: "assign",
          value: { type: "static", value: 200 },
        },
      ];

      const result = performActions(mockSurvey, actions, mockData, mockVariablesData);
      expect(result.calculations.var2).toBe(200);
    });

    test("performs calculate action - concat", () => {
      const actions: TSurveyLogicAction[] = [
        {
          id: "var1",
          objective: "calculate",
          variableId: "var1",
          operator: "concat",
          value: { type: "static", value: " appended" },
        },
      ];

      const result = performActions(mockSurvey, actions, mockData, mockVariablesData);
      expect(result.calculations.var1).toBe("string value appended");
    });

    test("performs calculate action with question value", () => {
      const actions: TSurveyLogicAction[] = [
        {
          id: "var2",
          objective: "calculate",
          variableId: "var2",
          operator: "add",
          value: { type: "question", value: "q2" },
        },
      ];

      const result = performActions(mockSurvey, actions, mockData, mockVariablesData);
      expect(result.calculations.var2).toBe(92); // 50 + 42
    });

    test("performs calculate action with variable value", () => {
      const actions: TSurveyLogicAction[] = [
        {
          id: "var2",
          objective: "calculate",
          variableId: "var2",
          operator: "add",
          value: { type: "variable", value: "var2" },
        },
      ];

      const result = performActions(mockSurvey, actions, mockData, mockVariablesData);
      expect(result.calculations.var2).toBe(100); // 50 + 50
    });

    test("performs multiple actions in order", () => {
      const actions: TSurveyLogicAction[] = [
        {
          id: "var2",
          objective: "calculate",
          variableId: "var2",
          operator: "add",
          value: { type: "static", value: 10 },
        },
        {
          id: "var2",
          objective: "requireAnswer",
          target: "q4",
        },
        {
          id: "var2",
          objective: "jumpToQuestion",
          target: "q5",
        },
      ];

      const result = performActions(mockSurvey, actions, mockData, mockVariablesData);
      expect(result.jumpTarget).toBe("q5");
      expect(result.requiredQuestionIds).toEqual(["q4"]);
      expect(result.calculations.var2).toBe(60);
    });

    test("takes first jump target when multiple jump actions exist", () => {
      const actions: TSurveyLogicAction[] = [
        {
          id: "var2",
          objective: "jumpToQuestion",
          target: "q2",
        },
        {
          id: "var2",
          objective: "jumpToQuestion",
          target: "q3",
        },
      ];

      const result = performActions(mockSurvey, actions, mockData, mockVariablesData);
      expect(result.jumpTarget).toBe("q2");
    });
  });

  // Additional tests for complex condition evaluations
  describe("Condition Evaluations", () => {
    // Test data for different question types and operators
    const mockData: TResponseData = {
      q1: "test answer",
      q2: "42",
      q3: "Option 1", // MultipleChoiceSingle
      q4: ["Option 1", "Option 2"], // MultipleChoiceMulti
      q5: "2023-01-01", // Date
      q6: "file-url.pdf", // FileUpload
      q7: ["pic1", "pic2"], // PictureSelection
      q8: { "Row 1": "Column 1", "Row 2": "Column 2" }, // Matrix
      fieldId1: "hidden value",
      emptyField: "",
      skippedUpload: "skipped",
    };

    const mockVariablesData: TResponseVariables = {
      var1: "string value",
      var2: 123,
      var3: "2023-05-05",
    };

    test("evaluates string comparison operators", () => {
      // Tests for contains, startsWith, endsWith and their negations
      const containsCondition: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "contains",
            leftOperand: { type: "question", value: "q1" },
            rightOperand: { type: "static", value: "test" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, containsCondition, "default")).toBe(true);

      const doesNotContainCondition: TConditionGroup = {
        id: "group2",
        connector: "and",
        conditions: [
          {
            id: "condition2",
            operator: "doesNotContain",
            leftOperand: { type: "question", value: "q1" },
            rightOperand: { type: "static", value: "invalid" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, doesNotContainCondition, "default")).toBe(
        true
      );

      const startsWithCondition: TConditionGroup = {
        id: "group3",
        connector: "and",
        conditions: [
          {
            id: "condition3",
            operator: "startsWith",
            leftOperand: { type: "question", value: "q1" },
            rightOperand: { type: "static", value: "test" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, startsWithCondition, "default")).toBe(
        true
      );

      const doesNotStartWithCondition: TConditionGroup = {
        id: "group4",
        connector: "and",
        conditions: [
          {
            id: "condition4",
            operator: "doesNotStartWith",
            leftOperand: { type: "question", value: "q1" },
            rightOperand: { type: "static", value: "invalid" },
          },
        ],
      };
      expect(
        evaluateLogic(mockSurvey, mockData, mockVariablesData, doesNotStartWithCondition, "default")
      ).toBe(true);

      const endsWithCondition: TConditionGroup = {
        id: "group5",
        connector: "and",
        conditions: [
          {
            id: "condition5",
            operator: "endsWith",
            leftOperand: { type: "question", value: "q1" },
            rightOperand: { type: "static", value: "answer" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, endsWithCondition, "default")).toBe(true);

      const doesNotEndWithCondition: TConditionGroup = {
        id: "group6",
        connector: "and",
        conditions: [
          {
            id: "condition6",
            operator: "doesNotEndWith",
            leftOperand: { type: "question", value: "q1" },
            rightOperand: { type: "static", value: "invalid" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, doesNotEndWithCondition, "default")).toBe(
        true
      );
    });

    test("evaluates number comparison operators", () => {
      // Tests for isGreaterThan, isLessThan, etc.
      const greaterThanCondition: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "isGreaterThan",
            leftOperand: { type: "question", value: "q2" },
            rightOperand: { type: "static", value: "30" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, greaterThanCondition, "default")).toBe(
        true
      );

      const lessThanCondition: TConditionGroup = {
        id: "group2",
        connector: "and",
        conditions: [
          {
            id: "condition2",
            operator: "isLessThan",
            leftOperand: { type: "question", value: "q2" },
            rightOperand: { type: "static", value: "50" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, lessThanCondition, "default")).toBe(true);

      const greaterThanOrEqualCondition: TConditionGroup = {
        id: "group3",
        connector: "and",
        conditions: [
          {
            id: "condition3",
            operator: "isGreaterThanOrEqual",
            leftOperand: { type: "question", value: "q2" },
            rightOperand: { type: "static", value: "42" },
          },
        ],
      };
      expect(
        evaluateLogic(mockSurvey, mockData, mockVariablesData, greaterThanOrEqualCondition, "default")
      ).toBe(true);

      const lessThanOrEqualCondition: TConditionGroup = {
        id: "group4",
        connector: "and",
        conditions: [
          {
            id: "condition4",
            operator: "isLessThanOrEqual",
            leftOperand: { type: "question", value: "q2" },
            rightOperand: { type: "static", value: "42" },
          },
        ],
      };
      expect(
        evaluateLogic(mockSurvey, mockData, mockVariablesData, lessThanOrEqualCondition, "default")
      ).toBe(true);
    });

    test("evaluates date comparison operators", () => {
      // Tests for isAfter, isBefore
      const afterCondition: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "isAfter",
            leftOperand: { type: "question", value: "q5" },
            rightOperand: { type: "static", value: "2022-12-31" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, afterCondition, "default")).toBe(true);

      const beforeCondition: TConditionGroup = {
        id: "group2",
        connector: "and",
        conditions: [
          {
            id: "condition2",
            operator: "isBefore",
            leftOperand: { type: "question", value: "q5" },
            rightOperand: { type: "static", value: "2023-01-02" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, beforeCondition, "default")).toBe(true);

      const dateEqualCondition: TConditionGroup = {
        id: "group3",
        connector: "and",
        conditions: [
          {
            id: "condition3",
            operator: "equals",
            leftOperand: { type: "question", value: "q5" },
            rightOperand: { type: "static", value: "2023-01-01" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, dateEqualCondition, "default")).toBe(
        true
      );
    });

    test("evaluates array inclusion operators", () => {
      // Tests for includesAllOf, includesOneOf, etc.
      const includesAllOfCondition: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "includesAllOf",
            leftOperand: { type: "question", value: "q4" },
            rightOperand: { type: "static", value: ["opt1", "opt2"] },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, includesAllOfCondition, "default")).toBe(
        true
      );

      const includesOneOfCondition: TConditionGroup = {
        id: "group2",
        connector: "and",
        conditions: [
          {
            id: "condition2",
            operator: "includesOneOf",
            leftOperand: { type: "question", value: "q4" },
            rightOperand: { type: "static", value: ["opt1", "Invalid Option"] },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, includesOneOfCondition, "default")).toBe(
        true
      );

      const doesNotIncludeAllOfCondition: TConditionGroup = {
        id: "group3",
        connector: "and",
        conditions: [
          {
            id: "condition3",
            operator: "doesNotIncludeAllOf",
            leftOperand: { type: "question", value: "q4" },
            rightOperand: { type: "static", value: ["Invalid 1", "Invalid 2"] },
          },
        ],
      };
      expect(
        evaluateLogic(mockSurvey, mockData, mockVariablesData, doesNotIncludeAllOfCondition, "default")
      ).toBe(true);

      const doesNotIncludeOneOfCondition: TConditionGroup = {
        id: "group4",
        connector: "and",
        conditions: [
          {
            id: "condition4",
            operator: "doesNotIncludeOneOf",
            leftOperand: { type: "question", value: "q4" },
            rightOperand: { type: "static", value: ["opt3", "Invalid Option"] },
          },
        ],
      };
      expect(
        evaluateLogic(mockSurvey, mockData, mockVariablesData, doesNotIncludeOneOfCondition, "default")
      ).toBe(true);
    });

    test("evaluates special state operators", () => {
      // Tests for isSubmitted, isSkipped, etc.
      const isSubmittedCondition: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "isSubmitted",
            leftOperand: { type: "question", value: "q1" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, isSubmittedCondition, "default")).toBe(
        true
      );

      const isSkippedCondition: TConditionGroup = {
        id: "group2",
        connector: "and",
        conditions: [
          {
            id: "condition2",
            operator: "isSkipped",
            leftOperand: { type: "question", value: "emptyField" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, isSkippedCondition, "default")).toBe(
        true
      );

      const isBookedCondition: TConditionGroup = {
        id: "group3",
        connector: "and",
        conditions: [
          {
            id: "condition3",
            operator: "isBooked",
            leftOperand: { type: "question", value: "q1" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, isBookedCondition, "default")).toBe(true);
    });

    test("evaluates matrix questions", () => {
      const matrixCondition: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "equals",
            leftOperand: {
              type: "question",
              value: "q8",
              meta: { row: "0" },
            },
            rightOperand: { type: "static", value: "0" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, matrixCondition, "default")).toBe(true);
    });

    test("evaluates file upload questions", () => {
      const fileUploadCondition: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "isSubmitted",
            leftOperand: { type: "question", value: "q6" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, fileUploadCondition, "default")).toBe(
        true
      );

      const skippedUploadCondition: TConditionGroup = {
        id: "group2",
        connector: "and",
        conditions: [
          {
            id: "condition2",
            operator: "isSkipped",
            leftOperand: { type: "question", value: "skippedUpload" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, skippedUploadCondition, "default")).toBe(
        true
      );
    });

    test("evaluates partially submitted matrix question", () => {
      const partialMatrixData: TResponseData = {
        q8: { "Row 1": "Column 1", "Row 2": "" },
      };

      const partiallySubmittedCondition: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "isPartiallySubmitted",
            leftOperand: { type: "question", value: "q8" },
          },
        ],
      };
      expect(
        evaluateLogic(
          mockSurvey,
          partialMatrixData,
          mockVariablesData,
          partiallySubmittedCondition,
          "default"
        )
      ).toBe(true);

      const completeMatrixData: TResponseData = {
        q8: { "Row 1": "Column 1", "Row 2": "Column 2" },
      };

      const completelySubmittedCondition: TConditionGroup = {
        id: "group2",
        connector: "and",
        conditions: [
          {
            id: "condition2",
            operator: "isCompletelySubmitted",
            leftOperand: { type: "question", value: "q8" },
          },
        ],
      };
      expect(
        evaluateLogic(
          mockSurvey,
          completeMatrixData,
          mockVariablesData,
          completelySubmittedCondition,
          "default"
        )
      ).toBe(true);
    });

    test("handles invalid or error conditions gracefully", () => {
      // Test with an invalid operator that would cause an error
      const invalidCondition: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            // @ts-ignore - intentionally using invalid operator for test
            operator: "invalidOperator",
            leftOperand: { type: "question", value: "q1" },
            rightOperand: { type: "static", value: "test" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, invalidCondition, "default")).toBe(false);

      // Test with a non-existent question
      const nonExistentCondition: TConditionGroup = {
        id: "group2",
        connector: "and",
        conditions: [
          {
            id: "condition2",
            operator: "equals",
            leftOperand: { type: "question", value: "nonExistentId" },
            rightOperand: { type: "static", value: "test" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, nonExistentCondition, "default")).toBe(
        false
      );
    });
  });

  describe("Edge Cases and Uncovered Lines", () => {
    const mockData: TResponseData = {
      q1: "test answer",
      q2: "42",
      q3: "opt1",
      q4: ["Option 1", "Option 2"],
      q5: "2023-01-01",
      q6: "file-url.pdf",
      q7: ["pic1", "pic2"],
      q8: { "Row 1": "Column 1", "Row 2": "Column 2" },
      fieldId1: "hidden value",
      emptyField: "",
      dateField: "2023-05-01",
    };

    const mockVariablesData: TResponseVariables = {
      var1: "string value",
      var2: 50,
      var3: "",
      numVar: 123,
      dateVar: "2023-06-01",
    };

    test("evaluates matrix question with invalid row id", () => {
      const matrixCondition: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "equals",
            leftOperand: {
              type: "question",
              value: "q8",
              meta: { row: "invalid-row" },
            },
            rightOperand: { type: "static", value: "0" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, matrixCondition, "default")).toBe(false);
    });

    test("evaluates invalid row index for matrix question", () => {
      const matrixCondition: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "equals",
            leftOperand: {
              type: "question",
              value: "q8",
              meta: { row: "99" }, // Invalid row index
            },
            rightOperand: { type: "static", value: "Column 1" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, matrixCondition, "default")).toBe(false);
    });

    test("evaluates matrix question with empty row value", () => {
      const emptyMatrixData: TResponseData = {
        q8: { "Row 1": "" },
      };

      const matrixCondition: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "isEmpty",
            leftOperand: {
              type: "question",
              value: "q8",
              meta: { row: "0" },
            },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, emptyMatrixData, mockVariablesData, matrixCondition, "default")).toBe(
        true
      );
    });

    test("evaluates doesNotEqual with picture selection", () => {
      const condition: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "doesNotEqual",
            leftOperand: { type: "question", value: "q7" },
            rightOperand: { type: "static", value: "option2" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, condition, "default")).toBe(true);
    });

    test("evaluates date conditions between questions", () => {
      // Tests date comparisons between two questions
      const dateData: TResponseData = {
        dateQ1: "2023-01-01",
        dateQ2: "2023-02-01",
      };

      // Test for equals operator
      const equalsDateCondition: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "equals",
            leftOperand: { type: "question", value: "dateQ1" },
            rightOperand: { type: "question", value: "dateQ2" },
          },
        ],
      };

      // Mock survey with date questions
      const dateSurvey: TJsEnvironmentStateSurvey = {
        ...mockSurvey,
        questions: [
          ...mockSurvey.questions,
          {
            id: "dateQ1",
            type: TSurveyQuestionTypeEnum.Date,
            headline: { default: "Date Question 1" },
            required: true,
            format: "d-M-y",
          },
          {
            id: "dateQ2",
            type: TSurveyQuestionTypeEnum.Date,
            headline: { default: "Date Question 2" },
            required: true,
            format: "d-M-y",
          },
        ],
      };

      expect(evaluateLogic(dateSurvey, dateData, mockVariablesData, equalsDateCondition, "default")).toBe(
        false
      );

      // Test for doesNotEqual operator
      const doesNotEqualDateCondition: TConditionGroup = {
        id: "group2",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "doesNotEqual",
            leftOperand: { type: "question", value: "dateQ1" },
            rightOperand: { type: "question", value: "dateQ2" },
          },
        ],
      };
      expect(
        evaluateLogic(dateSurvey, dateData, mockVariablesData, doesNotEqualDateCondition, "default")
      ).toBe(true);
    });

    test("evaluates multiple choice conditions for equals/doesNotEqual", () => {
      // Tests for array equals/doesNotEqual operations
      const multiChoiceData: TResponseData = {
        singleValue: "option1",
        multiValue: ["option1", "option2"],
      };

      const multiSurvey: TJsEnvironmentStateSurvey = {
        ...mockSurvey,
        questions: [
          ...mockSurvey.questions,
          {
            id: "multiQ",
            type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
            headline: { default: "Multiple Choice" },
            required: true,
            choices: [
              { id: "opt1", label: { default: "Option 1" } },
              { id: "opt2", label: { default: "Option 2" } },
            ],
          },
        ],
      };

      // Test equals with array length 1 and string
      const equalsArrayCondition: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "equals",
            leftOperand: { type: "question", value: "multiValue" },
            rightOperand: { type: "static", value: "option1" },
          },
        ],
      };
      expect(
        evaluateLogic(multiSurvey, multiChoiceData, mockVariablesData, equalsArrayCondition, "default")
      ).toBe(false);

      // Test with right operand as multiple choice
      const equalsMultiCondition: TConditionGroup = {
        id: "group2",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "equals",
            leftOperand: { type: "question", value: "q1" },
            rightOperand: { type: "question", value: "multiQ" },
          },
        ],
      };
      const multiChoiceTestData = {
        multiQ: ["option1"],
      };
      expect(
        evaluateLogic(multiSurvey, multiChoiceTestData, mockVariablesData, equalsMultiCondition, "default")
      ).toBe(false);
    });

    test("evaluates isEmpty and isNotEmpty operators", () => {
      // Test isEmpty
      const isEmptyCondition: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "isEmpty",
            leftOperand: { type: "question", value: "q1" },
          },
        ],
      };
      expect(
        evaluateLogic(mockSurvey, { ...mockData, q1: "" }, mockVariablesData, isEmptyCondition, "default")
      ).toBe(true);

      // Test isNotEmpty
      const isNotEmptyCondition: TConditionGroup = {
        id: "group2",
        connector: "and",
        conditions: [
          {
            id: "condition2",
            operator: "isNotEmpty",
            leftOperand: { type: "question", value: "q1" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, isNotEmptyCondition, "default")).toBe(
        true
      );
    });

    test("evaluates isAnyOf operator", () => {
      const isAnyOfCondition: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "isAnyOf",
            leftOperand: { type: "question", value: "q1" },
            rightOperand: { type: "static", value: ["wrong answer", "test answer", "another answer"] },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, isAnyOfCondition, "default")).toBe(true);

      // Test isAnyOf with non-array right value
      const invalidIsAnyOfCondition: TConditionGroup = {
        id: "group2",
        connector: "and",
        conditions: [
          {
            id: "condition2",
            operator: "isAnyOf",
            leftOperand: { type: "question", value: "q1" },
            rightOperand: { type: "static", value: "test answer" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, invalidIsAnyOfCondition, "default")).toBe(
        false
      );
    });

    test("getLeftOperandValue with edge cases", () => {
      const specialSurvey: TJsEnvironmentStateSurvey = {
        ...mockSurvey,
        questions: [
          ...mockSurvey.questions,
          {
            id: "multiChoiceWithOther",
            type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
            headline: { default: "Multiple Choice With Other" },
            required: true,
            choices: [
              { id: "opt1", label: { default: "Option 1" } },
              { id: "opt2", label: { default: "Option 2" } },
              { id: "other", label: { default: "Other" } },
            ],
          },
        ],
      };

      const otherOptionCondition: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "equals",
            leftOperand: { type: "question", value: "multiChoiceWithOther" },
            rightOperand: { type: "static", value: "Custom Option" },
          },
        ],
      };

      const otherOptionData = {
        multiChoiceWithOther: "Custom Option",
      };

      expect(
        evaluateLogic(specialSurvey, otherOptionData, mockVariablesData, otherOptionCondition, "default")
      ).toBe(false);

      const multiChoiceArrayCondition: TConditionGroup = {
        id: "group2",
        connector: "and",
        conditions: [
          {
            id: "condition2",
            operator: "equals",
            leftOperand: { type: "question", value: "multiChoiceWithOther" },
            rightOperand: { type: "static", value: "opt1" },
          },
        ],
      };

      const multiChoiceArrayData = {
        multiChoiceWithOther: ["Option 1"],
      };

      expect(
        evaluateLogic(
          specialSurvey,
          multiChoiceArrayData,
          mockVariablesData,
          multiChoiceArrayCondition,
          "default"
        )
      ).toBe(true);
    });
  });
});
