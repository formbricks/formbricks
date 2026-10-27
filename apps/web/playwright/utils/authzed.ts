import { setTimeout as delay } from "node:timers/promises";
import { prisma } from "@formbricks/database";

const POLL_INTERVAL_MS = 50;
const TIMEOUT_MS = 20_000;

/** The user, their organizations, and those organizations' teams, workspaces and surveys. */
const getTenantIds = async (userId: string): Promise<string[]> => {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { organizationId: true },
  });
  const organizationIds = memberships.map(({ organizationId }) => organizationId);
  const [teams, workspaces] = await Promise.all([
    prisma.team.findMany({ where: { organizationId: { in: organizationIds } }, select: { id: true } }),
    prisma.workspace.findMany({ where: { organizationId: { in: organizationIds } }, select: { id: true } }),
  ]);
  const workspaceIds = workspaces.map(({ id }) => id);
  const surveys = await prisma.survey.findMany({
    where: { workspaceId: { in: workspaceIds } },
    select: { id: true },
  });

  return [
    userId,
    ...organizationIds,
    ...teams.map(({ id }) => id),
    ...workspaceIds,
    ...surveys.map(({ id }) => id),
  ];
};

/**
 * Fixtures seed users, organizations, memberships, workspaces and surveys straight through Prisma. The
 * database triggers still enqueue their AuthZed projection, but SpiceDB only sees it once the outbox
 * worker delivers it. A page loaded before then finds no organization for the user and redirects to
 * `/setup/organization/create` (ENG-4101).
 *
 * Waits until every outbox row enqueued so far for the user's own tenant has been delivered. Other
 * tenants' rows are ignored, so one of them stuck in retry backoff cannot hold up this login; dead
 * letters are skipped because they will never be delivered.
 */
export const waitForAuthzedProjection = async (userId: string): Promise<void> => {
  // The column default is the database's local CURRENT_TIMESTAMP, so take the cutoff from the same clock.
  const [{ cutoff }] = await prisma.$queryRaw<{ cutoff: Date }[]>`SELECT LOCALTIMESTAMP(3) AS cutoff`;
  const ids = await getTenantIds(userId);
  const deadline = Date.now() + TIMEOUT_MS;

  for (;;) {
    const pending = await prisma.authzedProjectionOutbox.count({
      where: {
        processedAt: null,
        deadLetteredAt: null,
        createdAt: { lte: cutoff },
        OR: [{ primaryId: { in: ids } }, { secondaryId: { in: ids } }],
      },
    });
    if (pending === 0) return;
    if (Date.now() >= deadline) {
      throw new Error(
        `${pending} AuthZed projection outbox rows for this user's tenant are still undelivered after ` +
          `${TIMEOUT_MS / 1000}s. Is the outbox worker running? CI starts ` +
          "apps/web/scripts/authzed-ci-outbox-worker.ts (see ENG-2958)."
      );
    }
    await delay(POLL_INTERVAL_MS);
  }
};
