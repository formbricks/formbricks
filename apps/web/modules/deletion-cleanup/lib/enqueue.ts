import "server-only";
import type { DeletionCleanupCreateManyInput, Prisma } from "@formbricks/database/prisma";
import { CLEANUP_SETTLE_MS, STORAGE_CLEANUP_CHUNK_SIZE } from "./constants";

export type TSurveyDeletionCleanupInput = {
  organizationId: string;
  workspaceId: string;
  surveyId: string;
  /**
   * Response file URLs outside the survey's upload folder (flat pre-#8044 keys), which the folder delete
   * can't reach. Collected before the delete, since they only exist inside `response.data`.
   */
  fileUrls: readonly string[];
};

/**
 * Queue everything a survey's delete leaves outside the database: its Hub records, its upload folder
 * and any flat-key files. Call it inside the delete's transaction, after locking the survey row: a delete
 * that rolls back then queues nothing, and one that commits always gets its cleanup (ENG-3614).
 *
 * The Hub cleanup covers every feedback directory of the organisation, read here inside the transaction,
 * not just the ones a mapping points at today: a mapping removed earlier still left records behind. The
 * Hub calls stay scoped by `source_type` and `source_id`, so a directory with none of this survey's
 * records costs one empty listing.
 *
 * Returns the ids of the rows to drain straight after commit (the storage ones). The rest wait
 * `CLEANUP_SETTLE_MS` for what can still land after the delete: the Hub cleanup, for records on their way
 * to the Hub, and a second sweep of the upload folder, for an upload signed before the delete.
 */
export const enqueueSurveyDeletionCleanups = async (
  tx: Prisma.TransactionClient,
  { organizationId, workspaceId, surveyId, fileUrls }: TSurveyDeletionCleanupInput
): Promise<{ drainNowIds: string[] }> => {
  const directories = await tx.feedbackDirectory.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const scope = { organizationId, workspaceId, surveyId };
  const settledAt = new Date(Date.now() + CLEANUP_SETTLE_MS);

  const drainNow: DeletionCleanupCreateManyInput[] = [{ ...scope, kind: "storageSurveyFolder" }];
  for (let i = 0; i < fileUrls.length; i += STORAGE_CLEANUP_CHUNK_SIZE) {
    drainNow.push({
      ...scope,
      kind: "storageFiles",
      fileKeys: fileUrls.slice(i, i + STORAGE_CLEANUP_CHUNK_SIZE),
    });
  }

  const drainLater: DeletionCleanupCreateManyInput[] = [
    { ...scope, kind: "storageSurveyFolder", nextAttemptAt: settledAt },
  ];
  if (directories.length > 0) {
    drainLater.push({
      ...scope,
      kind: "hubSurvey",
      tenantIds: directories.map((directory) => directory.id),
      nextAttemptAt: settledAt,
    });
  }

  const created = await tx.deletionCleanup.createManyAndReturn({ data: drainNow, select: { id: true } });
  await tx.deletionCleanup.createMany({ data: drainLater });

  return { drainNowIds: created.map((row) => row.id) };
};
