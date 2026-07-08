import type { TaxonomyNode } from "@/modules/hub/types";
import type { TTaxonomyStateResponse } from "./api-client";

/** A fully-selected taxonomy scope (directory + source + field) that a tree/records query keys on. */
export type TTaxonomyScopeSelection = {
  directoryId: string;
  sourceType: string;
  sourceId: string;
  fieldId: string;
};

/** Typed query-key factory. Never inline string keys — mutation hooks target these exact tuples. */
const taxonomyCacheKeyBase = ["unify-taxonomy"] as const;
export const taxonomyKeys = {
  all: taxonomyCacheKeyBase,
  fields: (workspaceId: string, directoryId: string) =>
    [...taxonomyCacheKeyBase, "fields", workspaceId, directoryId] as const,
  state: (workspaceId: string, scope: TTaxonomyScopeSelection | null) =>
    [...taxonomyCacheKeyBase, "state", workspaceId, scope] as const,
  run: (workspaceId: string, directoryId: string, runId: string) =>
    [...taxonomyCacheKeyBase, "run", workspaceId, directoryId, runId] as const,
  nodeRecords: (workspaceId: string, directoryId: string, nodeId: string, limit: number) =>
    [...taxonomyCacheKeyBase, "node-records", workspaceId, directoryId, nodeId, limit] as const,
};

function removeNodeFromTree(node: TaxonomyNode, nodeId: string): TaxonomyNode | null {
  if (node.id === nodeId) {
    return null;
  }
  if (!node.children?.length) {
    return node;
  }
  const children = node.children
    .map((child) => removeNodeFromTree(child, nodeId))
    .filter((child): child is TaxonomyNode => child !== null);
  return { ...node, children };
}

/**
 * Optimistically drop a node (and its subtree) from cached taxonomy state, so an in-flight
 * soft-remove reflects immediately. Returns the input unchanged when there is no active tree.
 */
export function removeNodeFromStateData(
  data: TTaxonomyStateResponse | undefined,
  nodeId: string
): TTaxonomyStateResponse | undefined {
  if (!data?.activeTree?.root) {
    return data;
  }
  return {
    ...data,
    activeTree: { ...data.activeTree, root: removeNodeFromTree(data.activeTree.root, nodeId) },
  };
}
