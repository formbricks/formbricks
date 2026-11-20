"use client";

import { useAtomValue } from "jotai";
import { Redo2Icon, Undo2Icon } from "lucide-react";
import { useSelectedLayoutSegment } from "next/navigation";
import { useTranslation } from "react-i18next";
import { WorkflowAutoSaveIndicator } from "@/modules/ee/workflows/components/workflow-auto-save-indicator";
import { useWorkflowHistory } from "@/modules/ee/workflows/hooks/use-workflow-history";
import {
  canEditWorkflowDefinitionAtom,
  hasWorkflowSaveFailedAtom,
  workflowAtom,
} from "@/modules/ee/workflows/state/editor";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

/**
 * The right side of the Editor / Runs tab row: the autosave status, then Undo and Redo. They sit here,
 * not on the canvas, because they cover the whole workflow (canvas and step panels alike). The undo
 * history is mounted here too, so it survives switching to the Runs tab and back.
 */
export const WorkflowEditorToolbar = ({ isReadOnly }: Readonly<{ isReadOnly: boolean }>) => {
  const { t } = useTranslation();
  const segment = useSelectedLayoutSegment();
  const workflow = useAtomValue(workflowAtom);
  const canEditDefinition = useAtomValue(canEditWorkflowDefinitionAtom);
  const hasSaveFailed = useAtomValue(hasWorkflowSaveFailedAtom);
  const isEditTab = segment === null;
  const history = useWorkflowHistory({ shortcutsEnabled: isEditTab });

  if (!workflow) return null;

  // The definition is the workflow's real content: while it can't change (enabled, archived, or a
  // read-only member) say so instead of advertising an autosave with nothing to act on. A save
  // failure still wins on every tab, since the unmount flush can fail while switching tabs.
  const status =
    canEditDefinition || hasSaveFailed ? (
      <WorkflowAutoSaveIndicator />
    ) : (
      <span className="inline-flex cursor-default items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
        {t("workspace.workflows.read_only")}
      </span>
    );

  return (
    <div className="flex shrink-0 items-center gap-2">
      {isEditTab || hasSaveFailed ? status : null}
      {isEditTab && canEditDefinition && !isReadOnly ? (
        <div className="flex items-center">
          <TooltipRenderer tooltipContent={t("workspace.workflows.undo")}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("workspace.workflows.undo")}
              disabled={!history.canUndo}
              onClick={history.undo}>
              <Undo2Icon />
            </Button>
          </TooltipRenderer>
          <TooltipRenderer tooltipContent={t("workspace.workflows.redo")}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("workspace.workflows.redo")}
              disabled={!history.canRedo}
              onClick={history.redo}>
              <Redo2Icon />
            </Button>
          </TooltipRenderer>
        </div>
      ) : null}
    </div>
  );
};
