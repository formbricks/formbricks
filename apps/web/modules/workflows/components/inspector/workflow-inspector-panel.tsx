"use client";

import { useAtomValue } from "jotai";
import { cn } from "@/lib/cn";
import { WorkflowNodeConfigPanel } from "@/modules/workflows/components/inspector/workflow-node-config-panel";
import {
  isWorkflowInspectorCollapsedAtom,
  isWorkflowNodeConfigModalOpenAtom,
} from "@/modules/workflows/state/editor";

interface WorkflowInspectorPanelProps {
  isEditingNode: boolean;
}

// The inspector's only content is the selected node's config: workflow name lives in the
// editable page title and lifecycle actions in the header dropdown, so with no node open the
// column collapses away entirely.
export const WorkflowInspectorPanel = ({ isEditingNode }: Readonly<WorkflowInspectorPanelProps>) => {
  const isCollapsed = useAtomValue(isWorkflowInspectorCollapsedAtom);
  const isNodeConfigOpen = useAtomValue(isWorkflowNodeConfigModalOpenAtom);
  const isVisible = isNodeConfigOpen && !isCollapsed;

  return (
    <div
      aria-hidden={!isVisible}
      className={cn(
        "shrink-0 overflow-hidden pb-8 transition-[width,opacity] duration-300 ease-in-out",
        isVisible ? "w-[360px] opacity-100" : "w-0 opacity-0"
      )}>
      <div className="flex w-[360px] flex-col gap-3 self-start">
        <WorkflowNodeConfigPanel isEditable={isEditingNode} />
      </div>
    </div>
  );
};
