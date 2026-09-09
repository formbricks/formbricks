/** Typed query-key factory for the enrichment-status read. Never inline string keys. */
export const enrichmentStatusKeys = {
  all: ["unify-enrichment-status"] as const,
  status: (workspaceId: string) => [...enrichmentStatusKeys.all, workspaceId] as const,
};
