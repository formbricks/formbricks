import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { keysetOrderBy, keysetPagePredicate } from "@/app/api/v3/lib/keyset-cursor";
import type {
  TActor,
  TAuditAction,
  TAuditStatus,
  TAuditTarget,
} from "@/modules/ee/audit-logs/types/audit-log";
import type { TV3AuditEventsListQuery } from "./schemas";

/** One page row, as selected: the columns the API returns and nothing else. */
export type TAuditEventRow = {
  id: string;
  timestamp: Date;
  actorId: string;
  actorType: TActor;
  action: TAuditAction;
  targetType: TAuditTarget;
  targetId: string | null;
  status: TAuditStatus;
  eventId: string | null;
  apiUrl: string | null;
};

// Identifiers can't be bound parameters, so they're built from literals, inside functions: a
// module-scope `Prisma.raw` breaks under the Prisma test mock.
const sortColumn = () => Prisma.raw(`a."timestamp"`);
const idColumn = () => Prisma.raw(`a."id"`);

/**
 * A page of an organization's audit events, newest first, keyset-paged on `(timestamp, id)` over
 * `AuditEvent(organizationId, timestamp, id)`; a target or actor filter is served by its own index with
 * the same tail. Fetches `limit + 1` rows so the caller can tell a last page from a full one. The
 * organization is always the first clause and is the authorized one, never taken from the cursor.
 */
export async function listAuditEventRows({
  organizationId,
  query,
}: {
  organizationId: string;
  query: Partial<
    Pick<
      TV3AuditEventsListQuery,
      "actorId" | "actorType" | "action" | "targetType" | "targetId" | "status" | "from" | "to"
    >
  > &
    Pick<TV3AuditEventsListQuery, "limit" | "cursor">;
}): Promise<TAuditEventRow[]> {
  const clauses = [Prisma.sql`a."organizationId" = ${organizationId}`];
  if (query.actorId) clauses.push(Prisma.sql`a."actorId" = ${query.actorId}`);
  if (query.actorType) clauses.push(Prisma.sql`a."actorType" = ${query.actorType}`);
  if (query.action) clauses.push(Prisma.sql`a."action" = ${query.action}`);
  if (query.targetType) clauses.push(Prisma.sql`a."targetType" = ${query.targetType}`);
  if (query.targetId) clauses.push(Prisma.sql`a."targetId" = ${query.targetId}`);
  if (query.status) clauses.push(Prisma.sql`a."status" = ${query.status}`);
  if (query.from) clauses.push(Prisma.sql`a."timestamp" >= ${query.from}`);
  if (query.to) clauses.push(Prisma.sql`a."timestamp" < ${query.to}`);
  if (query.cursor) {
    clauses.push(
      keysetPagePredicate({
        sortColumn: sortColumn(),
        idColumn: idColumn(),
        direction: "desc",
        cursor: query.cursor,
      })
    );
  }

  return prisma.$queryRaw<TAuditEventRow[]>`
    SELECT a."id", a."timestamp", a."actorId", a."actorType", a."action", a."targetType", a."targetId",
           a."status", a."eventId", a."apiUrl"
    FROM "AuditEvent" a
    WHERE ${Prisma.join(clauses, " AND ")}
    ${keysetOrderBy({ sortColumn: sortColumn(), idColumn: idColumn(), direction: "desc" })}
    LIMIT ${query.limit + 1}
  `;
}
