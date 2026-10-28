import { z } from "zod";
import {
  type TKeysetCursor,
  computeFilterFingerprint,
  decodeKeysetCursor,
} from "@/app/api/v3/lib/keyset-cursor";
import { ZActor, ZAuditAction, ZAuditStatus, ZAuditTarget } from "@/modules/ee/audit-logs/types/audit-log";

export const AUDIT_EVENTS_CURSOR_KIND = "audit-events";
export const AUDIT_EVENTS_SORT = "-timestamp";
export const AUDIT_EVENTS_DEFAULT_LIMIT = 20;
export const AUDIT_EVENTS_MAX_LIMIT = 100;

/** Ids are caller-supplied filter values, never dereferenced; the bound only keeps the query small. */
const ZFilterId = z.string().trim().min(1).max(255);

/**
 * The filters a cursor is bound to: a cursor issued for one organization or filter set is rejected on a
 * request with another, instead of continuing a walk through different rows. `limit` is not part of it.
 */
const auditEventsFingerprint = (filters: Record<string, string | undefined>): string =>
  computeFilterFingerprint(filters);

/** The query's fields before its cross-field rules, so the MCP input can extend them. */
export const ZV3AuditEventsQueryBase = z
  .object({
    organizationId: z.cuid2(),
    limit: z.coerce.number().int().min(1).max(AUDIT_EVENTS_MAX_LIMIT).default(AUDIT_EVENTS_DEFAULT_LIMIT),
    cursor: z.string().trim().min(1).optional(),
    actorId: ZFilterId.optional(),
    actorType: ZActor.optional(),
    action: ZAuditAction.optional(),
    targetType: ZAuditTarget.optional(),
    targetId: ZFilterId.optional(),
    status: ZAuditStatus.optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

/**
 * `GET /api/v3/audit-events` query. Strict, so a misspelled filter is a 400 rather than an unfiltered
 * page. The cursor is decoded here, in the parse layer, so a malformed or mismatched one is a 400 on
 * `cursor` like any other invalid parameter.
 *
 * `from` is inclusive and `to` exclusive, so adjacent windows neither overlap nor leave a gap.
 */
export const ZV3AuditEventsListQuery = ZV3AuditEventsQueryBase
  // `targetId` alone has no index to serve it; with its type it is one prefix of the target index.
  .refine((query) => !query.targetId || query.targetType, {
    path: ["targetType"],
    message: "targetType is required when targetId is set",
  })
  .refine((query) => !query.from || !query.to || new Date(query.from) < new Date(query.to), {
    path: ["to"],
    message: "to must be later than from",
  })
  .transform((query, ctx) => {
    const { cursor: rawCursor, limit, from, to, ...rest } = query;
    // Normalized to UTC instants, so the same window written with another offset keeps its cursor.
    const filters = {
      ...rest,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
    };
    const fingerprint = auditEventsFingerprint(filters);
    let cursor: TKeysetCursor | null = null;

    if (rawCursor) {
      try {
        cursor = decodeKeysetCursor(rawCursor, {
          kind: AUDIT_EVENTS_CURSOR_KIND,
          sortBy: AUDIT_EVENTS_SORT,
          fp: fingerprint,
        });
      } catch (error) {
        ctx.addIssue({
          code: "custom",
          path: ["cursor"],
          message: error instanceof Error ? error.message : "The cursor is invalid.",
        });
        return z.NEVER;
      }
    }

    return {
      ...filters,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit,
      cursor,
      fingerprint,
    };
  });

export type TV3AuditEventsListQuery = z.infer<typeof ZV3AuditEventsListQuery>;

/**
 * An audit event as the API answers it, so the MCP output schema derives from it instead of retyping it.
 *
 * A summary on purpose: who did what to which resource, when, and how it ended. Not returned, though
 * stored: the redacted `changes` diff (variable size, and a list page must stay small), and the
 * requester's `ipAddress` and `userAgent` (personal data this endpoint has no need to hand out).
 */
export const ZV3AuditEventResource = z.object({
  id: z.string(),
  timestamp: z.string(),
  actor: z.object({ id: z.string(), type: ZActor }),
  action: z.string(),
  target: z.object({ type: z.string(), id: z.string().nullable() }),
  status: ZAuditStatus,
  /** The request id of a failed attempt; null on a success. */
  eventId: z.string().nullable(),
  /** The API route or MCP resource the action went through; null for events raised inside the app. */
  apiUrl: z.string().nullable(),
});

export type TV3AuditEvent = z.infer<typeof ZV3AuditEventResource>;
