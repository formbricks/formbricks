"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TWorkflowDefinition, TWorkflowNode } from "@formbricks/workflows";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { getNodeRegistryEntry } from "@/modules/workflows/lib/node-registry";
import {
  closeWorkflowNodeConfigModalAtom,
  isWorkflowNodeConfigModalOpenAtom,
  selectedWorkflowNodeIdAtom,
  setWorkflowDefinitionAtom,
  workflowDefinitionAtom,
} from "@/modules/workflows/state/editor";

interface WorkflowNodeConfigModalProps {
  isEditable: boolean;
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

export const WorkflowNodeConfigModal = ({ isEditable }: Readonly<WorkflowNodeConfigModalProps>) => {
  const { t } = useTranslation();
  const definition = useAtomValue(workflowDefinitionAtom);
  const selectedNodeId = useAtomValue(selectedWorkflowNodeIdAtom);
  const isOpen = useAtomValue(isWorkflowNodeConfigModalOpenAtom);
  const closeModal = useSetAtom(closeWorkflowNodeConfigModalAtom);
  const setDefinition = useSetAtom(setWorkflowDefinitionAtom);

  const selectedNode = findSelectedNode(definition, selectedNodeId);
  const [draftNode, setDraftNode] = useState<TWorkflowNode | null>(selectedNode);

  useEffect(() => {
    if (isOpen) {
      setDraftNode(selectedNode);
    }
  }, [isOpen, selectedNode]);

  const handleOpenChange = (open: boolean) => {
    if (!open) closeModal();
  };

  const handleSave = () => {
    if (!draftNode || !definition) {
      closeModal();
      return;
    }
    setDefinition(replaceNode(definition, draftNode));
    closeModal();
  };

  if (!selectedNode) {
    return null;
  }

  const registryEntry = getNodeRegistryEntry(selectedNode);
  const ConfigForm = registryEntry.ConfigForm;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{registryEntry.title(selectedNode, t)}</DialogTitle>
        </DialogHeader>
        <DialogBody>
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
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => closeModal()}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={!isEditable || !ConfigForm}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
