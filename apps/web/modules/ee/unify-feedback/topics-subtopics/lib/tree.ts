import type { TaxonomyNode } from "@/modules/hub/types";

/** Depth-first lookup of a node by id within a taxonomy tree. */
export function findNodeById(
  root: TaxonomyNode | null | undefined,
  nodeId: string | null
): TaxonomyNode | null {
  if (!root || !nodeId) {
    return null;
  }
  if (root.id === nodeId) {
    return root;
  }
  for (const child of root.children ?? []) {
    const found = findNodeById(child, nodeId);
    if (found) {
      return found;
    }
  }
  return null;
}

/** The first top-level topic (root's first child) — the default selection when a tree loads. */
export function firstTopLevelNodeId(root: TaxonomyNode | null | undefined): string | null {
  return root?.children?.[0]?.id ?? null;
}
