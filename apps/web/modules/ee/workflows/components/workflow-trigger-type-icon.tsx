"use client";

import { useTranslation } from "react-i18next";
import type { TWorkflowTriggerType } from "@formbricks/workflows";
import { NODE_ICONS } from "@/modules/ee/workflows/components/canvas/workflow-node-card";
import { getWorkflowTriggerTypeLabel } from "@/modules/ee/workflows/lib/display";

/**
 * A workflow's trigger as a quiet line icon in the text's grey (the canvas card's icon, without its
 * coloured chip, so a long list doesn't repeat one accent down the column), named in its `title` and
 * for screen readers. A draft without a trigger keeps the icon's space, so names still line up.
 */
export const WorkflowTriggerTypeIcon = ({
  triggerType,
}: Readonly<{ triggerType: TWorkflowTriggerType | null }>) => {
  const { t } = useTranslation();
  const label = triggerType
    ? getWorkflowTriggerTypeLabel(triggerType, t)
    : t("workspace.workflows.trigger_none_yet");
  let Icon: (typeof NODE_ICONS)[keyof typeof NODE_ICONS] | null = null;
  if (triggerType === "webhook") Icon = NODE_ICONS.webhook;
  else if (triggerType) Icon = NODE_ICONS.survey;
  return (
    <span title={label} className="flex size-4 shrink-0 items-center justify-center text-slate-500">
      {Icon ? <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" /> : null}
      <span className="sr-only">{label}</span>
    </span>
  );
};
