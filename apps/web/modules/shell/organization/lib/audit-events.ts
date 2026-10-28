import "server-only";
import { prisma } from "@formbricks/database";
import { listAuditEventRows } from "@/app/api/v3/audit-events/lib/repository";
import type { TActor, TAuditStatus } from "@/modules/ee/audit-logs/types/audit-log";

export const RECENT_AUDIT_EVENTS_LIMIT = 25;

export interface TRecentAuditEvent {
  id: string;
  timestamp: Date;
  actorType: TActor;
  /** The member's name when the actor is a current member of the organization, otherwise `null`. */
  actorName: string | null;
  action: string;
  targetType: string;
  status: TAuditStatus;
}

/**
 * The newest audit events of one organization, the same rows `GET /api/v3/audit-events` serves (same
 * repository, same keyset order), bounded to a single short page. The caller has already established
 * that the viewer may read the trail and that audit logging is on; the organization is the authorized one.
 *
 * Actor names come from one query over the distinct user ids on the page, limited to current members so
 * the page never names someone outside the organization.
 */
export const getRecentAuditEvents = async (organizationId: string): Promise<TRecentAuditEvent[]> => {
  const rows = (
    await listAuditEventRows({
      organizationId,
      query: { limit: RECENT_AUDIT_EVENTS_LIMIT, cursor: null },
    })
  ).slice(0, RECENT_AUDIT_EVENTS_LIMIT);

  const userIds = [...new Set(rows.filter((row) => row.actorType === "user").map((row) => row.actorId))];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds }, memberships: { some: { organizationId } } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(users.map((user) => [user.id, user.name]));

  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    actorType: row.actorType,
    actorName: row.actorType === "user" ? (nameById.get(row.actorId) ?? null) : null,
    action: row.action,
    targetType: row.targetType,
    status: row.status,
  }));
};
