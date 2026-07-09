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
}

export const WorkflowInspectorPanel = ({
  canEditMetadata,
  isEditingNode,
}: Readonly<WorkflowInspectorPanelProps>) => {
  const isCollapsed = useAtomValue(isWorkflowInspectorCollapsedAtom);
  const isNodeConfigOpen = useAtomValue(isWorkflowNodeConfigModalOpenAtom);

  return (
    <div
      aria-hidden={isCollapsed}
      className={cn(
        "shrink-0 overflow-hidden pb-8 transition-[width,opacity] duration-300 ease-in-out",
        isCollapsed ? "w-0 opacity-0" : "w-[360px] opacity-100"
      )}>
      <div className="flex w-[360px] flex-col gap-3 self-start">
        {isNodeConfigOpen ? (
          <WorkflowNodeConfigPanel isEditable={isEditingNode} />
        ) : (
          <SettingsSection canEditMetadata={canEditMetadata} />
        )}
      </div>
    </div>
  );
};
