import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";

interface OrphanedFeedbackSource {
  id: string;
  name: string;
  type: string;
  status: string;
  workspaceId: string;
  feedbackDirectoryId: string;
}

/**
 * Removes FeedbackSource rows whose (feedbackDirectoryId, workspaceId) pair has no matching
 * FeedbackDirectoryWorkspace assignment. Such rows could previously exist because unassigning a
 * workspace from a directory deleted the join row but only *paused* the workspace's sources.
 *
 * This is the primary, logged cleanup pass before the composite FK migration
 * (20260706000001_add_feedback_source_directory_workspace_fk); that migration also deletes (and
 * logs via RAISE WARNING) any straggler created in the deploy window between the two, so the pair
 * stays convergent. Mappings (FeedbackSourceFormbricksMapping / FeedbackSourceFieldMapping)
 * cascade-delete with the source. Each deleted row is logged for the audit trail.
 */
export const deleteOrphanedFeedbackSources: MigrationScript = {
  type: "data",
  id: "qdh478rqi7dppzqzdmben9nk",
  name: "20260706000000_delete_orphaned_feedback_sources",
  run: async ({ tx }) => {
    // Delete-and-return in one statement so we only remove rows that are still orphaned at delete
    // time (a concurrent re-assignment during the deploy window can't cause us to delete a
    // now-valid source), and the audit log reflects exactly what was deleted. Mirrors the atomic
    // anti-join cleanup in the follow-up SQL migration.
    const deleted = await tx.$queryRaw<OrphanedFeedbackSource[]>`
      DELETE FROM "FeedbackSource" fs
      WHERE NOT EXISTS (
        SELECT 1 FROM "FeedbackDirectoryWorkspace" fdw
        WHERE fdw."feedbackDirectoryId" = fs."feedbackDirectoryId"
          AND fdw."workspaceId" = fs."workspaceId"
      )
      RETURNING fs."id",
                fs."name",
                fs."type"::text   AS "type",
                fs."status"::text AS "status",
                fs."workspaceId",
                fs."feedbackDirectoryId"
    `;

    if (deleted.length === 0) {
      logger.info("No orphaned FeedbackSources found; nothing to delete");
      return;
    }

    for (const orphan of deleted) {
      logger.warn(orphan, "Deleted orphaned FeedbackSource without directory-workspace assignment");
    }

    logger.info(`Deleted ${deleted.length.toString()} orphaned FeedbackSources`);
  },
};
