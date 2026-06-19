"use client";

import { useTranslation } from "react-i18next";
import type { TWorkflowResponseCompletedTriggerNode } from "@formbricks/workflows";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";

interface WorkflowTriggerFormProps {
  node: TWorkflowResponseCompletedTriggerNode;
  isEditable: boolean;
  onChange: (next: TWorkflowResponseCompletedTriggerNode) => void;
}

export const WorkflowTriggerForm = ({ node, isEditable, onChange }: Readonly<WorkflowTriggerFormProps>) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="workflow-trigger-survey-id">{t("workspace.workflows.trigger_survey_id_label")}</Label>
        <Input
          id="workflow-trigger-survey-id"
          value={node.config.surveyId ?? ""}
          disabled={!isEditable}
          placeholder={t("workspace.workflows.trigger_survey_id_placeholder")}
          onChange={(event) =>
            onChange({
              ...node,
              config: { ...node.config, surveyId: event.target.value.trim() },
            })
          }
        />
        <p className="text-xs text-slate-500">{t("workspace.workflows.trigger_survey_id_description")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="workflow-trigger-ending-ids">
          {t("workspace.workflows.trigger_ending_card_ids_label")}
        </Label>
        <Input
          id="workflow-trigger-ending-ids"
          value={node.config.endingCardIds.join(", ")}
          disabled={!isEditable}
          placeholder={t("workspace.workflows.trigger_ending_card_ids_placeholder")}
          onChange={(event) => {
            const endingCardIds = event.target.value
              .split(",")
              .map((endingCardId) => endingCardId.trim())
              .filter(Boolean);

            onChange({
              ...node,
              config: { ...node.config, endingCardIds },
            });
          }}
        />
        <p className="text-xs text-slate-500">
          {t("workspace.workflows.trigger_ending_card_ids_description")}
        </p>
      </div>
    </div>
  );
};
