"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { ArrowLeftIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TWorkflowDefinition, TWorkflowNode } from "@formbricks/workflows";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { getNodeRegistryEntry } from "@/modules/workflows/lib/node-registry";
import {
  closeWorkflowNodeConfigModalAtom,
  selectedWorkflowNodeIdAtom,
  setWorkflowDefinitionAtom,
  workflowDefinitionAtom,
} from "@/modules/workflows/state/editor";

interface WorkflowNodeConfigPanelProps {
  isEditable: boolean;
  onSave?: () => Promise<void> | void;
  isSaving?: boolean;
}

const findSelectedNode = (
  definition: TWorkflowDefinition | null,
  selectedNodeId: string | null
): TWorkflowNode | null => {
  if (!definition || !selectedNodeId) return null;
  if (definition.trigger.id === selectedNodeId) return definition.trigger;
  return definition.nodes.find((node) => node.id === selectedNodeId) ?? null;
};

const replaceNode = (definition: TWorkflowDefinition, node: TWorkflowNode): TWorkflowDefinition => {
  if (node.type === "trigger" && node.id === definition.trigger.id) {
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

// Inner component keyed by node id so React remounts a fresh draft state whenever the user
// switches between nodes. The previous useEffect-based reset ran AFTER render, so the new
// ConfigForm briefly received the wrong node and crashed on shape-specific fields (e.g. the
// email form reading `node.config.replyTo` while the trigger node was still in state).
const NodeConfigEditor = ({
  initialNode,
  isEditable,
  isSaving,
  onSave,
  onCancel,
}: Readonly<{
  initialNode: TWorkflowNode;
  isEditable: boolean;
  isSaving: boolean;
  onSave: (node: TWorkflowNode) => Promise<void> | void;
  onCancel: () => void;
}>) => {
  const { t } = useTranslation();
  const [draftNode, setDraftNode] = useState<TWorkflowNode>(initialNode);

  const registryEntry = getNodeRegistryEntry(draftNode);
  const ConfigForm = registryEntry.ConfigForm;

  return (
    <aside className="flex w-[320px] shrink-0 flex-col gap-3 self-start rounded-lg border border-slate-200 bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" aria-label={t("common.back")} onClick={onCancel}>
            <ArrowLeftIcon className="size-4" />
          </Button>
          <span className="text-sm font-semibold text-slate-900">{registryEntry.title(draftNode, t)}</span>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => onSave(draftNode)}
          loading={isSaving}
          disabled={!isEditable || !ConfigForm || isSaving}>
          {t("common.save")}
        </Button>
      </header>
      <div className="flex flex-col gap-3 px-3 pb-4">
        {!isEditable && (
          <Alert variant="info" size="small">
            <AlertDescription>{t("workspace.workflows.edit_blocked_active")}</AlertDescription>
          </Alert>
        )}
        {ConfigForm ? (
          <ConfigForm node={draftNode} isEditable={isEditable} onChange={setDraftNode} />
        ) : (
          <p className="text-sm text-slate-500">{t("workspace.workflows.inspector_unsupported_node")}</p>
        )}
      </div>
    </aside>
  );
};

// Renders inside the inspector aside (replaces the workflow-level sections while a node is
// being configured). The Back arrow restores the workflow-level view; Save commits the draft
// to the definition atom and triggers the page-level save.
export const WorkflowNodeConfigPanel = ({
  isEditable,
  onSave,
  isSaving = false,
}: Readonly<WorkflowNodeConfigPanelProps>) => {
  const definition = useAtomValue(workflowDefinitionAtom);
  const selectedNodeId = useAtomValue(selectedWorkflowNodeIdAtom);
  const closePanel = useSetAtom(closeWorkflowNodeConfigModalAtom);
  const setDefinition = useSetAtom(setWorkflowDefinitionAtom);

  const selectedNode = findSelectedNode(definition, selectedNodeId);
  if (!selectedNode || !definition) return null;

  const handleSave = async (draftNode: TWorkflowNode) => {
    setDefinition(replaceNode(definition, draftNode));
    closePanel();
    await onSave?.();
  };

  return (
    <NodeConfigEditor
      key={selectedNode.id}
      initialNode={selectedNode}
      isEditable={isEditable}
      isSaving={isSaving}
      onSave={handleSave}
      onCancel={() => closePanel()}
    />
  );
};
