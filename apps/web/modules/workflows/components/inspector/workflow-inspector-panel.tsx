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
  workflowId: string;
  isReadOnly: boolean;
  canEditMetadata: boolean;
  isEditingNode: boolean;
  onSaveNode?: () => Promise<void> | void;
  isSavingNode?: boolean;
}

export const WorkflowInspectorPanel = ({
  workflowId,
  isReadOnly,
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
        "shrink-0 overflow-hidden transition-[width,opacity] duration-300 ease-in-out",
        isCollapsed ? "w-0 opacity-0" : "w-[360px] opacity-100"
      )}>
      <div className="flex w-[360px] flex-col gap-3 self-start">
        {isNodeConfigOpen ? (
          <WorkflowNodeConfigPanel isEditable={isEditingNode} onSave={onSaveNode} isSaving={isSavingNode} />
        ) : (
          <SettingsSection
            workflowId={workflowId}
            isReadOnly={isReadOnly}
            canEditMetadata={canEditMetadata}
          />
        )}
      </div>
    </div>
  );
};
