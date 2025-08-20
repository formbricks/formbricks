"use client";

import { ConditionsEditor } from "@/modules/ui/components/conditions-editor";
import { useTranslate } from "@tolgee/react";
import { useMemo } from "react";
import { TSurveyQuotaConditions } from "@formbricks/types/quota";
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
}

export const QuotaConditionBuilder = ({ survey, conditions, onChange }: QuotaConditionBuilderProps) => {
  const { t } = useTranslate();

  // Convert quota conditions to generic format
  const genericConditions = useMemo(() => quotaConditionsToGeneric(conditions, survey), [conditions, survey]);

  // Create configuration for the conditions editor
  const config = useMemo(() => createQuotaConditionsConfig(survey, t), [survey]);

  // Handle changes from the generic editor
  const handleGenericChange = (newGenericConditions: TQuotaConditionGroup) => {
    const newQuotaConditions = genericConditionsToQuota(newGenericConditions);
    onChange(newQuotaConditions);
  };

  // Create callbacks for the conditions editor
  const callbacks = useMemo(
    () => createQuotaConditionsCallbacks(genericConditions, handleGenericChange),
    [genericConditions, handleGenericChange]
  );

  return (
    <div className="space-y-4">
      <ConditionsEditor conditions={genericConditions} config={config} callbacks={callbacks} />
    </div>
  );
};
