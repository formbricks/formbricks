"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { WorkflowNodeChip } from "@/modules/ee/workflows/components/canvas/workflow-node-card";
import { WorkflowNodeConfigPanel } from "@/modules/ee/workflows/components/inspector/workflow-node-config-panel";
import { WorkflowPanelRail } from "@/modules/ee/workflows/components/workflow-side-panel";
import { getNodeRegistryEntry } from "@/modules/ee/workflows/lib/node-registry";
import {
  isWorkflowInspectorCollapsedAtom,
  isWorkflowNodeConfigModalOpenAtom,
  selectedWorkflowNodeIdAtom,
  toggleWorkflowInspectorAtom,
  workflowDefinitionAtom,
} from "@/modules/ee/workflows/state/editor";

interface WorkflowInspectorPanelProps {
  isEditingNode: boolean;
}

/** The open step's icon and name, for the collapsed panel's rail. */
const CollapsedStepRail = () => {
  const { t } = useTranslation();
  const definition = useAtomValue(workflowDefinitionAtom);
  const selectedNodeId = useAtomValue(selectedWorkflowNodeIdAtom);
  const expand = useSetAtom(toggleWorkflowInspectorAtom);
  const node =
    definition?.trigger?.id === selectedNodeId
      ? definition.trigger
      : (definition?.nodes.find((candidate) => candidate.id === selectedNodeId) ?? null);
  const entry = node ? getNodeRegistryEntry(node) : null;
  const title = node && entry ? entry.title(node, t) : "";

  return (
    <WorkflowPanelRail side="right" label={title} onExpand={expand}>
      {entry ? (
        <button type="button" onClick={expand} aria-label={title} title={title}>
          <WorkflowNodeChip icon={entry.icon} category={entry.category} size="sm" />
        </button>
      ) : null}
    </WorkflowPanelRail>
  );
};

// The inspector's only content is the selected node's config: workflow name lives in the
// editable page title and lifecycle actions in the header dropdown, so with no node open the
// column collapses away entirely. Collapsed while a step is open, it keeps a rail with that step
// (review point 5), so the canvas never loses its point of reference.
export const WorkflowInspectorPanel = ({ isEditingNode }: Readonly<WorkflowInspectorPanelProps>) => {
  const isCollapsed = useAtomValue(isWorkflowInspectorCollapsedAtom);
  const isNodeConfigOpen = useAtomValue(isWorkflowNodeConfigModalOpenAtom);
  const isVisible = isNodeConfigOpen && !isCollapsed;

  if (isNodeConfigOpen && isCollapsed) return <CollapsedStepRail />;

  return (
    // Stretches to the editor row's height (no `self-start`) so the panel inside can fill it and
    // scroll its own content. No bottom padding either: both would make this column taller than the
    // canvas beside it and push the page into overflow. 380px on laptop-width screens leaves the
    // canvas room; 480px from 2xl (1536px) up.
    <div
      aria-hidden={!isVisible}
      className={cn(
        "min-h-0 shrink-0 overflow-hidden transition-[width,opacity] duration-150 ease-in-out",
        isVisible ? "w-[380px] opacity-100 2xl:w-[480px]" : "w-0 opacity-0"
      )}>
      {/* Only mount the fixed-width content while the panel is open. Left mounted when collapsed,
          this fixed-width block lays out off-screen to the right and — even inside the `w-0`
          `overflow-hidden` column — inflates the document's scroll width, producing a phantom
          horizontal scrollbar (most visible after collapsing the main nav). */}
      {isVisible && (
        <div className="flex h-full w-[380px] flex-col gap-3 2xl:w-[480px]">
          <WorkflowNodeConfigPanel isEditable={isEditingNode} />
        </div>
      )}
    </div>
  );
};
