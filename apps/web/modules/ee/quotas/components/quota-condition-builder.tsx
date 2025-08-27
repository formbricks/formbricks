"use client";

import { ConditionsEditor } from "@/modules/ui/components/conditions-editor";
import { useTranslate } from "@tolgee/react";
import { useMemo } from "react";
import { FieldErrors } from "react-hook-form";
import { TSurveyQuotaConditions, TSurveyQuotaCreateInput } from "@formbricks/types/quota";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  TQuotaConditionGroup,
  createQuotaConditionsCallbacks,
  createQuotaConditionsConfig,
  genericConditionsToQuota,
  quotaConditionsToGeneric,
} from "../lib/conditions-config";

interface QuotaConditionBuilderProps {
  survey: TSurvey;
  conditions: TSurveyQuotaConditions;
  onChange: (conditions: TSurveyQuotaConditions) => void;
  errors?: FieldErrors<TSurveyQuotaCreateInput>;
}

export const QuotaConditionBuilder = ({
  survey,
  conditions,
  onChange,
  errors,
}: QuotaConditionBuilderProps) => {
  const { t } = useTranslate();

  // Convert quota conditions to generic format
  const genericConditions = useMemo(() => quotaConditionsToGeneric(conditions), [conditions]);

  // Create configuration for the conditions editor
  const config = useMemo(() => createQuotaConditionsConfig(survey, t), [survey]);

  // Handle changes from the generic editor
  const handleGenericChange = (newGenericConditions: TQuotaConditionGroup) => {
    const newQuotaConditions = genericConditionsToQuota(newGenericConditions);
    onChange(newQuotaConditions);
  };

  // Create callbacks for the conditions editor
  const callbacks = useMemo(
    () => createQuotaConditionsCallbacks(genericConditions, handleGenericChange, survey, t),
    [genericConditions, handleGenericChange, survey, t]
  );

  return (
    <div className="space-y-4">
      <ConditionsEditor
        conditions={genericConditions}
        config={config}
        callbacks={callbacks}
        errors={errors}
      />
    </div>
  );
};
