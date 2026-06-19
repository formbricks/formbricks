"use client";

import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TWorkflowResponseCompletedTriggerNode } from "@formbricks/workflows";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { surveyChoicesAtom } from "@/modules/workflows/state/editor";

interface WorkflowTriggerFormProps {
  node: TWorkflowResponseCompletedTriggerNode;
  isEditable: boolean;
  onChange: (next: TWorkflowResponseCompletedTriggerNode) => void;
}

export const WorkflowTriggerForm = ({ node, isEditable, onChange }: Readonly<WorkflowTriggerFormProps>) => {
  const { t } = useTranslation();
  const surveyChoices = useAtomValue(surveyChoicesAtom);

  const selectedSurvey = useMemo(
    () => surveyChoices.find((survey) => survey.id === node.config.surveyId),
    [surveyChoices, node.config.surveyId]
  );

  const handleSurveyChange = (surveyId: string) => {
    // Clear ending selection when survey changes — ids belong to the previous survey's endings.
    onChange({
      ...node,
      config: { ...node.config, surveyId, endingCardIds: [] },
    });
  };

  const toggleEnding = (endingId: string, checked: boolean) => {
    const current = node.config.endingCardIds;
    const next = checked ? [...current, endingId] : current.filter((id) => id !== endingId);
    onChange({ ...node, config: { ...node.config, endingCardIds: next } });
  };

  return (
    <div className="flex flex-col gap-4 px-1">
      <div className="flex flex-col gap-2">
        <Label htmlFor="workflow-trigger-survey">{t("workspace.workflows.trigger_survey_label")}</Label>
        <Select
          value={node.config.surveyId || undefined}
          onValueChange={handleSurveyChange}
          disabled={!isEditable}>
          <SelectTrigger id="workflow-trigger-survey" className="bg-white">
            <SelectValue placeholder={t("workspace.workflows.trigger_survey_placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {surveyChoices.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">
                {t("workspace.workflows.trigger_survey_empty")}
              </div>
            ) : (
              surveyChoices.map((survey) => (
                <SelectItem key={survey.id} value={survey.id}>
                  {survey.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500">{t("workspace.workflows.trigger_survey_description")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("workspace.workflows.trigger_ending_cards_label")}</Label>
        {!selectedSurvey ? (
          <p className="text-xs text-slate-500">
            {t("workspace.workflows.trigger_ending_cards_pick_survey")}
          </p>
        ) : selectedSurvey.endings.length === 0 ? (
          <p className="text-xs text-slate-500">{t("workspace.workflows.trigger_ending_cards_none")}</p>
        ) : (
          <div className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-md border border-slate-200 bg-white px-3 py-2">
            {selectedSurvey.endings.map((ending) => {
              const checked = node.config.endingCardIds.includes(ending.id);
              return (
                <label
                  key={ending.id}
                  className="flex items-center gap-2 text-sm text-slate-700"
                  htmlFor={`workflow-trigger-ending-${ending.id}`}>
                  <Checkbox
                    id={`workflow-trigger-ending-${ending.id}`}
                    checked={checked}
                    disabled={!isEditable}
                    onCheckedChange={(value) => toggleEnding(ending.id, value === true)}
                  />
                  <span className="truncate">{ending.label}</span>
                </label>
              );
            })}
          </div>
        )}
        <Alert variant="info" size="small">
          <AlertDescription>{t("workspace.workflows.trigger_ending_cards_description")}</AlertDescription>
        </Alert>
      </div>
    </div>
  );
};
