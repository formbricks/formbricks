import "server-only";
import { formatZodIssues } from "@/app/api/v3/lib/api-wrapper";
import { buildKeysetPage } from "@/app/api/v3/lib/keyset-cursor";
import { problemBadRequest, successListResponse } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { requireAuditReadAccess } from "./access";
import { type TAuditEventRow, listAuditEventRows } from "./repository";
import {
  AUDIT_EVENTS_CURSOR_KIND,
  AUDIT_EVENTS_SORT,
  type TV3AuditEvent,
  type TV3AuditEventsListQuery,
  ZV3AuditEventsListQuery,
} from "./schemas";

const serializeAuditEvent = (row: TAuditEventRow): TV3AuditEvent => ({
  id: row.id,
  timestamp: row.timestamp.toISOString(),
  actor: { id: row.actorId, type: row.actorType },
  action: row.action,
  target: { type: row.targetType, id: row.targetId },
  status: row.status,
  eventId: row.eventId,
  apiUrl: row.apiUrl,
});

/**
 * An organization's audit events, newest first. Never throws: authorization failures and an unreadable
 * request come back as problem responses, like every other v3 operation. Reads are not themselves audited.
 */
export async function listV3AuditEvents({
  authentication,
  query,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  query: TV3AuditEventsListQuery;
  requestId: string;
  instance?: string;
}): Promise<Response> {
  const access = await requireAuditReadAccess({
    authentication,
    organizationId: query.organizationId,
    requestId,
    instance,
  });
  if (access instanceof Response) return access;

  const rows = await listAuditEventRows({ organizationId: access.organizationId, query });

  const { page, nextCursor } = buildKeysetPage({
    rows,
    limit: query.limit,
    kind: AUDIT_EVENTS_CURSOR_KIND,
    sortBy: AUDIT_EVENTS_SORT,
    fp: query.fingerprint,
    sortValue: (row) => row.timestamp,
  });

  return successListResponse(
    page.map(serializeAuditEvent),
    { limit: query.limit, nextCursor },
    { requestId }
  );
}

/**
 * The same operation for a caller that holds the query as an object rather than a query string (the MCP
 * tool). It goes through the route's own query schema, so a filter, a bound or a cursor is checked by one
 * definition and answers the same 400 on either surface.
 */
export async function listV3AuditEventsFromInput({
  input,
  authentication,
  requestId,
  instance,
}: {
  input: Record<string, unknown>;
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
}): Promise<Response> {
  const parsed = ZV3AuditEventsListQuery.safeParse(input);
  if (!parsed.success) {
    return problemBadRequest(requestId, "Invalid query parameters", {
      instance,
      invalid_params: formatZodIssues(parsed.error, "query"),
    });
  }

  return listV3AuditEvents({ authentication, query: parsed.data, requestId, instance });
}
