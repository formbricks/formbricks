import "server-only";
import type { Prisma } from "@formbricks/database/prisma";
import { collectResponseFileUrls, getSurveyFileUploadElementIds } from "@/modules/storage/utils";

export type TDeletedResponses = {
  /** Rows the database actually removed. Authoritative, and may be lower than the rows read. */
  deleted: number;
  /** The ids that matched when the rows were read. */
  deletedIds: string[];
  /** The storage files those responses owned, to delete once the transaction commits. */
  fileUrls: string[];
};

/**
 * Delete the responses matching `where`, and their displays, inside the caller's transaction, returning
 * the files they owned. The caller deletes the files after commit, or queues them: the URLs only exist
 * inside `response.data`, so they are read here, before the rows are gone.
 *
 * Responses go before displays: `Response_displayId_fkey` is `ON DELETE SET NULL`, so the reverse order
 * would work too, but would first null the column on rows about to be deleted. One survey read per
 * distinct survey, not per response.
 */
export const deleteResponsesInTransaction = async (
  tx: Prisma.TransactionClient,
  where: Prisma.ResponseWhereInput
): Promise<TDeletedResponses> => {
  const rows = await tx.response.findMany({
    where,
    select: { id: true, displayId: true, data: true, surveyId: true },
  });
  if (rows.length === 0) return { deleted: 0, deletedIds: [], fileUrls: [] };

  const surveys = await tx.survey.findMany({
    where: { id: { in: [...new Set(rows.map((row) => row.surveyId))] } },
    select: { id: true, blocks: true, questions: true },
  });
  const uploadElementIds = new Map(
    surveys.map((survey) => [
      survey.id,
      getSurveyFileUploadElementIds({ blocks: survey.blocks, questions: survey.questions }),
    ])
  );
  const fileUrls = rows.flatMap((row) =>
    collectResponseFileUrls(row.data, uploadElementIds.get(row.surveyId) ?? new Set<string>(), row.surveyId)
  );

  // By the ids read, so the rows deleted are exactly the rows whose files were collected.
  const deletedIds = rows.map((row) => row.id);
  const { count } = await tx.response.deleteMany({ where: { AND: [where, { id: { in: deletedIds } }] } });

  const displayIds = rows.map((row) => row.displayId).filter((id): id is string => id !== null);
  if (displayIds.length > 0) {
    await tx.display.deleteMany({ where: { id: { in: displayIds } } });
  }

  return { deleted: count, deletedIds, fileUrls };
};
