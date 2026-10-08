import type { TRetentionRunRow } from "@/modules/ee/data-retention/lib/runs-service";

/**
 * A History row as the API returns it (ENG-3695). `policy` is the kind of data the run covered; for the
 * members policy, `archived` counts deactivated members. Whether the run changed anything is implied by
 * the counts, so `hasChanges` stays internal.
 */
export const serializeRetentionRun = (run: TRetentionRunRow) => ({
  id: run.id,
  policy: run.entity,
  startedAt: run.startedAt.toISOString(),
  finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
  notified: run.notifiedCount,
  archived: run.archivedCount,
  deleted: run.deletedCount,
  skipped: run.skippedCount,
});

export type TRetentionRunResponse = ReturnType<typeof serializeRetentionRun>;
