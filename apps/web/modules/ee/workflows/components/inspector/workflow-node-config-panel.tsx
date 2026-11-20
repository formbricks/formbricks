"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { ExternalLinkIcon } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { TWorkflowDefinition, TWorkflowNode, TWorkflowResource } from "@formbricks/workflows";
import { getWorkflowNodeConcreteType, isConditionStepNode } from "@formbricks/workflows";
import { WorkflowNodeChip } from "@/modules/ee/workflows/components/canvas/workflow-node-card";
import { WorkflowAlert } from "@/modules/ee/workflows/components/workflow-alert";
import { WorkflowPanelCollapseButton } from "@/modules/ee/workflows/components/workflow-side-panel";
import { trackWorkflowEvent } from "@/modules/ee/workflows/lib/analytics";
import { WORKFLOW_CLIENT_EVENTS } from "@/modules/ee/workflows/lib/analytics-events";
import { withSurveyOperatorNamesInDefinition } from "@/modules/ee/workflows/lib/if-else-conditions";
import { getNodeRegistryEntry } from "@/modules/ee/workflows/lib/node-registry";
import { withSwitchBranchesPruned } from "@/modules/ee/workflows/lib/workflow-steps";
import {
  isWorkflowReadOnlyAtom,
  selectedWorkflowNodeIdAtom,
  setWorkflowDefinitionAtom,
  toggleWorkflowInspectorAtom,
  workflowDefinitionAtom,
  workflowStatusAtom,
} from "@/modules/ee/workflows/state/editor";

interface WorkflowNodeConfigPanelProps {
  isEditable: boolean;
}

const findSelectedNode = (
  definition: TWorkflowDefinition | null,
  selectedNodeId: string | null
): TWorkflowNode | null => {
  if (!definition || !selectedNodeId) return null;
  if (definition.trigger?.id === selectedNodeId) return definition.trigger;
  return definition.nodes.find((node) => node.id === selectedNodeId) ?? null;
};

// `isEditable` collapses three distinct block reasons (no permission, archived, enabled) into one
// boolean; name the actual reason instead of always blaming an "active" workflow. Precedence:
// permission wins — a read-only member sees the permission message even on an enabled/archived
// workflow — then archived, then active/enabled. Returns a reason discriminant, not the i18n key,
// so the caller resolves it with literal `t("…")` calls the translation scanner can detect.
type TBlockedReason = "readOnly" | "archived" | "active";

const getBlockedReason = (
  isEditable: boolean,
  isReadOnly: boolean,
  status: TWorkflowResource["status"] | undefined | null
): TBlockedReason | null => {
  if (isEditable) return null;
  if (isReadOnly) return "readOnly";
  if (status === "archived") return "archived";
  return "active";
};

const replaceNode = (definition: TWorkflowDefinition, node: TWorkflowNode): TWorkflowDefinition => {
  if (node.type === "trigger" && node.id === definition.trigger?.id) {
    return { ...definition, trigger: node };
  }

  if (node.type === "trigger") {
    return definition;
  }

  return {
    ...definition,
    nodes: definition.nodes.map((existingNode) => (existingNode.id === node.id ? node : existingNode)),
  };
};

/**
 * Renders inside the inspector aside (replaces the workflow-level sections while a node is being
 * configured). Every form change writes straight into the definition atom, so the canvas node
 * (title, summary, issue flag) and the whole-workflow validity update live; persistence is owned
 * by the page-level autosave. The workflow Settings view is reached via the canvas cog, not a
 * Back arrow — the two views are siblings, not a hierarchy.
 */
export const WorkflowNodeConfigPanel = ({ isEditable }: Readonly<WorkflowNodeConfigPanelProps>) => {
  const { t } = useTranslation();
  const definition = useAtomValue(workflowDefinitionAtom);
  const selectedNodeId = useAtomValue(selectedWorkflowNodeIdAtom);
  // Read only the status primitive, not the whole workflow: autosave replaces the workflow atom
  // with the API response every ~2s, and subscribing to it here would re-render this panel (and the
  // rich-text email editor it hosts) on every save. Jotai bails out when the primitive is unchanged.
  const status = useAtomValue(workflowStatusAtom);
  const isReadOnly = useAtomValue(isWorkflowReadOnlyAtom);
  const setDefinition = useSetAtom(setWorkflowDefinitionAtom);
  const collapsePanel = useSetAtom(toggleWorkflowInspectorAtom);

  const selectedNode = findSelectedNode(definition, selectedNodeId);
  const registryEntry = selectedNode ? getNodeRegistryEntry(selectedNode) : null;

  // Analytics: which node kinds people actually open, and whether they land on a kind that has no
  // form yet (`if_else` today). Keyed on the node id so re-renders of an open panel do not re-fire.
  const nodeType = selectedNode ? getWorkflowNodeConcreteType(selectedNode) : null;
  const hasConfigForm = registryEntry?.ConfigForm !== null;
  useEffect(() => {
    if (!selectedNodeId || !nodeType) return;
    trackWorkflowEvent(WORKFLOW_CLIENT_EVENTS.inspectorOpened, {
      node_type: nodeType,
      has_config_form: hasConfigForm,
      is_editable: isEditable,
    });
  }, [selectedNodeId, nodeType, hasConfigForm, isEditable]);

  if (!selectedNode || !definition || !registryEntry) return null;

  const blockedReasonType = getBlockedReason(isEditable, isReadOnly, status);
  // Inline literal t() calls so the translation-key scanner detects the keys.
  const blockedReasonMessages: Record<TBlockedReason, string> = {
    readOnly: t("workspace.workflows.edit_blocked_read_only"),
    archived: t("workspace.workflows.edit_blocked_archived"),
    active: t("workspace.workflows.edit_blocked_active"),
  };
  const blockedReason = blockedReasonType ? blockedReasonMessages[blockedReasonType] : null;

  const ConfigForm = registryEntry.ConfigForm;

  const handleChange = (nextNode: TWorkflowNode) => {
    if (!isEditable) return;
    setDefinition((currentDefinition) => {
      if (!currentDefinition) return currentDefinition;
      const next = replaceNode(currentDefinition, nextNode);
      // A removed Switch case takes its branch with it (the panel confirmed when it had steps).
      if (nextNode.type === "switch") {
        return withSurveyOperatorNamesInDefinition(withSwitchBranchesPruned(next, nextNode));
      }
      // The If/else and Filter panels write survey operator names; keep every other condition step on
      // the same set.
      return isConditionStepNode(nextNode) ? withSurveyOperatorNamesInDefinition(next) : next;
    });
  };

  return (
    // Fills the editor row's height and scrolls its fields internally, so a config form longer than
    // the row can't grow the page. A page-level scrollbar would be useless here anyway: the canvas
    // beside it clips rather than scrolls, so scrolling the page only reveals blank space. `min-h-0`
    // is what allows the shrink; without it the flex item would be floored at its content height.
    // The header sits outside the scrolling area and stays put.
    <aside className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 py-2 pr-2 pl-4">
        {/* The step's colored icon, as on its canvas card, so the panel reads as that step at a glance. */}
        <div className="flex min-w-0 items-center gap-2">
          <WorkflowNodeChip icon={registryEntry.icon} category={registryEntry.category} size="sm" />
          <h2 className="truncate text-sm font-semibold text-slate-900">
            {registryEntry.title(selectedNode, t)}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {registryEntry.docsUrl ? (
            <a
              href={registryEntry.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
              {t("common.docs")}
              <ExternalLinkIcon className="size-3" aria-hidden />
            </a>
          ) : null}
          {/* In the panel it collapses, as in the main navigation (review point 5). */}
          <WorkflowPanelCollapseButton side="right" onCollapse={collapsePanel} />
        </div>
      </header>
      <div className="scroll-bar min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3 px-3 pt-3 pb-4">
          {blockedReason && <WorkflowAlert variant="info">{blockedReason}</WorkflowAlert>}
          {ConfigForm ? (
            // Keyed by node id so switching nodes remounts the form with fresh local UI state
            // (e.g. the email editor's firstRender flag) instead of reconciling across shapes.
            <ConfigForm
              key={selectedNode.id}
              node={selectedNode}
              isEditable={isEditable}
              onChange={handleChange}
            />
          ) : (
            <p className="text-sm text-slate-500">{t("workspace.workflows.inspector_unsupported_node")}</p>
          )}
        </div>
      </div>
    </aside>
  );
};
