/** Typed query-key factory. Never inline string keys: the mutation hooks invalidate these exact tuples. */
const authorizedMcpClientCacheKeyBase = ["authorized-mcp-clients"] as const;

export const authorizedMcpClientKeys = {
  all: authorizedMcpClientCacheKeyBase,
  list: () => [...authorizedMcpClientCacheKeyBase, "list"] as const,
};
