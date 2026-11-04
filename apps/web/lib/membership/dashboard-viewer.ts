import "server-only";
import type { Prisma } from "@formbricks/database/prisma";

type TMembershipReader = { membership: Pick<Prisma.TransactionClient["membership"], "findMany"> };

/**
 * Whether every organization membership `userId` holds is the Dashboard viewer role. Such a user can
 * only ever read dashboards, so they keep no OAuth grant from a wider role and new grants are limited
 * to `dashboards:read` (ADR-0025). Takes the transaction client when it runs inside a write, so the
 * answer reflects that write.
 */
export const isOnlyDashboardViewer = async (client: TMembershipReader, userId: string): Promise<boolean> =>
  hasOnlyDashboardViewerRoles(
    await client.membership.findMany({ where: { userId }, select: { role: true } })
  );

/** The rule `isOnlyDashboardViewer` applies, for a caller that already read the memberships' roles. */
export const hasOnlyDashboardViewerRoles = (memberships: readonly { role: string }[]): boolean =>
  memberships.length > 0 && memberships.every(({ role }) => role === "dashboard_viewer");
