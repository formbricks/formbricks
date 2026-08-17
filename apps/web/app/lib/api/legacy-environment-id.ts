import "server-only";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";

/**
 * Backwards compatibility layer for the environment → workspace rename in API v1 responses.
 *
 * Before Formbricks 5, v1 surveys and webhooks carried an `environmentId`. Long-lived integrations
 * built against v1 (Zapier, Make, n8n) still read that field — e.g. the Zapier "Response Finished"
 * trigger derives the subscription's environment id from the surveys it lists — so v1 keeps emitting
 * it as `legacyEnvironmentId ?? workspaceId`.
 *
 * That is the same id `GET /api/v1/management/me` returns and the one `resolveBodyIds` accepts back
 * on writes, so a client can round-trip it without knowing about workspaces (ENG-2270).
 */
export const addLegacyEnvironmentIdToList = async <T extends { workspaceId: string }>(
  entities: T[]
): Promise<(T & { environmentId: string })[]> => {
  if (entities.length === 0) return [];

  const workspaceIds = [...new Set(entities.map((entity) => entity.workspaceId))];

  const workspaces = await prisma.workspace.findMany({
    where: { id: { in: workspaceIds } },
    select: { id: true, legacyEnvironmentId: true },
  });

  const legacyEnvironmentIdByWorkspaceId = new Map(
    workspaces.map((workspace) => [workspace.id, workspace.legacyEnvironmentId])
  );

  return entities.map((entity) => ({
    ...entity,
    // Workspaces created after the migration have no legacy id; their own id is the v1 environment id.
    environmentId: legacyEnvironmentIdByWorkspaceId.get(entity.workspaceId) ?? entity.workspaceId,
  }));
};

export const addLegacyEnvironmentId = async <T extends { workspaceId: string }>(
  entity: T
): Promise<T & { environmentId: string }> => {
  const [entityWithLegacyId] = await addLegacyEnvironmentIdToList([entity]);
  return entityWithLegacyId;
};

/**
 * Variant for responses that echo an already-committed write.
 *
 * The write cannot be undone by the time this runs, so a failed workspace lookup must not turn it
 * into an error response — the caller would retry an operation that already happened. On a delete
 * that means deleting twice; on a create it means a duplicate row, since `Webhook` has no
 * uniqueness on `(url, workspaceId)`. Degrades to the un-enriched entity instead.
 */
export const addLegacyEnvironmentIdBestEffort = async <T extends { workspaceId: string }>(
  entity: T
): Promise<T & { environmentId?: string }> => {
  try {
    return await addLegacyEnvironmentId(entity);
  } catch (error) {
    logger.error(
      { error, workspaceId: entity.workspaceId },
      "Failed to resolve legacy environmentId for a committed write"
    );
    return entity;
  }
};
