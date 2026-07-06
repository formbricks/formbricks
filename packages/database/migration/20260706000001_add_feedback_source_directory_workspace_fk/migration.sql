-- Anchor FeedbackSource to an actual directory<->workspace assignment (ENG-1148).
-- Replaces the two independent FKs' implicit trust with a DB-enforced composite FK to
-- FeedbackDirectoryWorkspace, so a source can never reference an unassigned (directory, workspace)
-- pair even if the action-layer check regresses.

-- Last-chance cleanup: the data migration 20260706000000_delete_orphaned_feedback_sources removes
-- (and logs) orphaned rows first, but an orphan can still appear in the window before this DDL runs
-- (an old-version pod unassigning a workspace mid-deploy). Deleting the stragglers here keeps the
-- migration convergent — aborting instead would crash-loop, since the data migration is marked
-- applied and never re-runs. Same class of rows, same approved delete semantics; each is logged.
DO $$
DECLARE
  orphan RECORD;
  orphan_count bigint := 0;
BEGIN
  FOR orphan IN
    WITH deleted AS (
      DELETE FROM "FeedbackSource" fs
      WHERE NOT EXISTS (
        SELECT 1 FROM "FeedbackDirectoryWorkspace" fdw
        WHERE fdw."feedbackDirectoryId" = fs."feedbackDirectoryId"
          AND fdw."workspaceId" = fs."workspaceId"
      )
      RETURNING fs."id", fs."name", fs."workspaceId", fs."feedbackDirectoryId"
    )
    SELECT * FROM deleted
  LOOP
    orphan_count := orphan_count + 1;
    RAISE WARNING 'Deleted orphaned FeedbackSource % (name: %, workspaceId: %, feedbackDirectoryId: %) without directory-workspace assignment',
      orphan."id", orphan."name", orphan."workspaceId", orphan."feedbackDirectoryId";
  END LOOP;

  IF orphan_count > 0 THEN
    RAISE WARNING 'Deleted % orphaned FeedbackSource rows before adding the composite FK', orphan_count;
  END IF;
END $$;

-- DropIndex
DROP INDEX "FeedbackSource_feedbackDirectoryId_idx";

-- CreateIndex
CREATE INDEX "FeedbackSource_feedbackDirectoryId_workspaceId_idx" ON "FeedbackSource"("feedbackDirectoryId", "workspaceId");

-- AddForeignKey
ALTER TABLE "FeedbackSource" ADD CONSTRAINT "FeedbackSource_feedbackDirectoryId_workspaceId_fkey" FOREIGN KEY ("feedbackDirectoryId", "workspaceId") REFERENCES "FeedbackDirectoryWorkspace"("feedbackDirectoryId", "workspaceId") ON DELETE NO ACTION ON UPDATE CASCADE;
