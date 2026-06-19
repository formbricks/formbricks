"use client";

import { useParams } from "next/navigation";
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
import {
  useWorkflowSurveyEndings,
  useWorkflowSurveyOptions,
} from "@/modules/workflows/list/hooks/use-trigger-survey-picker";

interface WorkflowTriggerFormProps {
  node: TWorkflowResponseCompletedTriggerNode;
  isEditable: boolean;
  onChange: (next: TWorkflowResponseCompletedTriggerNode) => void;
}

export const WorkflowTriggerForm = ({ node, isEditable, onChange }: Readonly<WorkflowTriggerFormProps>) => {
  const { t } = useTranslation();
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params?.workspaceId ?? "";
  const surveyOptionsQuery = useWorkflowSurveyOptions(workspaceId);
  const endingsQuery = useWorkflowSurveyEndings(node.config.surveyId || null);

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

  const renderEndingChoices = () => {
    if (!node.config.surveyId) {
      return (
        <p className="text-xs text-slate-500">{t("workspace.workflows.trigger_ending_cards_pick_survey")}</p>
      );
    }
    if (endingsQuery.isLoading) {
      return <p className="text-xs text-slate-500">{t("common.loading")}</p>;
    }
    if (endingsQuery.endings.length === 0) {
      return <p className="text-xs text-slate-500">{t("workspace.workflows.trigger_ending_cards_none")}</p>;
    }
    return (
      <div className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-md border border-slate-200 bg-white px-3 py-2">
        {endingsQuery.endings.map((ending) => {
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
    );
  };

  return (
    <div className="flex flex-col gap-4 px-1">
      <div className="flex flex-col gap-2">
        <Label htmlFor="workflow-trigger-survey">{t("workspace.workflows.trigger_survey_label")}</Label>
        <Select
          value={node.config.surveyId || undefined}
          onValueChange={handleSurveyChange}
          disabled={!isEditable || surveyOptionsQuery.isLoading}>
          <SelectTrigger id="workflow-trigger-survey" className="bg-white">
            <SelectValue placeholder={t("workspace.workflows.trigger_survey_placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {surveyOptionsQuery.options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">
                {surveyOptionsQuery.isLoading
                  ? t("common.loading")
                  : t("workspace.workflows.trigger_survey_empty")}
              </div>
            ) : (
              surveyOptionsQuery.options.map((survey) => (
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
        {renderEndingChoices()}
        <Alert variant="info">
          <AlertDescription>{t("workspace.workflows.trigger_ending_cards_description")}</AlertDescription>
        </Alert>
      </div>
    </div>
  );
};
