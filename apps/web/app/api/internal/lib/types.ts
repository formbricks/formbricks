import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";

/** What every internal operation is handed about its request: the id it answers with and its path. */
export type TRequestMeta = { requestId: string; instance?: string };

/** A pre-login operation's request: no session, and the wrapper's audit entry where the route is audited. */
export type TPreLoginRequestContext = TRequestMeta & { auditLog?: TV3AuditLog };

/** A session operation's request: the caller's authentication, and the wrapper's audit entry. */
export type TRequestContext = TPreLoginRequestContext & { authentication: TV3Authentication };

/** A session operation's request on one organization (whitelabel, billing, the organization itself). */
export type TOrganizationRequestContext = TRequestContext & { organizationId: string };

/** A session operation's request on one workspace the route names in its path. */
export type TWorkspaceRequestContext = TRequestContext & { workspaceId: string };
