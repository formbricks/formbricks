"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  isWorkflowNodeConfigModalOpenAtom,
  openWorkflowNodeConfigModalAtom,
  selectedWorkflowNodeIdAtom,
  setWorkflowFlowNodesAtom,
  workflowDefinitionAtom,
} from "@/modules/workflows/state/editor";

export const WORKFLOW_NODE_SEARCH_PARAM = "node";

/**
 * Two-way sync between the inspected canvas node and the `?node=` search param, so a node's
 * config view is deep-linkable and survives a reload.
 *
 * - On first hydrate, a valid `?node=` opens that node's config panel (and marks the canvas
 *   node selected, like a click would); unknown ids are ignored and cleaned up.
 * - Afterwards, selection changes are mirrored into the URL with the native
 *   `history.replaceState`, which the Next App Router supports for shallow updates — the URL
 *   changes without any navigation, reload, or server round-trip. replace (not push) because
 *   browsing nodes is not a history the Back button should walk through.
 *
 * `isEnabled` gates everything until the caller has hydrated the editor atoms.
 */
export const useWorkflowNodeUrlSync = ({ isEnabled }: Readonly<{ isEnabled: boolean }>) => {
  const searchParams = useSearchParams();
  const definition = useAtomValue(workflowDefinitionAtom);
  const selectedNodeId = useAtomValue(selectedWorkflowNodeIdAtom);
  const isNodeConfigOpen = useAtomValue(isWorkflowNodeConfigModalOpenAtom);
  const openNodeConfigModal = useSetAtom(openWorkflowNodeConfigModalAtom);
  const setFlowNodes = useSetAtom(setWorkflowFlowNodesAtom);

  // State (not a ref) so the write-back effect below stays inert during the same render pass
  // that applies the initial param — otherwise it would briefly wipe the param before the
  // config panel's open state lands.
  const [hasAppliedInitialNode, setHasAppliedInitialNode] = useState(false);

  useEffect(() => {
    if (!isEnabled || hasAppliedInitialNode || !definition) return;
    setHasAppliedInitialNode(true);

    const nodeId = searchParams.get(WORKFLOW_NODE_SEARCH_PARAM);
    if (!nodeId) return;
    const nodeExists =
      definition.trigger?.id === nodeId || definition.nodes.some((node) => node.id === nodeId);
    if (!nodeExists) return;

    openNodeConfigModal(nodeId);
    // Mirror what a canvas click does: ReactFlow marks the clicked node selected.
    setFlowNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.selected === (node.id === nodeId) ? node : { ...node, selected: node.id === nodeId }
      )
    );
  }, [isEnabled, hasAppliedInitialNode, definition, searchParams, openNodeConfigModal, setFlowNodes]);

  useEffect(() => {
    if (!isEnabled || !hasAppliedInitialNode) return;

    const url = new URL(window.location.href);
    const currentParam = url.searchParams.get(WORKFLOW_NODE_SEARCH_PARAM);
    const nextParam = isNodeConfigOpen && selectedNodeId ? selectedNodeId : null;
    if (currentParam === nextParam) return;

    if (nextParam) {
      url.searchParams.set(WORKFLOW_NODE_SEARCH_PARAM, nextParam);
    } else {
      url.searchParams.delete(WORKFLOW_NODE_SEARCH_PARAM);
    }
    // Preserve the router's history state — Next piggybacks internal data on the entry.
    window.history.replaceState(window.history.state, "", url.toString());
  }, [isEnabled, hasAppliedInitialNode, isNodeConfigOpen, selectedNodeId]);
};
