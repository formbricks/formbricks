import {
  addConditionBelow,
  createGroupFromResource,
  duplicateCondition,
  removeCondition,
  toggleGroupConnector,
  updateCondition,
} from "@/lib/surveyLogic/utils";
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
import {
  TConditionGroup,
  TDynamicLogicField,
  TSingleCondition,
  TSurvey,
  TSurveyLogicConditionsOperator,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";

// Factory parameters interface
export interface SharedConditionsFactoryParams {
  survey: TSurvey;
  t: TFnType;
  questionIdx?: number;
  getDefaultOperator: () => TSurveyLogicConditionsOperator;
  includeCreateGroup?: boolean;
}

// Callback parameters for different update patterns
export interface ConditionsUpdateCallbacks {
  onConditionsChange: (updater: (conditions: TConditionGroup) => TConditionGroup) => void;
  onEmptyConditions?: () => void;
}

// Factory function that creates config and callbacks for conditions editor
export function createSharedConditionsFactory(
  params: SharedConditionsFactoryParams,
  updateCallbacks: ConditionsUpdateCallbacks
): {
  config: TConditionsEditorConfig<TSingleCondition>;
  callbacks: TConditionsEditorCallbacks<TSingleCondition>;
} {
  const { survey, t, questionIdx, getDefaultOperator, includeCreateGroup = false } = params;
  const { onConditionsChange, onEmptyConditions } = updateCallbacks;

  // Shared matrix question handling logic
  const handleMatrixQuestionUpdate = (resourceId: string, updates: Partial<TSingleCondition>): boolean => {
    if (updates.leftOperand && updates.leftOperand.type === "question") {
      const type = updates.leftOperand.meta?.type as TDynamicLogicField;
      if (type === "question") {
        const [questionId, rowId] = updates.leftOperand.value.split(".");
        const questionEntity = survey.questions.find((q) => q.id === questionId);

        if (questionEntity && questionEntity.type === TSurveyQuestionTypeEnum.Matrix) {
          if (updates.leftOperand.value.includes(".")) {
            // Matrix question with rowId is selected
            onConditionsChange((conditions) => {
              const conditionsCopy = structuredClone(conditions);
              updateCondition(conditionsCopy, resourceId, {
                leftOperand: {
                  value: questionId,
                  type: "question",
                  meta: {
                    row: rowId,
                  },
                },
                operator: "isEmpty",
                rightOperand: undefined,
              });
              return conditionsCopy;
            });
            return true; // Handled
          }
        }
      }
    }
    return false; // Not handled
  };

  const config: TConditionsEditorConfig<TSingleCondition> = {
    getLeftOperandOptions: () =>
      questionIdx !== undefined
        ? getConditionValueOptions(survey, t, questionIdx)
        : getConditionValueOptions(survey, t),
    getOperatorOptions: (condition) => getConditionOperatorOptions(condition, survey, t),
    getValueProps: (condition) =>
      questionIdx !== undefined
        ? getMatchValueProps(condition, survey, t, questionIdx)
        : getMatchValueProps(condition, survey, t),
    getDefaultOperator,
    formatLeftOperandValue: (condition) => getFormatLeftOperandValue(condition, survey),
  };

  const callbacks: TConditionsEditorCallbacks<TSingleCondition> = {
    onAddConditionBelow: (resourceId: string) => {
      const newCondition: TSingleCondition = {
        id: createId(),
        leftOperand: { value: "", type: "question" },
        operator: getDefaultOperator(),
      };

      onConditionsChange((conditions) => {
        const conditionsCopy = structuredClone(conditions);
        addConditionBelow(conditionsCopy, resourceId, newCondition);
        return conditionsCopy;
      });
    },

    onRemoveCondition: (resourceId: string) => {
      onConditionsChange((conditions) => {
        const conditionsCopy = structuredClone(conditions);
        removeCondition(conditionsCopy, resourceId);

        // Check if no conditions left and call empty handler if provided
        if (conditionsCopy.conditions.length === 0 && onEmptyConditions) {
          onEmptyConditions();
          return conditions; // Return original since we're removing the entire logic item
        }

        return conditionsCopy;
      });
    },

    onDuplicateCondition: (resourceId: string) => {
      onConditionsChange((conditions) => {
        const conditionsCopy = structuredClone(conditions);
        duplicateCondition(conditionsCopy, resourceId);
        return conditionsCopy;
      });
    },

    onUpdateCondition: (resourceId: string, updates: Partial<TSingleCondition>) => {
      // Try matrix question handling first
      if (handleMatrixQuestionUpdate(resourceId, updates)) {
        return;
      }

      // Regular update
      onConditionsChange((conditions) => {
        const conditionsCopy = structuredClone(conditions);
        updateCondition(conditionsCopy, resourceId, updates);
        return conditionsCopy;
      });
    },

    onToggleGroupConnector: (groupId: string) => {
      onConditionsChange((conditions) => {
        const conditionsCopy = structuredClone(conditions);
        toggleGroupConnector(conditionsCopy, groupId);
        return conditionsCopy;
      });
    },
  };

  // Add onCreateGroup if needed
  if (includeCreateGroup) {
    callbacks.onCreateGroup = (resourceId: string) => {
      onConditionsChange((conditions) => {
        const conditionsCopy = structuredClone(conditions);
        createGroupFromResource(conditionsCopy, resourceId);
        return conditionsCopy;
      });
    };
  }

  return { config, callbacks };
}

// Helper type for quota conditions (used in quota conditions config)
export type TQuotaConditionGroup = TGenericConditionGroup<TSingleCondition>;

// Conversion functions for quota conditions (moved from conditions-config.ts)
export const quotaConditionsToGeneric = (quotaConditions: TSurveyQuotaConditions): TQuotaConditionGroup => {
  return {
    id: "root",
    connector: quotaConditions.connector,
    conditions: quotaConditions.criteria,
  };
};

export const genericConditionsToQuota = (genericConditions: TQuotaConditionGroup): TSurveyQuotaConditions => {
  const convertCondition = (condition: TSingleCondition): TSingleCondition => {
    const leftOperand = condition.leftOperand;
    return {
      id: condition.id,
      leftOperand: {
        type: leftOperand.type,
        value: leftOperand.value,
        ...(leftOperand.type === "question" && leftOperand.meta && { meta: leftOperand.meta }),
      },
      operator: condition.operator,
      rightOperand: condition.rightOperand,
    };
  };

  return {
    connector: genericConditions.connector,
    criteria: genericConditions.conditions.map(convertCondition),
  };
};
