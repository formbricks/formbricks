"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TWorkflowResponseCompletedTriggerNode } from "@formbricks/workflows";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";

interface WorkflowTriggerFormProps {
  node: TWorkflowResponseCompletedTriggerNode;
  isEditable: boolean;
  onChange: (next: TWorkflowResponseCompletedTriggerNode) => void;
}

const parseIdList = (raw: string): string[] =>
  raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

export const WorkflowTriggerForm = ({ node, isEditable, onChange }: Readonly<WorkflowTriggerFormProps>) => {
  const { t } = useTranslation();
  // Hold the raw user input separately from the parsed array so the comma and trailing/empty
  // tokens survive a render round-trip. Without this, typing a `,` would be filtered out by
  // `parseIdList` and the controlled input would immediately render the stripped value back to
  // the user. Seeded once from the node prop; the modal re-mounts this form per node so it
  // stays in sync with the underlying config.
  const [endingCardIdsRaw, setEndingCardIdsRaw] = useState(() => node.config.endingCardIds.join(", "));

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
          value={endingCardIdsRaw}
          disabled={!isEditable}
          placeholder={t("workspace.workflows.trigger_ending_card_ids_placeholder")}
          onChange={(event) => {
            const raw = event.target.value;
            setEndingCardIdsRaw(raw);
            onChange({
              ...node,
              config: { ...node.config, endingCardIds: parseIdList(raw) },
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
