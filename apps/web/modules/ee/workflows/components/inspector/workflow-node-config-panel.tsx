"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import type { TWorkflowDefinition, TWorkflowNode, TWorkflowResource } from "@formbricks/workflows";
import { getNodeRegistryEntry } from "@/modules/ee/workflows/lib/node-registry";
import {
  isWorkflowReadOnlyAtom,
  selectedWorkflowNodeIdAtom,
  setWorkflowDefinitionAtom,
  workflowDefinitionAtom,
  workflowStatusAtom,
} from "@/modules/ee/workflows/state/editor";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";

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
// workflow — then archived, then active/enabled. Returns the translation key; the caller runs t().
const getBlockedReasonKey = (
  isEditable: boolean,
  isReadOnly: boolean,
  status: TWorkflowResource["status"] | undefined | null
): string | null => {
  if (isEditable) return null;
  if (isReadOnly) return "workspace.workflows.edit_blocked_read_only";
  if (status === "archived") return "workspace.workflows.edit_blocked_archived";
  return "workspace.workflows.edit_blocked_active";
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

  const selectedNode = findSelectedNode(definition, selectedNodeId);
  if (!selectedNode || !definition) return null;

  const blockedReasonKey = getBlockedReasonKey(isEditable, isReadOnly, status);
  const blockedReason = blockedReasonKey ? t(blockedReasonKey) : null;

  const registryEntry = getNodeRegistryEntry(selectedNode);
  const ConfigForm = registryEntry.ConfigForm;

  const handleChange = (nextNode: TWorkflowNode) => {
    if (!isEditable) return;
    setDefinition((currentDefinition) =>
      currentDefinition ? replaceNode(currentDefinition, nextNode) : currentDefinition
    );
  };

  return (
    // Fills the editor row's height and scrolls its fields internally, so a config form longer than
    // the row can't grow the page. A page-level scrollbar would be useless here anyway: the canvas
    // beside it clips rather than scrolls, so scrolling the page only reveals blank space. `min-h-0`
    // is what allows the shrink; without it the flex item would be floored at its content height.
    // The header sits outside the scrolling area and stays put.
    <aside className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <header className="flex shrink-0 items-center border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{registryEntry.title(selectedNode, t)}</h2>
      </header>
      <div className="scroll-bar min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3 px-3 pt-3 pb-4">
          {blockedReason && (
            <Alert variant="info" size="small">
              <AlertDescription>{blockedReason}</AlertDescription>
            </Alert>
          )}
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
