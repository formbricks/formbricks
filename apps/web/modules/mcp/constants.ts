/**
 * The MCP endpoint path. Correct for the RFC 9457 problem-document `instance` member, which is a
 * URI *reference* — relative is expected there.
 */
export const MCP_API_ROUTE = "/api/mcp" as const;

// Names the whole XM Suite surface, not just surveys — the server also exposes workspace discovery and
// feedback records. Client config keys are user-chosen, so this is a display name only.
export const MCP_SERVER_NAME = "formbricks-xm-suite" as const;
export const MCP_SERVER_VERSION = "0.2.0" as const;

/**
 * The most MCP connections Authorized apps lists for one user. Far above real use (a handful of clients
 * each), it bounds the read for an account that open client registration filled with connections.
 */
export const MAX_LISTED_MCP_CONNECTIONS = 500;
