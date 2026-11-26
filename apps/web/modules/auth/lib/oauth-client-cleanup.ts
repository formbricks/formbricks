import "server-only";
import { prisma } from "@formbricks/database";
import type { JobHandler, TGlobalScopeJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";

export const OAUTH_CLIENT_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** How long an unused anonymous registration is kept; a client that is going to be used is used at once. */
export const ANONYMOUS_OAUTH_CLIENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 500;
/** Bounds one run (250k rows); a larger backlog drains over the following days. */
const MAX_BATCHES = 500;

type TOauthClientWhere = NonNullable<NonNullable<Parameters<typeof prisma.oauthClient.findMany>[0]>["where"]>;

/**
 * The registrations this job may delete: anonymous (`userId` null — a client registered by a signed-in
 * user belongs to them), past the retention window, with no consent and no live token. A consent is what
 * a user's grant hangs off, and a token that is unexpired and unrevoked is a working connection, so
 * either keeps the client, as does a `skipConsent` client. Deleting a client cascades to its tokens, consents, MCP grants and resource links, which is
 * why those are excluded rather than relied on.
 */
const staleAnonymousClientWhere = (now: Date): TOauthClientWhere => ({
  userId: null,
  referenceId: null,
  // A skipConsent client needs no consent row, so absence of one proves nothing about it.
  OR: [{ skipConsent: null }, { skipConsent: false }],
  createdAt: { lt: new Date(now.getTime() - ANONYMOUS_OAUTH_CLIENT_RETENTION_MS) },
  consents: { none: {} },
  // An MCP grant cascades with its client, and dropping it here would skip its SpiceDB cleanup and audit.
  mcpGrants: { none: {} },
  accessTokens: { none: { revoked: null, expiresAt: { gt: now } } },
  refreshTokens: { none: { revoked: null, expiresAt: { gt: now } } },
});

/** Deletes stale anonymous clients in batches and returns how many it removed. */
export const deleteStaleAnonymousOauthClients = async (now: Date = new Date()): Promise<number> => {
  let deleted = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const where = staleAnonymousClientWhere(now);
    const stale = await prisma.oauthClient.findMany({ where, select: { id: true }, take: BATCH_SIZE });
    if (stale.length === 0) break;

    // The filter is repeated on the delete, which narrows the window in which a consent or token that appeared since the read could be lost.
    const { count } = await prisma.oauthClient.deleteMany({
      where: { AND: [where, { id: { in: stale.map(({ id }) => id) } }] },
    });
    deleted += count;
    if (stale.length < BATCH_SIZE) break;
  }
  return deleted;
};

/**
 * Handler for the recurring `oauth-client.cleanup` job (ENG-7314). Dynamic client registration is open,
 * so unused registrations accumulate; this removes the ones nobody ever consented to. A failure fails the
 * job and the next tick repeats the same query.
 */
export const processOauthClientCleanupJob: JobHandler<TGlobalScopeJobData> = async (data, context) => {
  const deleted = await deleteStaleAnonymousOauthClients();
  if (deleted > 0) {
    logger.info(
      { jobId: context.jobId, jobName: context.jobName, scope: data.scope, deleted },
      "Stale anonymous OAuth clients deleted"
    );
  }
};
