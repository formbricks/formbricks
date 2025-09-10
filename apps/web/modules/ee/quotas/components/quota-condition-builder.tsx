"use client";

import {
  TQuotaConditionGroup,
  createSharedConditionsFactory,
  genericConditionsToQuota,
  quotaConditionsToGeneric,
} from "@/modules/survey/editor/lib/shared-conditions-factory";
import { ConditionsEditor } from "@/modules/ui/components/conditions-editor";
import { useTranslate } from "@tolgee/react";
import { useCallback, useMemo } from "react";
import { FieldErrors } from "react-hook-form";
import { TSurveyQuotaInput, TSurveyQuotaLogic } from "@formbricks/types/quota";
import { TSurvey } from "@formbricks/types/surveys/types";

interface QuotaConditionBuilderProps {
  survey: TSurvey;
  conditions: TSurveyQuotaLogic;
  onChange: (conditions: TSurveyQuotaLogic) => void;
  quotaErrors?: FieldErrors<TSurveyQuotaInput>;
}

export const QuotaConditionBuilder = ({
  survey,
  conditions,
  onChange,
  quotaErrors,
}: QuotaConditionBuilderProps) => {
  const { t } = useTranslate();

  // Convert quota conditions to generic format
  const genericConditions = useMemo(() => quotaConditionsToGeneric(conditions), [conditions]);

  // Handle changes from the generic editor
  const handleGenericChange = useCallback(
    (newGenericConditions: TQuotaConditionGroup) => {
      const newQuotaConditions = genericConditionsToQuota(newGenericConditions);
      onChange(newQuotaConditions);
    },
    [onChange]
  );

  // Create both config and callbacks in a single useMemo using the shared factory
  const { config, callbacks } = useMemo(
    () =>
      createSharedConditionsFactory(
        {
          survey,
          t,
          getDefaultOperator: () => "equals",
        },
        {
          onConditionsChange: (updater) => {
            const newConditions = updater(genericConditions);
            handleGenericChange(newConditions);
          },
        }
      ),
    [survey, t, genericConditions, handleGenericChange]
  );

  return (
    <div className="space-y-4">
      <ConditionsEditor
        conditions={genericConditions}
        config={config}
        callbacks={callbacks}
        quotaErrors={quotaErrors}
      />
    </div>
  );
};
