import {
  getConditionOperatorOptions,
  getConditionValueOptions,
  getFormatLeftOperandValue,
  getMatchValueProps,
} from "@/modules/survey/editor/lib/utils";
import { createId } from "@paralleldrive/cuid2";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TSurveyQuotaConditions } from "@formbricks/types/quota";
import { TSingleCondition, TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import {
  TQuotaConditionGroup,
  createQuotaConditionsCallbacks,
  createQuotaConditionsConfig,
  genericConditionsToQuota,
  quotaConditionsToGeneric,
} from "./conditions-config";

// Mock dependencies
vi.mock("@/modules/survey/editor/lib/utils", () => ({
  getConditionValueOptions: vi.fn(),
  getConditionOperatorOptions: vi.fn(),
  getMatchValueProps: vi.fn(),
  getFormatLeftOperandValue: vi.fn(),
}));

vi.mock("@paralleldrive/cuid2", () => ({
  createId: vi.fn(),
}));

describe("Quota Conditions Config", () => {
  const mockT = vi.fn((key: string) => key);

  const mockSurvey: TSurvey = {
    id: "survey123",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Test Survey",
    status: "draft",
    environmentId: "env123",
    type: "app",
    welcomeCard: { enabled: false },
    questions: [
      {
        id: "question1",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        headline: { default: "What's your favorite color?" },
        required: false,
        choices: [
          { id: "choice1", label: { default: "Red" } },
          { id: "choice2", label: { default: "Blue" } },
        ],
      },
      {
        id: "question2",
        type: TSurveyQuestionTypeEnum.Rating,
        headline: { default: "Rate this product" },
        required: false,
        scale: "number",
        range: 5,
      },
    ],
    variables: [{ id: "var1", name: "userType", type: "text" }],
    hiddenFields: { enabled: true, fieldIds: ["userId", "source"] },
    endings: [],
    autoClose: null,
    closeOnDate: null,
    delay: 0,
    displayOption: "displayOnce",
    recontactDays: null,
    displayLimit: null,
    runOnDate: null,
  } as TSurvey;

  beforeEach(() => {
    vi.mocked(createId).mockReturnValue("new-id");
    vi.mocked(getConditionValueOptions).mockReturnValue([]);
    vi.mocked(getConditionOperatorOptions).mockReturnValue([]);
    vi.mocked(getMatchValueProps).mockReturnValue({});
    vi.mocked(getFormatLeftOperandValue).mockReturnValue("formatted-value");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createQuotaConditionsConfig", () => {
    test("should create config with correct functions", () => {
      const config = createQuotaConditionsConfig(mockSurvey, mockT);

      expect(config).toHaveProperty("getLeftOperandOptions");
      expect(config).toHaveProperty("getOperatorOptions");
      expect(config).toHaveProperty("getValueProps");
      expect(config).toHaveProperty("getDefaultOperator");
      expect(config).toHaveProperty("formatLeftOperandValue");
    });

    test("should call getConditionValueOptions when getLeftOperandOptions is called", () => {
      const config = createQuotaConditionsConfig(mockSurvey, mockT);

      config.getLeftOperandOptions();

      expect(getConditionValueOptions).toHaveBeenCalledWith(mockSurvey, mockT);
    });

    test("should call getConditionOperatorOptions when getOperatorOptions is called", () => {
      const config = createQuotaConditionsConfig(mockSurvey, mockT);
      const mockCondition: TSingleCondition = {
        id: "condition1",
        leftOperand: { type: "question", value: "question1" },
        operator: "equals",
      };

      config.getOperatorOptions(mockCondition);

      expect(getConditionOperatorOptions).toHaveBeenCalledWith(mockCondition, mockSurvey, mockT);
    });

    test("should return 'equals' as default operator", () => {
      const config = createQuotaConditionsConfig(mockSurvey, mockT);

      expect(config.getDefaultOperator()).toBe("equals");
    });

    test("should call getFormatLeftOperandValue when formatLeftOperandValue is called", () => {
      const config = createQuotaConditionsConfig(mockSurvey, mockT);
      const mockCondition: TSingleCondition = {
        id: "condition1",
        leftOperand: { type: "question", value: "question1" },
        operator: "equals",
      };

      config.formatLeftOperandValue(mockCondition);

      expect(getFormatLeftOperandValue).toHaveBeenCalledWith(mockCondition, mockSurvey);
    });
  });

  describe("quotaConditionsToGeneric", () => {
    test("should convert quota conditions to generic format", () => {
      const quotaConditions: TSurveyQuotaConditions = {
        connector: "and",
        criteria: [
          {
            id: "condition1",
            leftOperand: { type: "question", value: "question1" },
            operator: "equals",
            rightOperand: { type: "static", value: "choice1" },
          },
        ],
      };

      const result = quotaConditionsToGeneric(quotaConditions, mockSurvey);

      expect(result).toEqual({
        id: "root",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            leftOperand: {
              value: "question1",
              type: "question",
              meta: {
                type: "question",
                questionType: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
                choices: [
                  { id: "choice1", label: { default: "Red" } },
                  { id: "choice2", label: { default: "Blue" } },
                ],
              },
            },
            operator: "equals",
            rightOperand: {
              value: "choice1",
              type: "static",
            },
          },
        ],
      });
    });

    test("should handle variable type leftOperand", () => {
      const quotaConditions: TSurveyQuotaConditions = {
        connector: "or",
        criteria: [
          {
            id: "condition1",
            leftOperand: { type: "variable", value: "userType" },
            operator: "equals",
            rightOperand: { type: "static", value: "premium" },
          },
        ],
      };

      const result = quotaConditionsToGeneric(quotaConditions, mockSurvey);

      expect(result.conditions[0].leftOperand.meta).toEqual({ type: "variable" });
    });

    test("should handle hiddenField type leftOperand", () => {
      const quotaConditions: TSurveyQuotaConditions = {
        connector: "and",
        criteria: [
          {
            id: "condition1",
            leftOperand: { type: "hiddenField", value: "userId" },
            operator: "equals",
            rightOperand: { type: "static", value: "123" },
          },
        ],
      };

      const result = quotaConditionsToGeneric(quotaConditions, mockSurvey);

      expect(result.conditions[0].leftOperand.meta).toEqual({ type: "hiddenField" });
    });

    test("should handle array rightOperand values", () => {
      const quotaConditions: TSurveyQuotaConditions = {
        connector: "and",
        criteria: [
          {
            id: "condition1",
            leftOperand: { type: "question", value: "question1" },
            operator: "includesAny",
            rightOperand: { type: "static", value: ["choice1", "choice2"] },
          },
        ],
      };

      const result = quotaConditionsToGeneric(quotaConditions, mockSurvey);

      expect(result.conditions[0].rightOperand?.value).toEqual(["choice1", "choice2"]);
    });

    test("should handle null rightOperand", () => {
      const quotaConditions: TSurveyQuotaConditions = {
        connector: "and",
        criteria: [
          {
            id: "condition1",
            leftOperand: { type: "question", value: "question1" },
            operator: "isSubmitted",
          },
        ],
      };

      const result = quotaConditionsToGeneric(quotaConditions, mockSurvey);

      expect(result.conditions[0].rightOperand).toBeUndefined();
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
            leftOperand: {
              value: "question1",
              type: "question",
              meta: { type: "question" },
            },
            operator: "equals",
            rightOperand: {
              value: "choice1",
              type: "static",
            },
          },
        ],
      };

      const result = genericConditionsToQuota(genericConditions);

      expect(result).toEqual({
        connector: "and",
        criteria: [
          {
            id: "condition1",
            leftOperand: { type: "question", value: "question1" },
            operator: "equals",
            rightOperand: { type: "static", value: "choice1" },
          },
        ],
      });
    });

    test("should convert numeric string to number", () => {
      const genericConditions: TQuotaConditionGroup = {
        id: "root",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            leftOperand: {
              value: "question2",
              type: "question",
              meta: { type: "question" },
            },
            operator: "equals",
            rightOperand: {
              value: "5",
              type: "static",
            },
          },
        ],
      };

      const result = genericConditionsToQuota(genericConditions);

      expect(result.criteria[0].rightOperand?.value).toBe(5);
    });

    test("should keep string arrays as arrays", () => {
      const genericConditions: TQuotaConditionGroup = {
        id: "root",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            leftOperand: {
              value: "question1",
              type: "question",
              meta: { type: "question" },
            },
            operator: "includesAny",
            rightOperand: {
              value: ["choice1", "choice2"],
              type: "static",
            },
          },
        ],
      };

      const result = genericConditionsToQuota(genericConditions);

      expect(result.criteria[0].rightOperand?.value).toEqual(["choice1", "choice2"]);
    });

    test("should handle null rightOperand", () => {
      const genericConditions: TQuotaConditionGroup = {
        id: "root",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            leftOperand: {
              value: "question1",
              type: "question",
              meta: { type: "question" },
            },
            operator: "isSubmitted",
          },
        ],
      };

      const result = genericConditionsToQuota(genericConditions);

      expect(result.criteria[0].rightOperand).toBeUndefined();
    });

    test("should flatten nested groups", () => {
      const genericConditions: TQuotaConditionGroup = {
        id: "root",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            leftOperand: {
              value: "question1",
              type: "question",
              meta: { type: "question" },
            },
            operator: "equals",
            rightOperand: {
              value: "choice1",
              type: "static",
            },
          },
          {
            id: "group1",
            connector: "or",
            conditions: [
              {
                id: "condition2",
                leftOperand: {
                  value: "question2",
                  type: "question",
                  meta: { type: "question" },
                },
                operator: "equals",
                rightOperand: {
                  value: "3",
                  type: "static",
                },
              },
            ],
          },
        ],
      };

      const result = genericConditionsToQuota(genericConditions);

      expect(result.criteria).toHaveLength(2);
      expect(result.criteria[0].id).toBe("condition1");
      expect(result.criteria[1].id).toBe("condition2");
    });
  });

  describe("createQuotaConditionsCallbacks", () => {
    let mockConditions: TQuotaConditionGroup;
    let mockOnChange: ReturnType<typeof vi.fn>;
    let callbacks: ReturnType<typeof createQuotaConditionsCallbacks>;

    beforeEach(() => {
      mockConditions = {
        id: "root",
        connector: "and",
        conditions: [
          {
            id: "condition1",
            leftOperand: { value: "question1", type: "question", meta: {} },
            operator: "equals",
            rightOperand: { value: "choice1", type: "static" },
          },
          {
            id: "condition2",
            leftOperand: { value: "question2", type: "question", meta: {} },
            operator: "equals",
            rightOperand: { value: "choice2", type: "static" },
          },
        ],
      };

      mockOnChange = vi.fn();
      callbacks = createQuotaConditionsCallbacks(mockConditions, mockOnChange);
    });

    describe("onAddConditionBelow", () => {
      test("should add condition below existing condition", () => {
        callbacks.onAddConditionBelow("condition1");

        expect(mockOnChange).toHaveBeenCalledWith({
          id: "root",
          connector: "and",
          conditions: [
            expect.objectContaining({ id: "condition1" }),
            expect.objectContaining({
              id: "new-id",
              leftOperand: { value: "", type: "question" },
              operator: "equals",
            }),
            expect.objectContaining({ id: "condition2" }),
          ],
        });
      });

      test("should not add condition if resource not found", () => {
        callbacks.onAddConditionBelow("nonexistent");

        expect(mockOnChange).not.toHaveBeenCalled();
      });
    });

    describe("onRemoveCondition", () => {
      test("should remove condition", () => {
        callbacks.onRemoveCondition("condition1");

        expect(mockOnChange).toHaveBeenCalledWith({
          id: "root",
          connector: "and",
          conditions: [expect.objectContaining({ id: "condition2" })],
        });
      });

      test("should not remove condition if resource not found", () => {
        callbacks.onRemoveCondition("nonexistent");

        expect(mockOnChange).not.toHaveBeenCalled();
      });
    });

    describe("onDuplicateCondition", () => {
      test("should duplicate condition", () => {
        callbacks.onDuplicateCondition("condition1");

        expect(mockOnChange).toHaveBeenCalledWith({
          id: "root",
          connector: "and",
          conditions: [
            expect.objectContaining({ id: "condition1" }),
            expect.objectContaining({
              id: "new-id",
              leftOperand: { value: "question1", type: "question", meta: {} },
              operator: "equals",
              rightOperand: { value: "choice1", type: "static" },
            }),
            expect.objectContaining({ id: "condition2" }),
          ],
        });
      });
    });

    describe("onUpdateCondition", () => {
      test("should update condition", () => {
        const updates = { operator: "notEquals" as const };
        callbacks.onUpdateCondition("condition1", updates);

        expect(mockOnChange).toHaveBeenCalledWith({
          id: "root",
          connector: "and",
          conditions: [
            expect.objectContaining({
              id: "condition1",
              operator: "notEquals",
            }),
            expect.objectContaining({ id: "condition2" }),
          ],
        });
      });
    });

    describe("onToggleGroupConnector", () => {
      test("should toggle connector from 'and' to 'or'", () => {
        callbacks.onToggleGroupConnector("root");

        expect(mockOnChange).toHaveBeenCalledWith({
          ...mockConditions,
          connector: "or",
        });
      });

      test("should toggle connector from 'or' to 'and'", () => {
        mockConditions.connector = "or";
        const orCallbacks = createQuotaConditionsCallbacks(mockConditions, mockOnChange);

        orCallbacks.onToggleGroupConnector("root");

        expect(mockOnChange).toHaveBeenCalledWith({
          ...mockConditions,
          connector: "and",
        });
      });

      test("should not toggle if group ID does not match", () => {
        callbacks.onToggleGroupConnector("other-group");

        expect(mockOnChange).not.toHaveBeenCalled();
      });
    });
  });
});
