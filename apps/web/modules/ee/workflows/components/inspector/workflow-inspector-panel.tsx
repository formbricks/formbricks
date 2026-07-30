"use client";

import { useAtomValue } from "jotai";
import { cn } from "@/lib/cn";
import { WorkflowNodeConfigPanel } from "@/modules/ee/workflows/components/inspector/workflow-node-config-panel";
import {
  isWorkflowInspectorCollapsedAtom,
  isWorkflowNodeConfigModalOpenAtom,
} from "@/modules/ee/workflows/state/editor";

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
    // Stretches to the editor row's height (no `self-start`) so the panel inside can fill it and
    // scroll its own content. No bottom padding either: both would make this column taller than the
    // canvas beside it and push the page into overflow.
    <div
      aria-hidden={!isVisible}
      className={cn(
        "min-h-0 shrink-0 overflow-hidden transition-[width,opacity] duration-150 ease-in-out",
        isVisible ? "w-[360px] opacity-100" : "w-0 opacity-0"
      )}>
      <div className="flex h-full w-[360px] flex-col gap-3">
        <WorkflowNodeConfigPanel isEditable={isEditingNode} />
      </div>
    </div>
  );
};
