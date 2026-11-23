"use client";

import { useTranslation } from "react-i18next";
import type { TWorkflowNode } from "@formbricks/workflows";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";

// Mirrors `ZWorkflowNodeBase.label` (1–120 characters); blank means "use the step type's name".
const STEP_NAME_MAX_LENGTH = 120;

/**
 * A step's own name, shown as its card title in place of the type ("Enterprise customer?" rather
 * than "If / Else"). Optional: cleared, the card falls back to the translated type name.
 */
export const WorkflowStepNameField = <TNode extends TWorkflowNode>({
  node,
  isEditable,
  onChange,
}: Readonly<{ node: TNode; isEditable: boolean; onChange: (next: TNode) => void }>) => {
  const { t } = useTranslation();
  const id = `workflow-step-name-${node.id}`;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{t("workspace.workflows.step_name")}</Label>
      <Input
        id={id}
        value={node.label ?? ""}
        maxLength={STEP_NAME_MAX_LENGTH}
        disabled={!isEditable}
        placeholder={t("workspace.workflows.step_name_placeholder")}
        onChange={(event) => {
          const label = event.target.value.trimStart();
          const { label: _previous, ...rest } = node;
          onChange((label ? { ...rest, label } : rest) as TNode);
        }}
      />
    </div>
  );
};
