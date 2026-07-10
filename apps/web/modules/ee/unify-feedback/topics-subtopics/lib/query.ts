import type { TaxonomyNode, TaxonomyScopeType } from "@/modules/hub/types";
import type { TTaxonomyStateResponse } from "./api-client";

/**
 * A selected taxonomy scope that tree/records/run queries key on. Directory scope
 * (`scopeType: "directory"`) covers all text feedback in the directory and omits source/field;
 * field scope carries all three. The whole object is part of the query key, so the two variants
 * cache independently.
 */
export type TTaxonomyScopeSelection = {
  directoryId: string;
  scopeType: TaxonomyScopeType;
  sourceType?: string;
  sourceId?: string;
  fieldId?: string;
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
  recordCounts: (workspaceId: string, directoryId: string, runId: string) =>
    [...taxonomyCacheKeyBase, "record-counts", workspaceId, directoryId, runId] as const,
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
