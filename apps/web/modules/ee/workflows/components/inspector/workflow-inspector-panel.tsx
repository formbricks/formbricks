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
    <div
      aria-hidden={!isVisible}
      className={cn(
        "shrink-0 overflow-hidden pb-8 transition-[width,opacity] duration-150 ease-in-out",
        isVisible ? "w-[360px] opacity-100" : "w-0 opacity-0"
      )}>
      {/* Only mount the fixed-width content while the panel is open. Left mounted when collapsed,
          this 360px block lays out off-screen to the right and — even inside the `w-0`
          `overflow-hidden` column — inflates the document's scroll width, producing a phantom
          horizontal scrollbar (most visible after collapsing the main nav). The content is already
          hidden (opacity-0) while collapsed, so gating the mount changes nothing visible. */}
      {isVisible && (
        <div className="flex w-[360px] flex-col gap-3 self-start">
          <WorkflowNodeConfigPanel isEditable={isEditingNode} />
        </div>
      )}
    </div>
  );
};
