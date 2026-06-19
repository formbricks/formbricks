"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { ArrowLeftIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TWorkflowDefinition, TWorkflowNode } from "@formbricks/workflows";
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

// Renders inside the inspector aside (replaces the workflow-level sections while a node is
// being configured). The Back arrow restores the workflow-level view; Save commits the draft
// to the definition atom and triggers the page-level save.
export const WorkflowNodeConfigPanel = ({
  isEditable,
  onSave,
  isSaving = false,
}: Readonly<WorkflowNodeConfigPanelProps>) => {
  const { t } = useTranslation();
  const definition = useAtomValue(workflowDefinitionAtom);
  const selectedNodeId = useAtomValue(selectedWorkflowNodeIdAtom);
  const closePanel = useSetAtom(closeWorkflowNodeConfigModalAtom);
  const setDefinition = useSetAtom(setWorkflowDefinitionAtom);

  const selectedNode = findSelectedNode(definition, selectedNodeId);
  const [draftNode, setDraftNode] = useState<TWorkflowNode | null>(selectedNode);

  // Re-seed the draft whenever the panel is opened against a new node so we don't carry over
  // a stale draft from a previous selection.
  useEffect(() => {
    setDraftNode(selectedNode);
  }, [selectedNode]);

  if (!selectedNode) return null;

  const registryEntry = getNodeRegistryEntry(selectedNode);
  const ConfigForm = registryEntry.ConfigForm;

  const handleSave = async () => {
    if (!draftNode || !definition) {
      closePanel();
      return;
    }
    setDefinition(replaceNode(definition, draftNode));
    closePanel();
    await onSave?.();
  };

  return (
    <aside className="flex w-[320px] shrink-0 flex-col gap-3 self-start rounded-lg border border-slate-200 bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("common.back")}
            onClick={() => closePanel()}>
            <ArrowLeftIcon className="size-4" />
          </Button>
          <span className="text-sm font-semibold text-slate-900">{registryEntry.title(selectedNode, t)}</span>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          loading={isSaving}
          disabled={!isEditable || !ConfigForm || isSaving}>
          {t("common.save")}
        </Button>
      </header>
      <div className="px-3 pb-4">
        {ConfigForm && draftNode ? (
          <ConfigForm
            key={selectedNode.id}
            node={draftNode}
            isEditable={isEditable}
            onChange={setDraftNode}
          />
        ) : (
          <p className="text-sm text-slate-500">{t("workspace.workflows.inspector_unsupported_node")}</p>
        )}
      </div>
    </aside>
  );
};
