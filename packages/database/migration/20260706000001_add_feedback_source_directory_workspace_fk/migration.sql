-- Anchor FeedbackSource to an actual directory<->workspace assignment (ENG-1148).
-- Replaces the two independent FKs' implicit trust with a DB-enforced composite FK to
-- FeedbackDirectoryWorkspace, so a source can never reference an unassigned (directory, workspace)
-- pair even if the action-layer check regresses.

-- Safety check: abort if any orphaned FeedbackSource rows remain. The data migration
-- 20260706000000_delete_orphaned_feedback_sources must have removed them first.
DO $$
DECLARE
  orphan_count bigint;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM "FeedbackSource" fs
  LEFT JOIN "FeedbackDirectoryWorkspace" fdw
    ON fdw."feedbackDirectoryId" = fs."feedbackDirectoryId"
   AND fdw."workspaceId" = fs."workspaceId"
  WHERE fdw."feedbackDirectoryId" IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Cannot add composite FK: % FeedbackSource rows have no FeedbackDirectoryWorkspace assignment', orphan_count;
  END IF;
END $$;

-- DropIndex
DROP INDEX "FeedbackSource_feedbackDirectoryId_idx";

-- CreateIndex
CREATE INDEX "FeedbackSource_feedbackDirectoryId_workspaceId_idx" ON "FeedbackSource"("feedbackDirectoryId", "workspaceId");

-- AddForeignKey
ALTER TABLE "FeedbackSource" ADD CONSTRAINT "FeedbackSource_feedbackDirectoryId_workspaceId_fkey" FOREIGN KEY ("feedbackDirectoryId", "workspaceId") REFERENCES "FeedbackDirectoryWorkspace"("feedbackDirectoryId", "workspaceId") ON DELETE NO ACTION ON UPDATE CASCADE;
