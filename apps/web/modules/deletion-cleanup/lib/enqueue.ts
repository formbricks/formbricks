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
  const tenantIds = await readTenantIds(tx, organizationId);
  const scope = { organizationId, workspaceId, surveyId };
  const settledAt = new Date(Date.now() + CLEANUP_SETTLE_MS);

  const drainNow: DeletionCleanupCreateManyInput[] = [
    { ...scope, kind: "storageSurveyFolder" },
    ...storageFileRows(scope, fileUrls),
  ];
  const drainLater: DeletionCleanupCreateManyInput[] = [
    { ...scope, kind: "storageSurveyFolder", nextAttemptAt: settledAt },
  ];
  if (tenantIds.length > 0) {
    drainLater.push({ ...scope, kind: "hubSurvey", tenantIds, nextAttemptAt: settledAt });
  }

  return insertCleanups(tx, drainNow, drainLater);
};

export type TResponsesDeletionCleanupInput = TSurveyDeletionCleanupInput & {
  /** The deleted responses. At most a batch, so the Hub listing's `submission_id` filter stays short. */
  responseIds: readonly string[];
};

/**
 * Queue what deleting some of a survey's responses leaves outside the database: their files and their
 * Hub records. Call it inside the delete's transaction, like `enqueueSurveyDeletionCleanups`. The files
 * are drained straight after commit; the Hub records are older than the period by then, so nothing is
 * still on its way to the Hub and they wait only for the drain job.
 */
export const enqueueResponsesDeletionCleanups = async (
  tx: Prisma.TransactionClient,
  { organizationId, workspaceId, surveyId, responseIds, fileUrls }: TResponsesDeletionCleanupInput
): Promise<{ drainNowIds: string[] }> => {
  if (responseIds.length === 0) return { drainNowIds: [] };
  const tenantIds = await readTenantIds(tx, organizationId);
  const scope = { organizationId, workspaceId, surveyId };

  return insertCleanups(
    tx,
    storageFileRows(scope, fileUrls),
    tenantIds.length > 0 ? [{ ...scope, kind: "hubResponses", tenantIds, responseIds: [...responseIds] }] : []
  );
};

/** Every feedback directory of the organisation: a Hub tenant that may hold the deleted data's records. */
const readTenantIds = async (tx: Prisma.TransactionClient, organizationId: string): Promise<string[]> =>
  (await tx.feedbackDirectory.findMany({ where: { organizationId }, select: { id: true } })).map(
    (directory) => directory.id
  );

const storageFileRows = (
  scope: Pick<DeletionCleanupCreateManyInput, "organizationId" | "workspaceId" | "surveyId">,
  fileUrls: readonly string[]
): DeletionCleanupCreateManyInput[] => {
  const rows: DeletionCleanupCreateManyInput[] = [];
  for (let i = 0; i < fileUrls.length; i += STORAGE_CLEANUP_CHUNK_SIZE) {
    rows.push({
      ...scope,
      kind: "storageFiles",
      fileKeys: fileUrls.slice(i, i + STORAGE_CLEANUP_CHUNK_SIZE),
    });
  }
  return rows;
};

const insertCleanups = async (
  tx: Prisma.TransactionClient,
  drainNow: DeletionCleanupCreateManyInput[],
  drainLater: DeletionCleanupCreateManyInput[]
): Promise<{ drainNowIds: string[] }> => {
  const created =
    drainNow.length > 0
      ? await tx.deletionCleanup.createManyAndReturn({ data: drainNow, select: { id: true } })
      : [];
  if (drainLater.length > 0) await tx.deletionCleanup.createMany({ data: drainLater });
  return { drainNowIds: created.map((row) => row.id) };
};
