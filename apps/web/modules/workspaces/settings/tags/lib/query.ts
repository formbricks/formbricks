/** Typed query-key factory. Never inline string keys — the mutation hooks invalidate these exact tuples. */
const tagCacheKeyBase = ["workspace-tags"] as const;

export const tagKeys = {
  all: tagCacheKeyBase,
  list: (workspaceId: string) => [...tagCacheKeyBase, "list", workspaceId] as const,
};
