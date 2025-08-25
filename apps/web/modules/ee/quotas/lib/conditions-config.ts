import {
  TQuotaConditionGroup,
  createSharedConditionsFactory,
  genericConditionsToQuota,
  quotaConditionsToGeneric,
} from "@/modules/survey/editor/lib/shared-conditions-factory";
import {
  TConditionsEditorCallbacks,
  TConditionsEditorConfig,
} from "@/modules/ui/components/conditions-editor/types";
import { TFnType } from "@tolgee/react";
import { TSingleCondition, TSurvey } from "@formbricks/types/surveys/types";

// Creates configuration object for the quota conditions editor UI
export function createQuotaConditionsConfig(
  survey: TSurvey,
  t: TFnType
): TConditionsEditorConfig<TSingleCondition> {
  const { config } = createSharedConditionsFactory(
    {
      survey,
      t,
      getDefaultOperator: () => "equals",
    },
    {
      onConditionsChange: () => {}, // Not used in config creation
    }
  );
  return config;
}

// Export the conversion functions and types from shared factory
export { quotaConditionsToGeneric, genericConditionsToQuota };
export type { TQuotaConditionGroup };

// Creates callback functions for managing condition operations (add, remove, duplicate, update)
export function createQuotaConditionsCallbacks(
  conditions: TQuotaConditionGroup,
  onChange: (newConditions: TQuotaConditionGroup) => void,
  survey: TSurvey,
  t: TFnType
): TConditionsEditorCallbacks<TSingleCondition> {
  const { callbacks } = createSharedConditionsFactory(
    {
      survey,
      t,
      getDefaultOperator: () => "equals",
    },
    {
      onConditionsChange: (updater) => {
        const newConditions = updater(conditions);
        onChange(newConditions);
      },
    }
  );
  return callbacks;
}
