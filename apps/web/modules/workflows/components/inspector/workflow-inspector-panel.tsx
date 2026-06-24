"use client";

import { useAtomValue } from "jotai";
import { cn } from "@/lib/cn";
import { WorkflowNodeConfigPanel } from "@/modules/workflows/components/inspector/workflow-node-config-panel";
import { SettingsSection } from "@/modules/workflows/components/inspector/workflow-settings-section";
import {
  isWorkflowInspectorCollapsedAtom,
  isWorkflowNodeConfigModalOpenAtom,
} from "@/modules/workflows/state/editor";

interface WorkflowInspectorPanelProps {
  canEditMetadata: boolean;
  isEditingNode: boolean;
  onSaveNode?: () => Promise<void> | void;
  isSavingNode?: boolean;
}

export const WorkflowInspectorPanel = ({
  canEditMetadata,
  isEditingNode,
  onSaveNode,
  isSavingNode,
}: Readonly<WorkflowInspectorPanelProps>) => {
  const isCollapsed = useAtomValue(isWorkflowInspectorCollapsedAtom);
  const isNodeConfigOpen = useAtomValue(isWorkflowNodeConfigModalOpenAtom);

  return (
    <div
      aria-hidden={isCollapsed}
      className={cn(
        "shrink-0 self-stretch overflow-hidden transition-[width,opacity] duration-300 ease-in-out",
        isCollapsed ? "w-0 opacity-0" : "w-[320px] opacity-100"
      )}>
      <div className="flex w-[320px] flex-col gap-3 self-start">
        {isNodeConfigOpen ? (
          <WorkflowNodeConfigPanel isEditable={isEditingNode} onSave={onSaveNode} isSaving={isSavingNode} />
        ) : (
          <SettingsSection canEditMetadata={canEditMetadata} />
        )}
      </div>
    </div>
  );
};
