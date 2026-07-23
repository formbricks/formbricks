"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import type { TWorkflowDefinition, TWorkflowNode } from "@formbricks/workflows";
import { getNodeRegistryEntry } from "@/modules/ee/workflows/lib/node-registry";
import {
  selectedWorkflowNodeIdAtom,
  setWorkflowDefinitionAtom,
  workflowDefinitionAtom,
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
  const setDefinition = useSetAtom(setWorkflowDefinitionAtom);

  const selectedNode = findSelectedNode(definition, selectedNodeId);
  if (!selectedNode || !definition) return null;

  const registryEntry = getNodeRegistryEntry(selectedNode);
  const ConfigForm = registryEntry.ConfigForm;

  const handleChange = (nextNode: TWorkflowNode) => {
    if (!isEditable) return;
    setDefinition((currentDefinition) =>
      currentDefinition ? replaceNode(currentDefinition, nextNode) : currentDefinition
    );
  };

  return (
    <aside className="w-[360px] shrink-0 self-start rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-3">
        <header className="flex items-center border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{registryEntry.title(selectedNode, t)}</h2>
        </header>
        <div className="flex flex-col gap-3 px-3 pb-4">
          {!isEditable && (
            <Alert variant="info" size="small">
              <AlertDescription>{t("workspace.workflows.edit_blocked_active")}</AlertDescription>
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
