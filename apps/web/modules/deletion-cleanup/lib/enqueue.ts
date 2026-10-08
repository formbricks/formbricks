import "server-only";
import type { DeletionCleanupCreateManyInput, Prisma } from "@formbricks/database/prisma";
import { HUB_CLEANUP_SETTLE_MS, STORAGE_CLEANUP_CHUNK_SIZE } from "./constants";

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
 * Returns the ids of the rows to drain straight after commit (the storage ones). The Hub row waits
 * `HUB_CLEANUP_SETTLE_MS` for any record still on its way to the Hub.
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

  const storageRows: DeletionCleanupCreateManyInput[] = [{ ...scope, kind: "storageSurveyFolder" }];
  for (let i = 0; i < fileUrls.length; i += STORAGE_CLEANUP_CHUNK_SIZE) {
    storageRows.push({
      ...scope,
      kind: "storageFiles",
      fileKeys: fileUrls.slice(i, i + STORAGE_CLEANUP_CHUNK_SIZE),
    });
  }

  const [created] = await Promise.all([
    tx.deletionCleanup.createManyAndReturn({ data: storageRows, select: { id: true } }),
    directories.length > 0
      ? tx.deletionCleanup.create({
          data: {
            ...scope,
            kind: "hubSurvey",
            tenantIds: directories.map((directory) => directory.id),
            nextAttemptAt: new Date(Date.now() + HUB_CLEANUP_SETTLE_MS),
          },
          select: { id: true },
        })
      : null,
  ]);

  return { drainNowIds: created.map((row) => row.id) };
};
