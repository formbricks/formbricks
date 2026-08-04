import { WEBAPP_URL } from "@/lib/constants";

/**
 * The MCP endpoint path. Correct for the RFC 9457 problem-document `instance` member, which is a
 * URI *reference* — relative is expected there.
 */
export const MCP_API_ROUTE = "/api/mcp" as const;

/**
 * The same endpoint as an absolute URL, for the audit log's `apiUrl`.
 *
 * NOT interchangeable with MCP_API_ROUTE. The audit event schema validates `apiUrl` with `z.url()`,
 * and `logAuditEvent` catches the resulting validation error and downgrades it to a `logger.error`
 * line — so passing the bare path silently dropped the entire audit event and MCP mutations went
 * unaudited (ENG-2173). Every other API surface passes `req.url`, which is already absolute; the MCP
 * tools have no request object to hand, so it is derived from WEBAPP_URL instead.
 */
export const MCP_AUDIT_API_URL = new URL(MCP_API_ROUTE, WEBAPP_URL).toString();
// Names the whole XM Suite surface, not just surveys — the server also exposes workspace discovery and
// feedback records. Client config keys are user-chosen, so this is a display name only.
export const MCP_SERVER_NAME = "formbricks-xm-suite" as const;
export const MCP_SERVER_VERSION = "0.2.0" as const;
