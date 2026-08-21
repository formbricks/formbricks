import { describe, expect, test, vi } from "vitest";
import { deriveLegacyEmbeddedData } from "@formbricks/types/embedded-data-resolver";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { type TResponseData, type TResponseVariables } from "@formbricks/types/responses";
import { type TSurveyBlockLogicAction } from "@formbricks/types/surveys/blocks";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { type TConditionGroup, type TSingleCondition } from "@formbricks/types/surveys/logic";
import { type TSurveyVariable } from "@formbricks/types/surveys/types";
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

  const mockSurvey: TJsWorkspaceStateSurvey = {
    id: "survey1",
    name: "Survey 1",
    questions: [], // Deprecated - using blocks instead
    blocks: [
      {
        id: "block1",
        name: "Block 1",
        elements: [
          {
            id: "q1",
            type: TSurveyElementTypeEnum.OpenText,
            headline: { default: "Question 1" },
            subheader: { default: "Enter some text" },
            required: true,
            inputType: "text",
            charLimit: { enabled: false },
          },
          {
            id: "q2",
            type: TSurveyElementTypeEnum.OpenText,
            headline: { default: "Question 2" },
            subheader: { default: "Enter a number" },
            required: true,
            inputType: "number",
            charLimit: { enabled: false },
          },
          {
            id: "q3",
            type: TSurveyElementTypeEnum.MultipleChoiceSingle,
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
            type: TSurveyElementTypeEnum.MultipleChoiceMulti,
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
            type: TSurveyElementTypeEnum.Date,
            headline: { default: "Question 5" },
            subheader: { default: "Select a date" },
            required: true,
            format: "d-M-y",
          },
          {
            id: "q6",
            type: TSurveyElementTypeEnum.FileUpload,
            headline: { default: "Question 6" },
            subheader: { default: "Upload a file" },
            required: true,
            allowMultipleFiles: true,
          },
          {
            id: "q7",
            type: TSurveyElementTypeEnum.PictureSelection,
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
            type: TSurveyElementTypeEnum.Matrix,
            headline: { default: "Question 8" },
            subheader: { default: "Matrix question" },
            required: true,
            rows: [
              { id: "row1", label: { default: "Row 1", es: "Fila 1" } },
              { id: "row2", label: { default: "Row 2", es: "Fila 2" } },
            ],
            columns: [
              { id: "col1", label: { default: "Column 1", es: "Columna 1" } },
              { id: "col2", label: { default: "Column 2", es: "Columna 2" } },
            ],
            shuffleOption: "none",
          },
        ],
      },
    ],
    variables: mockVariables,
    hiddenFields: {
      enabled: true,
      fieldIds: ["fieldId1"],
    },
    // ENG-2412: the rows are the only thing the resolver reads now, and a survey reaching the
    // renderer always carries them inlined from the payload. A fixture with the legacy columns
    // alone describes a survey nothing would resolve fields for.
    embeddedFields: deriveLegacyEmbeddedData({
      variables: mockVariables,
      hiddenFields: { enabled: true, fieldIds: ["fieldId1"] },
    }),
    autoClose: null,
    type: "link",
    delay: 0,
    displayLimit: 0,
    displayOption: "displayMultiple",
    displayPercentage: 0,
    recaptcha: { enabled: false, threshold: 0.5 },
    isBackButtonHidden: false,
    isAutoProgressingEnabled: false,
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
    workspaceOverwrites: null,
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
        leftOperand: { type: "element", value: "q1" },
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
            leftOperand: { type: "element", value: "q1" },
            rightOperand: { type: "static", value: "test answer" },
          },
          {
            id: "condition2",
            operator: "equals",
            leftOperand: { type: "element", value: "q2" },
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
            leftOperand: { type: "element", value: "q1" },
            rightOperand: { type: "static", value: "wrong answer" },
          },
          {
            id: "condition2",
            operator: "equals",
            leftOperand: { type: "element", value: "q2" },
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
            leftOperand: { type: "element", value: "q1" },
            rightOperand: { type: "static", value: "test answer" },
          },
          {
            id: "group2",
            connector: "or",
            conditions: [
              {
                id: "condition2",
                operator: "equals",
                leftOperand: { type: "element", value: "q2" },
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
            leftOperand: { type: "element", value: "q1" },
            rightOperand: { type: "static", value: "test answer" },
          },
          {
            id: "condition2",
            operator: "equals",
            leftOperand: { type: "element", value: "q2" },
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
            leftOperand: { type: "element", value: "q1" },
            rightOperand: { type: "static", value: "wrong answer" },
          },
          {
            id: "condition2",
            operator: "equals",
            leftOperand: { type: "element", value: "q2" },
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
      const actions: TSurveyBlockLogicAction[] = [
        {
          id: "var1",
          objective: "jumpToBlock",
          target: "q5",
        },
      ];

      const result = performActions(mockSurvey, actions, mockData, mockVariablesData);
      expect(result.jumpTarget).toBe("q5");
      expect(result.requiredQuestionIds).toEqual([]);
      expect(result.calculations).toEqual(mockVariablesData);
    });

    test("performs require answer action", () => {
      const actions: TSurveyBlockLogicAction[] = [
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
      const actions: TSurveyBlockLogicAction[] = [
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
      const actions: TSurveyBlockLogicAction[] = [
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
      const actions: TSurveyBlockLogicAction[] = [
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
      const actions: TSurveyBlockLogicAction[] = [
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
      const actions: TSurveyBlockLogicAction[] = [
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
      const actions: TSurveyBlockLogicAction[] = [
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
      const actions: TSurveyBlockLogicAction[] = [
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
      const actions: TSurveyBlockLogicAction[] = [
        {
          id: "var2",
          objective: "calculate",
          variableId: "var2",
          operator: "add",
          value: { type: "element", value: "q2" },
        },
      ];

      const result = performActions(mockSurvey, actions, mockData, mockVariablesData);
      expect(result.calculations.var2).toBe(92); // 50 + 42
    });

    test("performs calculate action with variable value", () => {
      const actions: TSurveyBlockLogicAction[] = [
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
      const actions: TSurveyBlockLogicAction[] = [
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
          objective: "jumpToBlock",
          target: "q5",
        },
      ];

      const result = performActions(mockSurvey, actions, mockData, mockVariablesData);
      expect(result.jumpTarget).toBe("q5");
      expect(result.requiredQuestionIds).toEqual(["q4"]);
      expect(result.calculations.var2).toBe(60);
    });

    test("takes first jump target when multiple jump actions exist", () => {
      const actions: TSurveyBlockLogicAction[] = [
        {
          id: "var2",
          objective: "jumpToBlock",
          target: "q2",
        },
        {
          id: "var2",
          objective: "jumpToBlock",
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
            leftOperand: { type: "element", value: "q1" },
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
            leftOperand: { type: "element", value: "q1" },
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
            leftOperand: { type: "element", value: "q1" },
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
            leftOperand: { type: "element", value: "q1" },
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
            leftOperand: { type: "element", value: "q1" },
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
            leftOperand: { type: "element", value: "q1" },
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
            leftOperand: { type: "element", value: "q2" },
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
            leftOperand: { type: "element", value: "q2" },
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
            leftOperand: { type: "element", value: "q2" },
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
            leftOperand: { type: "element", value: "q2" },
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
            leftOperand: { type: "element", value: "q5" },
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
            leftOperand: { type: "element", value: "q5" },
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
            leftOperand: { type: "element", value: "q5" },
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
            leftOperand: { type: "element", value: "q4" },
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
            leftOperand: { type: "element", value: "q4" },
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
            leftOperand: { type: "element", value: "q4" },
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
            leftOperand: { type: "element", value: "q4" },
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
            leftOperand: { type: "element", value: "q1" },
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
            leftOperand: { type: "element", value: "emptyField" },
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
            leftOperand: { type: "element", value: "q1" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, isBookedCondition, "default")).toBe(true);
    });

    test("evaluates isClicked and isNotClicked operators for CTA elements", () => {
      // Create a survey with a CTA element
      const ctaSurvey: TJsWorkspaceStateSurvey = {
        ...mockSurvey,
        blocks: [
          ...mockSurvey.blocks,
          {
            id: "ctaBlock",
            name: "CTA Block",
            elements: [
              {
                id: "ctaQuestion",
                type: TSurveyElementTypeEnum.CTA,
                headline: { default: "CTA Question" },
                subheader: { default: "Click the button" },
                required: false,
                buttonExternal: true,
                buttonUrl: "https://example.com",
                ctaButtonLabel: { default: "Click Me" },
              },
            ],
          },
        ],
      };

      // Test isClicked with "clicked" response
      const clickedData: TResponseData = {
        ctaQuestion: "clicked",
      };
      const isClickedCondition: TConditionGroup = {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "isClicked",
            leftOperand: { type: "element", value: "ctaQuestion" },
          },
        ],
      };
      expect(evaluateLogic(ctaSurvey, clickedData, mockVariablesData, isClickedCondition, "default")).toBe(
        true
      );

      // Test isClicked with "skipped" response (should be false)
      const skippedData: TResponseData = {
        ctaQuestion: "skipped",
      };
      expect(evaluateLogic(ctaSurvey, skippedData, mockVariablesData, isClickedCondition, "default")).toBe(
        false
      );

      // Test isNotClicked with "clicked" response (should be false)
      const isNotClickedCondition: TConditionGroup = {
        id: "group2",
        connector: "and",
        conditions: [
          {
            id: "condition2",
            operator: "isNotClicked",
            leftOperand: { type: "element", value: "ctaQuestion" },
          },
        ],
      };
      expect(evaluateLogic(ctaSurvey, clickedData, mockVariablesData, isNotClickedCondition, "default")).toBe(
        false
      );

      // Test isNotClicked with "skipped" response (should be true)
      expect(evaluateLogic(ctaSurvey, skippedData, mockVariablesData, isNotClickedCondition, "default")).toBe(
        true
      );

      // Test isNotClicked with undefined response (should be true)
      const undefinedData: TResponseData = {};
      expect(
        evaluateLogic(ctaSurvey, undefinedData, mockVariablesData, isNotClickedCondition, "default")
      ).toBe(true);
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
              type: "element",
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
            leftOperand: { type: "element", value: "q6" },
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
            leftOperand: { type: "element", value: "skippedUpload" },
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
            leftOperand: { type: "element", value: "q8" },
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
        q8: { row1: "col1", row2: "col2" },
      };

      const completelySubmittedCondition: TConditionGroup = {
        id: "group2",
        connector: "and",
        conditions: [
          {
            id: "condition2",
            operator: "isCompletelySubmitted",
            leftOperand: { type: "element", value: "q8" },
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
            leftOperand: { type: "element", value: "q1" },
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
            leftOperand: { type: "element", value: "nonExistentId" },
            rightOperand: { type: "static", value: "test" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, nonExistentCondition, "default")).toBe(
        false
      );
    });
  });

  describe("Edge Cases", () => {
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
              type: "element",
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
              type: "element",
              value: "q8",
              meta: { row: "99" }, // Invalid row index
            },
            rightOperand: { type: "static", value: "1" },
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
              type: "element",
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
            leftOperand: { type: "element", value: "q7" },
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
            leftOperand: { type: "element", value: "dateQ1" },
            rightOperand: { type: "element", value: "dateQ2" },
          },
        ],
      };

      // Mock survey with date questions
      const dateSurvey: TJsWorkspaceStateSurvey = {
        ...mockSurvey,
        blocks: [
          ...mockSurvey.blocks,
          {
            id: "dateBlock",
            name: "Date Block",
            elements: [
              {
                id: "dateQ1",
                type: TSurveyElementTypeEnum.Date,
                headline: { default: "Date Question 1" },
                required: true,
                format: "d-M-y",
              },
              {
                id: "dateQ2",
                type: TSurveyElementTypeEnum.Date,
                headline: { default: "Date Question 2" },
                required: true,
                format: "d-M-y",
              },
            ],
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
            leftOperand: { type: "element", value: "dateQ1" },
            rightOperand: { type: "element", value: "dateQ2" },
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

      const multiSurvey: TJsWorkspaceStateSurvey = {
        ...mockSurvey,
        blocks: [
          ...mockSurvey.blocks,
          {
            id: "multiBlock",
            name: "Multi Choice Block",
            elements: [
              {
                id: "multiQ",
                type: TSurveyElementTypeEnum.MultipleChoiceMulti,
                headline: { default: "Multiple Choice" },
                required: true,
                choices: [
                  { id: "opt1", label: { default: "Option 1" } },
                  { id: "opt2", label: { default: "Option 2" } },
                ],
              },
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
            leftOperand: { type: "element", value: "multiValue" },
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
            leftOperand: { type: "element", value: "q1" },
            rightOperand: { type: "element", value: "multiQ" },
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
            leftOperand: { type: "element", value: "q1" },
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
            leftOperand: { type: "element", value: "q1" },
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
            leftOperand: { type: "element", value: "q1" },
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
            leftOperand: { type: "element", value: "q1" },
            rightOperand: { type: "static", value: "test answer" },
          },
        ],
      };
      expect(evaluateLogic(mockSurvey, mockData, mockVariablesData, invalidIsAnyOfCondition, "default")).toBe(
        false
      );
    });

    test("getLeftOperandValue with edge cases", () => {
      const specialSurvey: TJsWorkspaceStateSurvey = {
        ...mockSurvey,
        blocks: [
          ...mockSurvey.blocks,
          {
            id: "specialBlock",
            name: "Special Block",
            elements: [
              {
                id: "multiChoiceWithOther",
                type: TSurveyElementTypeEnum.MultipleChoiceSingle,
                headline: { default: "Multiple Choice With Other" },
                required: true,
                choices: [
                  { id: "opt1", label: { default: "Option 1" } },
                  { id: "opt2", label: { default: "Option 2" } },
                  { id: "other", label: { default: "Other" } },
                ],
              },
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
            leftOperand: { type: "element", value: "multiChoiceWithOther" },
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
            leftOperand: { type: "element", value: "multiChoiceWithOther" },
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

/**
 * ENG-1837 repointed the *definition* lookup for computed fields onto the EmbeddedData tables while
 * leaving every value expression alone. These tests pin both halves: that the inlined rows are what
 * the engine reads, and that the four deltas `resolveEmbeddedValue` documents are NOT inherited —
 * each case below flips if someone later "simplifies" a call site onto the resolver.
 */
describe("computed fields resolve through the inlined EmbeddedData rows", () => {
  const STORAGE_KEY = "var1";

  const buildSurvey = (
    variables: TSurveyVariable[],
    embeddedFields?: TJsWorkspaceStateSurvey["embeddedFields"]
  ): TJsWorkspaceStateSurvey =>
    ({
      id: "survey1",
      name: "Survey 1",
      questions: [],
      blocks: [{ id: "block1", name: "Block 1", elements: [] }],
      variables,
      embeddedFields,
      hiddenFields: { enabled: true, fieldIds: ["plan"] },
      autoClose: null,
      type: "link",
      delay: 0,
      displayLimit: 0,
      displayOption: "displayMultiple",
      displayPercentage: 0,
      recaptcha: { enabled: false, threshold: 0.5 },
      isBackButtonHidden: false,
      isAutoProgressingEnabled: false,
      segment: null,
      welcomeCard: { enabled: false, showResponseCount: false, timeToFinish: false },
      triggers: [],
      styling: null,
      status: "inProgress",
      showLanguageSwitch: false,
      languages: [],
      endings: [],
      workspaceOverwrites: null,
      recontactDays: null,
    }) as TJsWorkspaceStateSurvey;

  const computedRow = (dataType: "number" | "string", defaultValue: number | string) => [
    {
      field: { name: "score", source: "computed" as const, dataType, defaultValue, locked: false },
      link: { storageKey: STORAGE_KEY },
    },
  ];

  const equalsStatic = (value: number | string): TConditionGroup => ({
    id: "group1",
    connector: "and",
    conditions: [
      {
        id: "condition1",
        operator: "equals",
        leftOperand: { type: "variable", value: STORAGE_KEY },
        rightOperand: { type: "static", value },
      },
    ],
  });

  test("the row's dataType wins over the legacy column's", () => {
    const legacyTextVariable: TSurveyVariable[] = [
      { id: STORAGE_KEY, name: "score", type: "text", value: "" },
    ];

    // Row says number: "42" is read as the number 42 and equals the static 42.
    expect(
      evaluateLogic(
        buildSurvey(legacyTextVariable, computedRow("number", 0)),
        {},
        { [STORAGE_KEY]: "42" },
        equalsStatic(42),
        "default"
      )
    ).toBe(true);

    // Same survey without the join: the legacy column's "text" applies and "42" stays a string.
    expect(
      evaluateLogic(buildSurvey(legacyTextVariable), {}, { [STORAGE_KEY]: "42" }, equalsStatic(42), "default")
    ).toBe(false);
  });

  test("an empty row list means the survey has no computed fields, whatever the column says", () => {
    // ENG-2412 removed the fallback, so a condition naming a field the rows do not carry no longer
    // resolves off `survey.variables`. At runtime the payload always inlines the rows, so this is
    // only reachable for a survey whose rows were deleted — and then the field really is gone.
    const legacyNumberVariable: TSurveyVariable[] = [
      { id: STORAGE_KEY, name: "score", type: "number", value: 0 },
    ];

    expect(
      evaluateLogic(
        buildSurvey(legacyNumberVariable, []),
        {},
        { [STORAGE_KEY]: "42" },
        equalsStatic(42),
        "default"
      )
    ).toBe(false);
  });

  test("delta (a): a non-numeric stored value is still 0, not the declared default", () => {
    // resolveEmbeddedValue would fail coercion and fall back to defaultValue (5); logic must not.
    expect(
      evaluateLogic(
        buildSurvey([], computedRow("number", 5)),
        {},
        { [STORAGE_KEY]: "abc" },
        equalsStatic(0),
        "default"
      )
    ).toBe(true);
  });

  test('delta (a): a string field holding 0 is still "", not "0"', () => {
    expect(
      evaluateLogic(
        buildSurvey([], computedRow("string", "fallback")),
        {},
        { [STORAGE_KEY]: 0 },
        equalsStatic(""),
        "default"
      )
    ).toBe(true);
  });

  test('delta (d): a response missing the key evaluates as 0 / "", not the declared default', () => {
    expect(evaluateLogic(buildSurvey([], computedRow("number", 5)), {}, {}, equalsStatic(0), "default")).toBe(
      true
    );
    expect(
      evaluateLogic(buildSurvey([], computedRow("string", "gold")), {}, {}, equalsStatic(""), "default")
    ).toBe(true);
  });

  test("an operand pointing at no declared field resolves to undefined", () => {
    expect(
      evaluateLogic(
        buildSurvey([], computedRow("number", 0)),
        {},
        {},
        {
          id: "group1",
          connector: "and",
          conditions: [
            {
              id: "condition1",
              operator: "isSet",
              leftOperand: { type: "variable", value: "unknown_key" },
            },
          ],
        },
        "default"
      )
    ).toBe(false);
  });

  test("a number field compared against a hidden field still coerces the right operand", () => {
    const condition: TConditionGroup = {
      id: "group1",
      connector: "and",
      conditions: [
        {
          id: "condition1",
          operator: "equals",
          leftOperand: { type: "variable", value: STORAGE_KEY },
          rightOperand: { type: "hiddenField", value: "plan" },
        },
      ],
    };

    expect(
      evaluateLogic(
        buildSurvey([], computedRow("number", 0)),
        { plan: "42" },
        { [STORAGE_KEY]: 42 },
        condition,
        "default"
      )
    ).toBe(true);
  });

  /**
   * A condition can outlive the field it names: the variable is renamed or deleted, the logic rule
   * keeps the old storage key. The `dataType` read that drives the number coercion runs BEFORE the
   * operator switch, so an unguarded `undefined` throws there — and `evaluateSingleCondition`'s
   * try/catch turns that into a silent `false` rather than a visible crash, quietly sending the
   * respondent down the wrong branch. These assert the evaluated RESULT, not the absence of a throw,
   * precisely because the catch would hide one.
   */
  describe("a condition naming a field the survey no longer declares", () => {
    const staleOperand = (operator: TSingleCondition["operator"]): TConditionGroup => ({
      id: "group1",
      connector: "and",
      conditions: [
        {
          id: "condition1",
          operator,
          leftOperand: { type: "variable", value: "storage_key_of_a_deleted_variable" },
          rightOperand: { type: "hiddenField", value: "plan" },
        },
      ],
    });

    test("evaluates on its own merits instead of collapsing to false", () => {
      // The left operand resolves to no value, so `isNotSet` is genuinely true. Without the guard the
      // `.dataType` read throws first and the catch returns false.
      expect(
        evaluateLogic(
          buildSurvey([], computedRow("number", 0)),
          { plan: "42" },
          {},
          staleOperand("isNotSet"),
          "default"
        )
      ).toBe(true);
    });

    test("does not coerce the right operand, since the left operand's type is unknown", () => {
      // `isSet` on an unresolvable left operand is false either way; the point is that it is false by
      // evaluating, not by throwing — paired with the case above, which would flip.
      expect(
        evaluateLogic(
          buildSurvey([], computedRow("number", 0)),
          { plan: "42" },
          {},
          staleOperand("isSet"),
          "default"
        )
      ).toBe(false);
    });
  });

  describe("performCalculation", () => {
    const calculate = (
      survey: TJsWorkspaceStateSurvey,
      action: TSurveyBlockLogicAction,
      data: TResponseData,
      calculations: TResponseVariables
    ) => performActions(survey, [action], data, calculations).calculations;

    test('seeds an unset number field from 0 and a string field from ""', () => {
      expect(
        calculate(
          buildSurvey([], computedRow("number", 5)),
          {
            id: "a1",
            objective: "calculate",
            variableId: STORAGE_KEY,
            operator: "add",
            value: { type: "static", value: 3 },
          },
          {},
          {}
        )
      ).toEqual({ [STORAGE_KEY]: 3 });

      expect(
        calculate(
          buildSurvey([], computedRow("string", "gold")),
          {
            id: "a1",
            objective: "calculate",
            variableId: STORAGE_KEY,
            operator: "concat",
            value: { type: "static", value: "x" },
          },
          {},
          {}
        )
      ).toEqual({ [STORAGE_KEY]: "x" });
    });

    test("a calculation on a field the survey does not declare is skipped", () => {
      expect(
        calculate(
          buildSurvey([], computedRow("number", 0)),
          {
            id: "a1",
            objective: "calculate",
            variableId: "unknown_key",
            operator: "add",
            value: { type: "static", value: 3 },
          },
          {},
          {}
        )
      ).toEqual({});
    });

    test('a legacy "question" operand stays unresolved', () => {
      expect(
        calculate(
          buildSurvey([], computedRow("number", 0)),
          {
            id: "a1",
            objective: "calculate",
            variableId: STORAGE_KEY,
            operator: "add",
            // Admitted at the type level by ZDynamicLogicFieldValueDeprecated; normalized to
            // "element" at the API boundary, so the engines deliberately leave it unresolved.
            value: { type: "question", value: "q1" },
          } as unknown as TSurveyBlockLogicAction,
          { q1: 3 },
          {}
        )
      ).toEqual({});
    });
  });
});

describe("reserved field operands (ENG-1840)", () => {
  const buildSurvey = (): TJsWorkspaceStateSurvey =>
    ({
      id: "survey1",
      name: "Survey 1",
      questions: [],
      blocks: [{ id: "block1", name: "Block 1", elements: [] }],
      variables: [],
      embeddedFields: [],
      hiddenFields: { enabled: true, fieldIds: [] },
      autoClose: null,
      type: "link",
      delay: 0,
      displayLimit: 0,
      displayOption: "displayMultiple",
      displayPercentage: 0,
      recaptcha: { enabled: false, threshold: 0.5 },
      isBackButtonHidden: false,
      isAutoProgressingEnabled: false,
      segment: null,
      welcomeCard: { enabled: false, showResponseCount: false, timeToFinish: false },
      triggers: [],
      styling: null,
      status: "inProgress",
      showLanguageSwitch: false,
      languages: [],
      endings: [],
      workspaceOverwrites: null,
      recontactDays: null,
    }) as TJsWorkspaceStateSurvey;

  const reservedCondition = (
    name: string,
    operator: TSingleCondition["operator"],
    rightOperand?: TSingleCondition["rightOperand"]
  ): TConditionGroup => ({
    id: "group1",
    connector: "and",
    conditions: [
      { id: "condition1", operator, leftOperand: { type: "reserved", value: name }, rightOperand },
    ],
  });

  const evaluate = (conditions: TConditionGroup, embeddedValues: TResponseData): boolean =>
    evaluateLogic(buildSurvey(), {}, {}, conditions, "default", embeddedValues);

  test("a number-typed variable compared against a NUMBER reserved right operand coerces", () => {
    // Red before ENG-2538: the pre-switch coercion arm listed `hiddenField` only, so a reserved value
    // — always `string | number` in the projected map — reached the comparison unconverted and a
    // number variable could never match one. The picker filters reserved right operands by
    // `dataType`, so this operand shape is reachable from the editor. Both engines carried the same
    // arm; `apps/web/lib/surveyLogic/utils.test.ts` pins the server twin.
    const numberVariableSurvey = {
      ...buildSurvey(),
      variables: [{ id: "var_duration", name: "duration", type: "number", value: 150 }],
      embeddedFields: [
        {
          field: { name: "duration", source: "computed", dataType: "number" },
          link: { storageKey: "var_duration" },
        },
      ],
    } as unknown as TJsWorkspaceStateSurvey;

    const conditions: TConditionGroup = {
      id: "group1",
      connector: "and",
      conditions: [
        {
          id: "condition1",
          operator: "equals",
          leftOperand: { type: "variable", value: "var_duration" },
          rightOperand: { type: "reserved", value: "durationSeconds" },
        },
      ],
    };

    expect(
      evaluateLogic(numberVariableSurvey, {}, { var_duration: 150 }, conditions, "default", {
        durationSeconds: "150",
      })
    ).toBe(true);
  });

  test("a reserved left operand evaluates against the projected value", () => {
    const values = { country: "DE" };

    expect(evaluate(reservedCondition("country", "equals", { type: "static", value: "DE" }), values)).toBe(
      true
    );
    expect(evaluate(reservedCondition("country", "equals", { type: "static", value: "FR" }), values)).toBe(
      false
    );
    expect(evaluate(reservedCondition("country", "isSet"), values)).toBe(true);
  });

  test("a server-only field is unset mid-survey — not 0, not empty string", () => {
    // `projectClientReservedValues` filters these out entirely, so the map has no key at all. The
    // distinction matters: `durationSeconds` reading as 0 would make "< 60" silently true for every
    // respondent, and `country` reading as "" would make "does not equal DE" true.
    const midSurveyValues: TResponseData = {};

    expect(evaluate(reservedCondition("durationSeconds", "isSet"), midSurveyValues)).toBe(false);
    expect(evaluate(reservedCondition("durationSeconds", "isNotSet"), midSurveyValues)).toBe(true);
    expect(
      evaluate(
        reservedCondition("durationSeconds", "isLessThan", { type: "static", value: 60 }),
        midSurveyValues
      )
    ).toBe(false);
    expect(
      evaluate(reservedCondition("country", "equals", { type: "static", value: "" }), midSurveyValues)
    ).toBe(false);
  });

  test("an unset reserved field behaves exactly like an unset hidden field", () => {
    // Pinning the parity rather than inventing a rule for reserved fields: `doesNotEqual` falls
    // through to `leftValue !== rightValue`, so BOTH report true when the value is absent. The arm
    // this ticket adds resolves the value; it deliberately does not change operator semantics.
    const survey = buildSurvey();
    const rightOperand = { type: "static" as const, value: "DE" };

    const reservedResult = evaluateLogic(
      survey,
      {},
      {},
      reservedCondition("country", "doesNotEqual", rightOperand),
      "default",
      {}
    );
    const hiddenFieldResult = evaluateLogic(
      survey,
      {},
      {},
      {
        id: "group1",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            operator: "doesNotEqual",
            leftOperand: { type: "hiddenField", value: "country" },
            rightOperand,
          },
        ],
      },
      "default",
      {}
    );

    expect(reservedResult).toBe(hiddenFieldResult);
  });

  test("an unknown reserved name resolves to undefined rather than throwing", () => {
    expect(evaluate(reservedCondition("notACatalogEntry", "isSet"), { url: "https://x.test" })).toBe(false);
    expect(evaluate(reservedCondition("notACatalogEntry", "equals", { type: "static", value: "" }), {})).toBe(
      false
    );
  });

  test("a reserved right operand reads the same map", () => {
    const values = { source: "link", action: "link" };
    const sameSource: TConditionGroup = {
      id: "group1",
      connector: "and",
      conditions: [
        {
          id: "condition1",
          operator: "equals",
          leftOperand: { type: "reserved", value: "source" },
          rightOperand: { type: "reserved", value: "action" },
        },
      ],
    };

    expect(evaluate(sameSource, values)).toBe(true);
    expect(evaluate(sameSource, { source: "link", action: "app" })).toBe(false);
  });

  test("omitting the map keeps every reserved operand unset (already-deployed callers)", () => {
    expect(evaluateLogic(buildSurvey(), {}, {}, reservedCondition("url", "isSet"), "default")).toBe(false);
  });
});
