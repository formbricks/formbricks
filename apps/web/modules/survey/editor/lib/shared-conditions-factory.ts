import { createId } from "@paralleldrive/cuid2";
import { TFunction } from "i18next";
import { TSurveyQuotaLogic } from "@formbricks/types/quota";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import {
  TConditionGroup,
  TSingleCondition,
  TSurveyLogicConditionsOperator,
} from "@formbricks/types/surveys/logic";
import { TSurvey } from "@formbricks/types/surveys/types";
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
  getDefaultOperatorForElement,
  getElementOperatorOptions,
  getFormatLeftOperandValue,
  getMatchValueProps,
} from "@/modules/survey/editor/lib/utils";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import {
  TConditionsEditorCallbacks,
  TConditionsEditorConfig,
  TGenericConditionGroup,
} from "@/modules/ui/components/conditions-editor/types";

// Factory parameters interface
export interface SharedConditionsFactoryParams {
  survey: TSurvey;
  t: TFunction;
  blockIdx?: number;
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
  const { survey, t, blockIdx, getDefaultOperator, includeCreateGroup = false } = params;
  const { onConditionsChange } = updateCallbacks;

  // Derive elements from blocks
  const elements = getElementsFromBlocks(survey.blocks);

  // Handles special update logic for matrix elements, setting appropriate operators and metadata
  const handleMatrixElementUpdate = (resourceId: string, updates: Partial<TSingleCondition>): boolean => {
    if (updates.leftOperand && updates.leftOperand.type === "element") {
      const [elementId, rowId] = updates.leftOperand.value.split(".");
      const element = elements.find((q) => q.id === elementId);

      if (element && element.type === TSurveyElementTypeEnum.Matrix) {
        if (updates.leftOperand.value.includes(".")) {
          // Matrix element with rowId is selected
          onConditionsChange((conditions) => {
            const conditionsCopy = structuredClone(conditions);
            updateCondition(conditionsCopy, resourceId, {
              leftOperand: {
                value: elementId,
                type: "element",
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
    getLeftOperandOptions: () => getConditionValueOptions(survey, t, blockIdx),
    getOperatorOptions: (condition) => getConditionOperatorOptions(condition, survey, t),
    getValueProps: (condition) => getMatchValueProps(condition, survey, t, blockIdx),
    getDefaultOperator,
    formatLeftOperandValue: (condition) => getFormatLeftOperandValue(condition, survey),
  };

  const callbacks: TConditionsEditorCallbacks<TSingleCondition> = {
    // Creates and adds a new empty condition below the specified condition
    onAddConditionBelow: (resourceId: string) => {
      // When adding a condition in the context of a specific block, default to the first element
      const defaultLeftOperandValue = elements.length > 0 ? elements[0].id : "";
      const defaultOperator = elements.length > 0 ? getDefaultOperatorForElement(elements[0], t) : "equals";
      const newCondition: TSingleCondition = {
        id: createId(),
        leftOperand: { value: defaultLeftOperandValue, type: "element" },
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

    // Updates a condition with new values, handling matrix elements specially
    onUpdateCondition: (resourceId: string, updates: Partial<TSingleCondition>) => {
      // Try matrix element handling first
      if (handleMatrixElementUpdate(resourceId, updates)) {
        return;
      }

      // Check if the operator is correct for the element
      if (updates.leftOperand?.type === "element" && updates.operator) {
        const elementId = updates.leftOperand.value.split(".")[0];
        const element = elements.find((q) => q.id === elementId);

        if (element) {
          const operatorOptions = getElementOperatorOptions(element, t);
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
        ...(leftOperand.type === "element" && leftOperand.meta && { meta: leftOperand.meta }),
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
