/** Typed query-key factory. Never inline string keys: the mutation hooks invalidate these exact tuples. */
const mcpConnectionCacheKeyBase = ["mcp-connections"] as const;

export const mcpConnectionKeys = {
  all: mcpConnectionCacheKeyBase,
  list: () => [...mcpConnectionCacheKeyBase, "list"] as const,
};
