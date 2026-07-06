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
 * This must run before the composite FK migration
 * (20260706000001_add_feedback_source_directory_workspace_fk), which would otherwise fail.
 * Mappings (FeedbackSourceFormbricksMapping / FeedbackSourceFieldMapping) cascade-delete with the
 * source. Each deleted row is logged for the audit trail.
 */
export const deleteOrphanedFeedbackSources: MigrationScript = {
  type: "data",
  id: "qdh478rqi7dppzqzdmben9nk",
  name: "20260706000000_delete_orphaned_feedback_sources",
  run: async ({ tx }) => {
    const orphans = await tx.$queryRaw<OrphanedFeedbackSource[]>`
      SELECT fs."id",
             fs."name",
             fs."type"::text   AS "type",
             fs."status"::text AS "status",
             fs."workspaceId",
             fs."feedbackDirectoryId"
      FROM "FeedbackSource" fs
      LEFT JOIN "FeedbackDirectoryWorkspace" fdw
        ON fdw."feedbackDirectoryId" = fs."feedbackDirectoryId"
       AND fdw."workspaceId" = fs."workspaceId"
      WHERE fdw."feedbackDirectoryId" IS NULL
    `;

    if (orphans.length === 0) {
      logger.info("No orphaned FeedbackSources found; nothing to delete");
      return;
    }

    for (const orphan of orphans) {
      logger.warn(orphan, "Deleting orphaned FeedbackSource without directory-workspace assignment");
    }

    const deleted = await tx.feedbackSource.deleteMany({
      where: { id: { in: orphans.map((orphan) => orphan.id) } },
    });

    logger.info(`Deleted ${deleted.count.toString()} orphaned FeedbackSources`);
  },
};
