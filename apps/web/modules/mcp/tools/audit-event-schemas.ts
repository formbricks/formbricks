import { z } from "zod";
import {
  AUDIT_EVENTS_DEFAULT_LIMIT,
  AUDIT_EVENTS_MAX_LIMIT,
  ZV3AuditEventsQueryBase,
} from "@/app/api/v3/audit-events/lib/schemas";

/**
 * Input and output of `list_audit_events`. The input extends the v3 query's own fields, so a filter, a
 * bound or an enum is defined once; the route's refinements (a `targetId` needs its `targetType`, `from`
 * before `to`, the cursor binding) run when the operation parses the input, and answer the same 400.
 */
export const ZMcpListAuditEventsInput = ZV3AuditEventsQueryBase.extend({
  organizationId: ZV3AuditEventsQueryBase.shape.organizationId.describe(
    "Organization whose audit events to read. Each workspace from list_workspaces carries its organizationId."
  ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(AUDIT_EVENTS_MAX_LIMIT)
    .default(AUDIT_EVENTS_DEFAULT_LIMIT)
    .describe(`Maximum number of events to return. Defaults to ${AUDIT_EVENTS_DEFAULT_LIMIT}.`),
  cursor: ZV3AuditEventsQueryBase.shape.cursor.describe(
    "Opaque pagination cursor from a previous list_audit_events result. Only valid with the same filters."
  ),
  actorId: ZV3AuditEventsQueryBase.shape.actorId.describe(
    "Only events caused by this actor: a user id, an API key id, or `system`."
  ),
  actorType: ZV3AuditEventsQueryBase.shape.actorType.describe(
    "Only events caused by this kind of actor: `user` (a person or an OAuth client acting for one), `api` (an API key) or `system`."
  ),
  action: ZV3AuditEventsQueryBase.shape.action.describe("Only events with this action, e.g. `deleted`."),
  targetType: ZV3AuditEventsQueryBase.shape.targetType.describe(
    "Only events about this kind of resource, e.g. `survey`. Required when targetId is set."
  ),
  targetId: ZV3AuditEventsQueryBase.shape.targetId.describe(
    "Only events about this one resource. Requires targetType."
  ),
  status: ZV3AuditEventsQueryBase.shape.status.describe(
    "Only events that succeeded, or only attempts that failed (including refusals)."
  ),
  from: ZV3AuditEventsQueryBase.shape.from.describe(
    "Only events at or after this ISO 8601 timestamp (inclusive)."
  ),
  to: ZV3AuditEventsQueryBase.shape.to.describe(
    "Only events before this ISO 8601 timestamp (exclusive). Must be later than from."
  ),
}).strict();
export type TMcpListAuditEventsInput = z.infer<typeof ZMcpListAuditEventsInput>;
