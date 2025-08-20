import {
  getConditionOperatorOptions,
  getConditionValueOptions,
  getFormatLeftOperandValue,
  getMatchValueProps,
} from "@/modules/survey/editor/lib/utils";
import {
  TConditionsEditorCallbacks,
  TConditionsEditorConfig,
  TGenericConditionGroup,
} from "@/modules/ui/components/conditions-editor/types";
import { createId } from "@paralleldrive/cuid2";
import { TFnType } from "@tolgee/react";
import { TSurveyQuotaConditions } from "@formbricks/types/quota";
import { TSingleCondition, TSurvey } from "@formbricks/types/surveys/types";

export type TQuotaConditionGroup = TGenericConditionGroup<TSingleCondition>;

export function createQuotaConditionsConfig(
  survey: TSurvey,
  t: TFnType
): TConditionsEditorConfig<TSingleCondition> {
  return {
    getLeftOperandOptions: () => getConditionValueOptions(survey, t),
    getOperatorOptions: (condition: TSingleCondition) =>
      getConditionOperatorOptions(condition as TSingleCondition, survey, t),
    getValueProps: (condition: TSingleCondition) => getMatchValueProps(condition, survey, t),
    getDefaultOperator: () => "equals",
    formatLeftOperandValue: (condition) => getFormatLeftOperandValue(condition, survey),
  };
}

// Helper functions to convert between quota and generic formats
export function quotaConditionsToGeneric(
  quotaConditions: TSurveyQuotaConditions,
  survey: TSurvey
): TQuotaConditionGroup {
  const convertCriterion = (criterion: TSingleCondition): TSingleCondition => {
    // Find the meta information for this field
    let meta: any = {};

    if (criterion.leftOperand.type === "question") {
      const question = survey.questions.find((q) => q.id === criterion.leftOperand.value);
      if (question) {
        meta = {
          type: "question",
          questionType: question.type,
          choices: (question as any).choices || [],
        };
      }
    } else if (criterion.leftOperand.type === "variable") {
      meta = { type: "variable" };
    } else if (criterion.leftOperand.type === "hiddenField") {
      meta = { type: "hiddenField" };
    }

    return {
      id: criterion.id,
      leftOperand: {
        value: criterion.leftOperand.value,
        type: criterion.leftOperand.type,
        meta,
      },
      operator: criterion.operator,
      rightOperand:
        criterion.rightOperand !== null && criterion.rightOperand !== undefined
          ? {
              value: (() => {
                // Handle object with value property (e.g., { type: "static", value: ... })
                if (
                  typeof criterion.rightOperand === "object" &&
                  criterion.rightOperand !== null &&
                  "value" in criterion.rightOperand
                ) {
                  const value = (criterion.rightOperand as any).value;
                  return Array.isArray(value) ? value.map(String) : String(value);
                }
                // Handle direct values
                return Array.isArray(criterion.rightOperand)
                  ? (criterion.rightOperand as any[]).map(String)
                  : String(criterion.rightOperand);
              })(),
              type: "static",
            }
          : undefined,
    };
  };

  return {
    id: "root",
    connector: quotaConditions.connector,
    conditions: quotaConditions.criteria.map(convertCriterion),
  };
}

export function genericConditionsToQuota(genericConditions: TQuotaConditionGroup): TSurveyQuotaConditions {
  const convertCondition = (condition: TSingleCondition): TSingleCondition => {
    let rightOperand = condition.rightOperand?.value ?? null;

    // Convert back from string arrays if needed
    if (Array.isArray(rightOperand)) {
      rightOperand = rightOperand as string[];
    } else if (typeof rightOperand === "string" && rightOperand !== "") {
      // Try to parse numbers
      const numValue = Number(rightOperand);
      if (!isNaN(numValue) && numValue.toString() === rightOperand) {
        rightOperand = numValue;
      }
    }

    return {
      id: condition.id,
      leftOperand: {
        type: condition.leftOperand.type as "question" | "hiddenField" | "variable",
        value: condition.leftOperand.value,
      },
      operator: condition.operator,
      rightOperand:
        rightOperand !== null
          ? {
              type: "static",
              value: rightOperand,
            }
          : undefined,
    };
  };

  // For now, we'll flatten nested groups - quota conditions are simpler
  const flattenConditions = (group: TQuotaConditionGroup): TSingleCondition[] => {
    const result: TSingleCondition[] = [];

    for (const item of group.conditions) {
      if ("conditions" in item) {
        // It's a group, flatten it
        result.push(...flattenConditions(item as TQuotaConditionGroup));
      } else {
        // It's a condition
        result.push(item as TSingleCondition);
      }
    }

    return result;
  };

  const flatConditions = flattenConditions(genericConditions);

  return {
    connector: genericConditions.connector,
    criteria: flatConditions.map(convertCondition),
  };
}

export function createQuotaConditionsCallbacks(
  conditions: TQuotaConditionGroup,
  onChange: (newConditions: TQuotaConditionGroup) => void
): TConditionsEditorCallbacks<TSingleCondition> {
  const findConditionPath = (
    targetId: string,
    currentGroup: TQuotaConditionGroup,
    path: number[] = []
  ): number[] | null => {
    for (let i = 0; i < currentGroup.conditions.length; i++) {
      const condition = currentGroup.conditions[i];

      if (condition.id === targetId) {
        return [...path, i];
      }

      if ("conditions" in condition) {
        const nestedPath = findConditionPath(targetId, condition as TQuotaConditionGroup, [...path, i]);
        if (nestedPath) return nestedPath;
      }
    }

    return null;
  };

  const updateConditionsAtPath = (
    group: TQuotaConditionGroup,
    path: number[],
    updater: (conditions: any[]) => any[]
  ): TQuotaConditionGroup => {
    if (path.length === 0) {
      return {
        ...group,
        conditions: updater(group.conditions),
      };
    }

    const [currentIndex, ...restPath] = path;
    const newConditions = [...group.conditions];

    if ("conditions" in newConditions[currentIndex]) {
      newConditions[currentIndex] = updateConditionsAtPath(
        newConditions[currentIndex] as TQuotaConditionGroup,
        restPath,
        updater
      );
    }

    return {
      ...group,
      conditions: newConditions,
    };
  };

  return {
    onAddConditionBelow: (resourceId: string) => {
      const newCondition: TSingleCondition = {
        id: createId(),
        leftOperand: { value: "", type: "question" },
        operator: "equals",
      };

      const path = findConditionPath(resourceId, conditions);
      if (path) {
        const parentPath = path.slice(0, -1);
        const conditionIndex = path[path.length - 1];

        const newConditions = updateConditionsAtPath(conditions, parentPath, (conditions) => {
          const newList = [...conditions];
          newList.splice(conditionIndex + 1, 0, newCondition);
          return newList;
        });

        onChange(newConditions);
      }
    },

    onRemoveCondition: (resourceId: string) => {
      const path = findConditionPath(resourceId, conditions);
      if (path) {
        const parentPath = path.slice(0, -1);
        const conditionIndex = path[path.length - 1];

        const newConditions = updateConditionsAtPath(conditions, parentPath, (conditions) => {
          return conditions.filter((_, index) => index !== conditionIndex);
        });

        onChange(newConditions);
      }
    },

    onDuplicateCondition: (resourceId: string) => {
      const path = findConditionPath(resourceId, conditions);
      if (path) {
        const parentPath = path.slice(0, -1);
        const conditionIndex = path[path.length - 1];

        const newConditions = updateConditionsAtPath(conditions, parentPath, (conditions) => {
          const conditionToDuplicate = conditions[conditionIndex];
          const duplicatedCondition = {
            ...conditionToDuplicate,
            id: createId(),
          };

          const newList = [...conditions];
          newList.splice(conditionIndex + 1, 0, duplicatedCondition);
          return newList;
        });

        onChange(newConditions);
      }
    },

    onUpdateCondition: (resourceId: string, updates: Partial<TSingleCondition>) => {
      const path = findConditionPath(resourceId, conditions);
      if (path) {
        const parentPath = path.slice(0, -1);
        const conditionIndex = path[path.length - 1];

        const newConditions = updateConditionsAtPath(conditions, parentPath, (conditions) => {
          const newList = [...conditions];
          newList[conditionIndex] = {
            ...newList[conditionIndex],
            ...updates,
          };
          return newList;
        });
        onChange(newConditions);
      }
    },

    onToggleGroupConnector: (groupId: string) => {
      if (groupId === conditions.id) {
        onChange({
          ...conditions,
          connector: conditions.connector === "and" ? "or" : "and",
        });
      }
    },
  };
}
