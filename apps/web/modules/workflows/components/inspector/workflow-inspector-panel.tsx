"use client";

import { useAtomValue } from "jotai";
import { WorkflowNodeConfigPanel } from "@/modules/workflows/components/inspector/workflow-node-config-panel";
import { SettingsSection } from "@/modules/workflows/components/inspector/workflow-settings-section";
import {
  isWorkflowInspectorCollapsedAtom,
  isWorkflowNodeConfigModalOpenAtom,
} from "@/modules/workflows/state/editor";

interface WorkflowInspectorPanelProps {
  canEditDefinition: boolean;
  canEditMetadata: boolean;
  isEditingNode: boolean;
  onSaveNode?: () => Promise<void> | void;
  isSavingNode?: boolean;
}

export const WorkflowInspectorPanel = ({
  canEditDefinition,
  canEditMetadata,
  isEditingNode,
  onSaveNode,
  isSavingNode,
}: Readonly<WorkflowInspectorPanelProps>) => {
  const isCollapsed = useAtomValue(isWorkflowInspectorCollapsedAtom);
  const isNodeConfigOpen = useAtomValue(isWorkflowNodeConfigModalOpenAtom);

  if (isCollapsed) return null;

  if (isNodeConfigOpen) {
    return <WorkflowNodeConfigPanel isEditable={isEditingNode} onSave={onSaveNode} isSaving={isSavingNode} />;
  }

  return (
    <aside className="flex w-[320px] shrink-0 flex-col gap-3 self-start">
      <SettingsSection canEditDefinition={canEditDefinition} canEditMetadata={canEditMetadata} />
    </aside>
  );
};
