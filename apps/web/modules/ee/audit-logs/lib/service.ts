import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import {
  type TAuditLogEvent,
  UNKNOWN_DATA,
  ZAuditLogEventSchema,
} from "@/modules/ee/audit-logs/types/audit-log";

/**
 * The largest redacted diff stored with an event. A bulk update can carry a large diff, and the row is
 * only there to say what happened; a bigger one is replaced by a marker instead of being cut mid-value.
 */
export const MAX_PERSISTED_CHANGES_BYTES = 16 * 1024;

/** `userAgent` and `apiUrl` come from the request, so a stored copy is cut to a sane length. */
export const MAX_STORED_TEXT_LENGTH = 512;

const validateEvent = (event: TAuditLogEvent): void => {
  const result = ZAuditLogEventSchema.safeParse(event);
  if (!result.success) {
    throw new Error(`Invalid audit log event: ${result.error.message}`);
  }
};

const toPersistedChanges = (changes: TAuditLogEvent["changes"]) => {
  if (!changes) return undefined;
  return Buffer.byteLength(JSON.stringify(changes), "utf8") > MAX_PERSISTED_CHANGES_BYTES
    ? { truncated: true }
    : changes;
};

/**
 * Stores the validated event so it can be read back through `GET /api/v3/audit-events`. Only ever called
 * for an event that already passed `getIsAuditLogsEnabled` at its entry point, and only with the event as
 * `buildAndLogAuditEvent` built it: `changes` has been through `redactPII` by then, so no raw object
 * reaches the table. Never throws: a failed insert is logged and the request it describes is unaffected.
 */
const persistAuditEvent = async (event: TAuditLogEvent): Promise<void> => {
  // An event without an organization cannot be read by anyone, so there is nothing to store it under.
  if (event.organizationId === UNKNOWN_DATA) return;

  try {
    await prisma.auditEvent.create({
      data: {
        organizationId: event.organizationId,
        timestamp: new Date(event.timestamp),
        actorId: event.actor.id,
        actorType: event.actor.type,
        action: event.action,
        targetType: event.target.type,
        targetId: event.target.id,
        status: event.status,
        eventId: event.eventId,
        apiUrl: event.apiUrl?.slice(0, MAX_STORED_TEXT_LENGTH),
        ipAddress: event.ipAddress,
        userAgent: event.userAgent.slice(0, MAX_STORED_TEXT_LENGTH),
        changes: toPersistedChanges(event.changes),
      },
    });
  } catch (error) {
    const context = {
      action: event.action,
      targetType: event.target.type,
      targetId: event.target.id,
      eventId: event.eventId,
    };
    // The "organization deleted" event is written after the organization is gone, so its row cannot
    // reference it. Expected, and nobody could read it: not worth an error.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      logger.warn(context, "Audit event not persisted: its organization no longer exists");
      return;
    }
    logger.error({ err: error, ...context }, "Failed to persist audit event");
  }
};

export const logAuditEvent = async (
  event: TAuditLogEvent,
  { persist = true }: { persist?: boolean } = {}
): Promise<void> => {
  try {
    validateEvent(event);
  } catch (error) {
    // Log error to application logger but don't throw
    // This ensures audit logging failures don't break the application
    logger.error(error, "Failed to log audit event");
    return;
  }

  try {
    // Scalar aliases remain directly searchable across log transports without flattening nested fields.
    logger.audit({
      ...event,
      actorId: event.actor.id,
      actorType: event.actor.type,
      targetId: event.target.id,
      targetType: event.target.type,
    });
  } catch (error) {
    logger.error(error, "Failed to log audit event");
  }

  // After the logger line, so a database failure never costs the log record, and a logger transport
  // failure never costs the stored one. Callers run off the response path (`after()`, `setImmediate`,
  // workers), so awaiting the insert adds no request latency.
  if (persist) await persistAuditEvent(event);
};
