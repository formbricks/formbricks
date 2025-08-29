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
  getDefaultOperatorForQuestion,
  getFormatLeftOperandValue,
  getMatchValueProps,
  getQuestionOperatorOptions,
} from "@/modules/survey/editor/lib/utils";
import {
  TConditionsEditorCallbacks,
  TConditionsEditorConfig,
  TGenericConditionGroup,
} from "@/modules/ui/components/conditions-editor/types";
import { createId } from "@paralleldrive/cuid2";
import { TFnType } from "@tolgee/react";
import { TSurveyQuotaLogic } from "@formbricks/types/quota";
import {
  TConditionGroup,
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
  const { onConditionsChange } = updateCallbacks;

  // Handles special update logic for matrix questions, setting appropriate operators and metadata
  const handleMatrixQuestionUpdate = (resourceId: string, updates: Partial<TSingleCondition>): boolean => {
    if (updates.leftOperand && updates.leftOperand.type === "question") {
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
    // Creates and adds a new empty condition below the specified condition
    onAddConditionBelow: (resourceId: string) => {
      // When adding a condition in the context of a specific question, default to that question
      const defaultLeftOperandValue =
        questionIdx !== undefined ? survey.questions[questionIdx].id : survey.questions[0].id;
      const defaultOperator =
        questionIdx !== undefined
          ? getDefaultOperatorForQuestion(survey.questions[questionIdx], t)
          : getDefaultOperatorForQuestion(survey.questions[0], t);
      const newCondition: TSingleCondition = {
        id: createId(),
        leftOperand: { value: defaultLeftOperandValue, type: "question" },
        operator: defaultOperator,
      };

      onConditionsChange((conditions) => {
        const conditionsCopy = structuredClone(conditions);
        addConditionBelow(conditionsCopy, resourceId, newCondition);
        return conditionsCopy;
      });
    },

    // Removes a condition and triggers empty handler if no conditions remain
    onRemoveCondition: (resourceId: string) => {
      onConditionsChange((conditions) => {
        const conditionsCopy = structuredClone(conditions);
        removeCondition(conditionsCopy, resourceId);
        return conditionsCopy;
      });
    },

    // Creates an exact copy of the specified condition
    onDuplicateCondition: (resourceId: string) => {
      onConditionsChange((conditions) => {
        const conditionsCopy = structuredClone(conditions);
        duplicateCondition(conditionsCopy, resourceId);
        return conditionsCopy;
      });
    },

    // Updates a condition with new values, handling matrix questions specially
    onUpdateCondition: (resourceId: string, updates: Partial<TSingleCondition>) => {
      // Try matrix question handling first
      if (handleMatrixQuestionUpdate(resourceId, updates)) {
        return;
      }

      // Check if the operator is correct for the question
      if (updates.leftOperand?.type === "question" && updates.operator) {
        const questionId = updates.leftOperand.value.split(".")[0];
        const question = survey.questions.find((q) => q.id === questionId);

        if (question) {
          const operatorOptions = getQuestionOperatorOptions(question, t);
          const isValidOperator = operatorOptions.some((o) => o.value === updates.operator);

          if (!isValidOperator) {
            updates.operator = operatorOptions[0].value as TSurveyLogicConditionsOperator;
          }
        }
      }

      // Regular update
      onConditionsChange((conditions) => {
        const conditionsCopy = structuredClone(conditions);
        updateCondition(conditionsCopy, resourceId, updates);
        return conditionsCopy;
      });
    },

    // Toggles the logical connector (AND/OR) for a condition group
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
    // Creates a new condition group from an existing condition
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
// Converts quota-specific condition format to generic condition group format
export const quotaConditionsToGeneric = (quotaConditions: TSurveyQuotaLogic): TQuotaConditionGroup => {
  return {
    id: "root",
    connector: quotaConditions.connector,
    conditions: quotaConditions.conditions,
  };
};

// Converts generic condition group format back to quota-specific condition format
export const genericConditionsToQuota = (genericConditions: TQuotaConditionGroup): TSurveyQuotaLogic => {
  // Helper function to ensure proper condition structure for quota conditions
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
    conditions: genericConditions.conditions.map(convertCondition),
  };
};
