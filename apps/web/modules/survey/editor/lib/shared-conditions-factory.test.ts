import { createId } from "@paralleldrive/cuid2";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurveyQuotaLogic } from "@formbricks/types/quota";
import {
  TConditionGroup,
  TSingleCondition,
  TSurvey,
  TSurveyLogicConditionsOperator,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import {
  ConditionsUpdateCallbacks,
  SharedConditionsFactoryParams,
  TQuotaConditionGroup,
  createSharedConditionsFactory,
  genericConditionsToQuota,
  quotaConditionsToGeneric,
} from "./shared-conditions-factory";

// Mock dependencies
vi.mock("@/lib/surveyLogic/utils", () => ({
  addConditionBelow: vi.fn((conditions, _resourceId, newCondition) => {
    // Mock implementation that adds condition
    conditions.conditions.push(newCondition);
  }),
  createGroupFromResource: vi.fn((conditions, resourceId) => {
    // Mock implementation that creates a group
    const conditionIndex = conditions.conditions.findIndex((c: any) => c.id === resourceId);
    if (conditionIndex !== -1) {
      const condition = conditions.conditions[conditionIndex];
      const newGroup = {
        id: "new-group-id",
        connector: "and" as const,
        conditions: [condition],
      };
      conditions.conditions[conditionIndex] = newGroup;
    }
  }),
  duplicateCondition: vi.fn((conditions, resourceId) => {
    // Mock implementation that duplicates condition
    const conditionIndex = conditions.conditions.findIndex((c: any) => c.id === resourceId);
    if (conditionIndex !== -1) {
      const condition = conditions.conditions[conditionIndex];
      const duplicated = { ...condition, id: "duplicated-id" };
      conditions.conditions.splice(conditionIndex + 1, 0, duplicated);
    }
  }),
  removeCondition: vi.fn((conditions, resourceId) => {
    // Mock implementation that removes condition
    conditions.conditions = conditions.conditions.filter((c: any) => c.id !== resourceId);
  }),
  toggleGroupConnector: vi.fn((conditions, groupId) => {
    // Mock implementation that toggles connector
    const group = conditions.conditions.find((c: any) => c.id === groupId);
    if (group?.connector) {
      group.connector = group.connector === "and" ? "or" : "and";
    }
  }),
  updateCondition: vi.fn((conditions, resourceId, updates) => {
    // Mock implementation that updates condition
    const conditionIndex = conditions.conditions.findIndex((c: any) => c.id === resourceId);
    if (conditionIndex !== -1) {
      conditions.conditions[conditionIndex] = {
        ...conditions.conditions[conditionIndex],
        ...updates,
      };
    }
  }),
}));

vi.mock("@/modules/survey/editor/lib/utils", () => ({
  getConditionValueOptions: vi.fn().mockReturnValue([
    { value: "question1", label: "Question 1", type: "question" },
    { value: "variable1", label: "Variable 1", type: "variable" },
  ]),
  getConditionOperatorOptions: vi.fn().mockReturnValue([
    { value: "equals", label: "equals" },
    { value: "notEquals", label: "not equals" },
    { value: "isEmpty", label: "is empty" },
  ]),
  getMatchValueProps: vi.fn().mockReturnValue({
    type: "text",
    placeholder: "Enter value",
  }),
  getFormatLeftOperandValue: vi.fn().mockReturnValue("Formatted value"),
  getQuestionOperatorOptions: vi.fn().mockReturnValue([
    { value: "equals", label: "equals" },
    { value: "notEquals", label: "not equals" },
    { value: "isEmpty", label: "is empty" },
  ]),
  getDefaultOperatorForQuestion: vi.fn().mockReturnValue("equals"),
}));

vi.mock("@paralleldrive/cuid2", () => ({
  createId: vi.fn(() => "mock-id"),
}));

describe("shared-conditions-factory", () => {
  // Mock data
  const mockSurvey: TSurvey = {
    id: "survey1",
    name: "Test Survey",
    type: "app",
    questions: [
      {
        id: "question1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Question 1" },
        required: false,
        inputType: "text",
        charLimit: { enabled: false },
      },
      {
        id: "matrix-question",
        type: TSurveyQuestionTypeEnum.Matrix,
        headline: { default: "Matrix Question" },
        required: false,
        shuffleOption: "none",
        rows: [
          { id: "row1", label: { default: "Row 1" } },
          { id: "row2", label: { default: "Row 2" } },
        ],
        columns: [
          { id: "col1", label: { default: "Column 1" } },
          { id: "col2", label: { default: "Column 2" } },
        ],
      },
    ],
    variables: [],

    styling: {},
    triggers: [],
    welcomeCard: { enabled: false, timeToFinish: false, showResponseCount: false },

    hiddenFields: { enabled: false },
    displayOption: "displayOnce",
    recontactDays: null,
    displayLimit: null,
    autoClose: null,
    runOnDate: null,
    closeOnDate: null,
    delay: 0,
    autoComplete: null,

    languages: [],
    showLanguageSwitch: null,
    status: "draft",
    createdAt: new Date(),
    updatedAt: new Date(),
    environmentId: "env1",
    createdBy: null,
    segment: null,
    pin: null,
    endings: [],
    followUps: [],
    projectOverwrites: null,
    displayPercentage: null,
  } as unknown as TSurvey;

  const mockT = vi.fn().mockImplementation((key: string) => key);
  const mockGetDefaultOperator = vi.fn((): TSurveyLogicConditionsOperator => "equals");

  const mockConditionsChange = vi.fn();

  const defaultParams: SharedConditionsFactoryParams = {
    survey: mockSurvey,
    t: mockT,
    getDefaultOperator: mockGetDefaultOperator,
  };

  const defaultCallbacks: ConditionsUpdateCallbacks = {
    onConditionsChange: mockConditionsChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createSharedConditionsFactory", () => {
    test("should create config and callbacks without questionIdx", () => {
      const result = createSharedConditionsFactory(defaultParams, defaultCallbacks);

      expect(result).toHaveProperty("config");
      expect(result).toHaveProperty("callbacks");
      expect(result.config).toHaveProperty("getLeftOperandOptions");
      expect(result.config).toHaveProperty("getOperatorOptions");
      expect(result.config).toHaveProperty("getValueProps");
      expect(result.config).toHaveProperty("getDefaultOperator");
      expect(result.config).toHaveProperty("formatLeftOperandValue");
    });

    test("should create config and callbacks with questionIdx", () => {
      const paramsWithQuestionIdx = {
        ...defaultParams,
        questionIdx: 0,
      };
      const result = createSharedConditionsFactory(paramsWithQuestionIdx, defaultCallbacks);

      expect(result).toHaveProperty("config");
      expect(result).toHaveProperty("callbacks");
    });

    test("should include onCreateGroup callback when includeCreateGroup is true", () => {
      const paramsWithCreateGroup = {
        ...defaultParams,
        includeCreateGroup: true,
      };
      const result = createSharedConditionsFactory(paramsWithCreateGroup, defaultCallbacks);

      expect(result.callbacks).toHaveProperty("onCreateGroup");
      expect(typeof result.callbacks.onCreateGroup).toBe("function");
    });

    test("should not include onCreateGroup callback when includeCreateGroup is false", () => {
      const paramsWithoutCreateGroup = {
        ...defaultParams,
        includeCreateGroup: false,
      };
      const result = createSharedConditionsFactory(paramsWithoutCreateGroup, defaultCallbacks);

      expect(result.callbacks).not.toHaveProperty("onCreateGroup");
    });

    test("should not include onCreateGroup callback by default", () => {
      const result = createSharedConditionsFactory(defaultParams, defaultCallbacks);

      expect(result.callbacks).not.toHaveProperty("onCreateGroup");
    });
  });

  describe("config object", () => {
    test("should call getConditionValueOptions without questionIdx", async () => {
      const result = createSharedConditionsFactory(defaultParams, defaultCallbacks);

      result.config.getLeftOperandOptions();

      const { getConditionValueOptions } = await import("@/modules/survey/editor/lib/utils");
      expect(getConditionValueOptions).toHaveBeenCalledWith(mockSurvey, mockT);
    });

    test("should call getConditionValueOptions with questionIdx", async () => {
      const paramsWithQuestionIdx = {
        ...defaultParams,
        questionIdx: 0,
      };
      const result = createSharedConditionsFactory(paramsWithQuestionIdx, defaultCallbacks);

      result.config.getLeftOperandOptions();

      const { getConditionValueOptions } = await import("@/modules/survey/editor/lib/utils");
      expect(getConditionValueOptions).toHaveBeenCalledWith(mockSurvey, mockT, 0);
    });

    test("should call getMatchValueProps without questionIdx", async () => {
      const result = createSharedConditionsFactory(defaultParams, defaultCallbacks);
      const mockCondition: TSingleCondition = {
        id: "condition1",
        leftOperand: { value: "question1", type: "question" },
        operator: "equals",
      };

      result.config.getValueProps(mockCondition);

      const { getMatchValueProps } = await import("@/modules/survey/editor/lib/utils");
      expect(getMatchValueProps).toHaveBeenCalledWith(mockCondition, mockSurvey, mockT);
    });

    test("should call getMatchValueProps with questionIdx", async () => {
      const paramsWithQuestionIdx = {
        ...defaultParams,
        questionIdx: 0,
      };
      const result = createSharedConditionsFactory(paramsWithQuestionIdx, defaultCallbacks);
      const mockCondition: TSingleCondition = {
        id: "condition1",
        leftOperand: { value: "question1", type: "question" },
        operator: "equals",
      };

      result.config.getValueProps(mockCondition);

      const { getMatchValueProps } = await import("@/modules/survey/editor/lib/utils");
      expect(getMatchValueProps).toHaveBeenCalledWith(mockCondition, mockSurvey, mockT, 0);
    });

    test("should return default operator", () => {
      const result = createSharedConditionsFactory(defaultParams, defaultCallbacks);

      const operator = result.config.getDefaultOperator();

      expect(operator).toBe("equals");
      expect(mockGetDefaultOperator).toHaveBeenCalled();
    });

    test("should format left operand value", async () => {
      const { getFormatLeftOperandValue } = await import("@/modules/survey/editor/lib/utils");
      const mockGetFormatLeftOperandValue = vi.mocked(getFormatLeftOperandValue);
      mockGetFormatLeftOperandValue.mockReturnValue("Formatted value");

      const result = createSharedConditionsFactory(defaultParams, defaultCallbacks);
      const mockCondition: TSingleCondition = {
        id: "condition1",
        leftOperand: { value: "question1", type: "question" },
        operator: "equals",
      };

      const formatted = result.config.formatLeftOperandValue(mockCondition);

      expect(mockGetFormatLeftOperandValue).toHaveBeenCalledWith(mockCondition, mockSurvey);
      expect(formatted).toBe("Formatted value");
    });
  });

  describe("callback functions", () => {
    test("onAddConditionBelow should add new condition", () => {
      const result = createSharedConditionsFactory(defaultParams, defaultCallbacks);
      const resourceId = "condition1";

      result.callbacks.onAddConditionBelow(resourceId);

      expect(mockConditionsChange).toHaveBeenCalledWith(expect.any(Function));
      expect(createId).toHaveBeenCalled();
    });

    test("onRemoveCondition should remove condition", () => {
      const result = createSharedConditionsFactory(defaultParams, defaultCallbacks);
      const resourceId = "condition1";

      result.callbacks.onRemoveCondition(resourceId);

      expect(mockConditionsChange).toHaveBeenCalledWith(expect.any(Function));
    });

    test("onDuplicateCondition should duplicate condition", () => {
      const result = createSharedConditionsFactory(defaultParams, defaultCallbacks);
      const resourceId = "condition1";

      result.callbacks.onDuplicateCondition(resourceId);

      expect(mockConditionsChange).toHaveBeenCalledWith(expect.any(Function));
    });

    test("onUpdateCondition should update condition normally", () => {
      const result = createSharedConditionsFactory(defaultParams, defaultCallbacks);
      const resourceId = "condition1";
      const updates = {
        operator: "doesNotEqual" as TSurveyLogicConditionsOperator,
      };

      result.callbacks.onUpdateCondition(resourceId, updates);

      expect(mockConditionsChange).toHaveBeenCalledWith(expect.any(Function));
    });

    test("onToggleGroupConnector should toggle group connector", () => {
      const result = createSharedConditionsFactory(defaultParams, defaultCallbacks);
      const groupId = "group1";

      result.callbacks.onToggleGroupConnector(groupId);

      expect(mockConditionsChange).toHaveBeenCalledWith(expect.any(Function));
    });

    test("onCreateGroup should create group when includeCreateGroup is true", () => {
      const paramsWithCreateGroup = {
        ...defaultParams,
        includeCreateGroup: true,
      };
      const result = createSharedConditionsFactory(paramsWithCreateGroup, defaultCallbacks);
      const resourceId = "condition1";

      result.callbacks.onCreateGroup!(resourceId);

      expect(mockConditionsChange).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe("matrix question handling", () => {
    test("should handle matrix question update with row selection", () => {
      const result = createSharedConditionsFactory(defaultParams, defaultCallbacks);
      const resourceId = "condition1";
      const updates = {
        leftOperand: {
          value: "matrix-question.row1",
          type: "question" as const,
          meta: {
            type: "question" as const,
          },
        },
      };

      result.callbacks.onUpdateCondition(resourceId, updates);

      expect(mockConditionsChange).toHaveBeenCalledWith(expect.any(Function));
      const updater = mockConditionsChange.mock.calls[0][0] as (c: TConditionGroup) => TConditionGroup;
      const initial: TConditionGroup = {
        id: "root",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            leftOperand: { value: "matrix-question", type: "question" },
            operator: "equals",
            rightOperand: { value: "x", type: "static" },
          } as TSingleCondition,
        ],
      };
      const updated = updater(structuredClone(initial));
      expect(updated.conditions[0]).toMatchObject({
        operator: "isEmpty",
        leftOperand: { value: "matrix-question", type: "question", meta: { row: "row1" } },
        rightOperand: undefined,
      });
    });

    test("should not handle non-matrix question update", () => {
      const result = createSharedConditionsFactory(defaultParams, defaultCallbacks);
      const resourceId = "condition1";
      const updates = {
        leftOperand: {
          value: "question1",
          type: "question" as const,
          meta: {
            type: "question" as const,
          },
        },
      };

      result.callbacks.onUpdateCondition(resourceId, updates);

      expect(mockConditionsChange).toHaveBeenCalledWith(expect.any(Function));
    });

    test("should not handle matrix question without row", () => {
      const result = createSharedConditionsFactory(defaultParams, defaultCallbacks);
      const resourceId = "condition1";
      const updates = {
        leftOperand: {
          value: "matrix-question",
          type: "question" as const,
          meta: {
            type: "question" as const,
          },
        },
      };

      result.callbacks.onUpdateCondition(resourceId, updates);

      expect(mockConditionsChange).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe("quotaConditionsToGeneric", () => {
    test("should convert quota conditions to generic format", () => {
      const quotaConditions: TSurveyQuotaLogic = {
        connector: "and",
        conditions: [
          {
            id: "condition1",
            leftOperand: { value: "question1", type: "question" },
            operator: "equals",
            rightOperand: { value: "test", type: "static" },
          },
          {
            id: "condition2",
            leftOperand: { value: "question2", type: "question" },
            operator: "doesNotEqual",
            rightOperand: { value: "test2", type: "static" },
          },
        ],
      };

      const result = quotaConditionsToGeneric(quotaConditions);

      expect(result).toEqual({
        id: "root",
        connector: "and",
        conditions: quotaConditions.conditions,
      });
    });

    test("should handle empty criteria", () => {
      const quotaConditions: TSurveyQuotaLogic = {
        connector: "or",
        conditions: [],
      };

      const result = quotaConditionsToGeneric(quotaConditions);

      expect(result).toEqual({
        id: "root",
        connector: "or",
        conditions: [],
      });
    });
  });

  describe("genericConditionsToQuota", () => {
    test("should convert generic conditions to quota format", () => {
      const genericConditions: TQuotaConditionGroup = {
        id: "root",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            leftOperand: { value: "question1", type: "question" },
            operator: "equals",
            rightOperand: { value: "test", type: "static" },
          },
          {
            id: "condition2",
            leftOperand: {
              value: "matrix-question",
              type: "question",
              meta: { row: "row1" },
            },
            operator: "isEmpty",
          },
        ],
      };

      const result = genericConditionsToQuota(genericConditions);

      expect(result).toEqual({
        connector: "and",
        conditions: [
          {
            id: "condition1",
            leftOperand: { value: "question1", type: "question" },
            operator: "equals",
            rightOperand: { value: "test", type: "static" },
          },
          {
            id: "condition2",
            leftOperand: {
              value: "matrix-question",
              type: "question",
              meta: { row: "row1" },
            },
            operator: "isEmpty",
          },
        ],
      });
    });

    test("should handle conditions without meta", () => {
      const genericConditions: TQuotaConditionGroup = {
        id: "root",
        connector: "or",
        conditions: [
          {
            id: "condition1",
            leftOperand: { value: "variable1", type: "variable" },
            operator: "equals",
            rightOperand: { value: "test", type: "static" },
          },
        ],
      };

      const result = genericConditionsToQuota(genericConditions);

      expect(result).toEqual({
        connector: "or",
        conditions: [
          {
            id: "condition1",
            leftOperand: { value: "variable1", type: "variable" },
            operator: "equals",
            rightOperand: { value: "test", type: "static" },
          },
        ],
      });
    });

    test("should handle empty conditions", () => {
      const genericConditions: TQuotaConditionGroup = {
        id: "root",
        connector: "and",
        conditions: [],
      };

      const result = genericConditionsToQuota(genericConditions);

      expect(result).toEqual({
        connector: "and",
        conditions: [],
      });
    });

    test("should preserve meta for question type conditions", () => {
      const genericConditions: TQuotaConditionGroup = {
        id: "root",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            leftOperand: {
              value: "question1",
              type: "question" as const,
              meta: { row: "row1", column: "col1" },
            },
            operator: "equals",
            rightOperand: { value: "test", type: "static" },
          },
        ],
      };

      const result = genericConditionsToQuota(genericConditions);

      expect(result.conditions[0].leftOperand).toHaveProperty("meta");
      if (result.conditions[0].leftOperand.type === "question") {
        expect(result.conditions[0].leftOperand.meta).toEqual({ row: "row1", column: "col1" });
      }
    });
  });

  describe("integration tests", () => {
    test("should handle complete workflow", () => {
      const result = createSharedConditionsFactory(defaultParams, defaultCallbacks);

      // Test adding a condition
      result.callbacks.onAddConditionBelow("condition1");
      expect(mockConditionsChange).toHaveBeenCalled();

      // Test updating a condition
      result.callbacks.onUpdateCondition("condition1", {
        operator: "doesNotEqual",
      });
      expect(mockConditionsChange).toHaveBeenCalledTimes(2);

      // Test duplicating a condition
      result.callbacks.onDuplicateCondition("condition1");
      expect(mockConditionsChange).toHaveBeenCalledTimes(3);

      // Test removing a condition
      result.callbacks.onRemoveCondition("condition1");
      expect(mockConditionsChange).toHaveBeenCalledTimes(4);
    });

    test("should handle quota conditions round-trip conversion", () => {
      const originalQuota: TSurveyQuotaLogic = {
        connector: "and",
        conditions: [
          {
            id: "condition1",
            leftOperand: { value: "question1", type: "question" },
            operator: "equals",
            rightOperand: { value: "test", type: "static" },
          },
        ],
      };

      const generic = quotaConditionsToGeneric(originalQuota);
      const converted = genericConditionsToQuota(generic);

      expect(converted).toEqual(originalQuota);
    });
  });
});
