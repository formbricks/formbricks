import "server-only";
import type { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { enqueueResponseFilesDeletionCleanup } from "@/modules/deletion-cleanup/lib/enqueue";
import { collectReplacedSignatureFileUrls, getSurveyUploadElementIds } from "@/modules/storage/utils";

/**
 * Queue the deletion of the Signature images a write to a response has just cleared or replaced
 * (ADR 0023: clearing is the respondent withdrawing the signature). Call it inside the write's
 * transaction, after the write succeeded: a write that rolls back queues nothing, so a failed update
 * never deletes a file, and the storage delete itself runs later in the cleanup drain, never in the
 * request.
 *
 * `previousData` is what the response held before the write and `nextData` what it holds after it. The
 * survey is read only when an answer that looks like a file of this survey changed, so an ordinary
 * update costs nothing extra; the read is by id, and the queued URLs are re-checked against the
 * survey's workspace by the drain (`deleteResponseFileUrls`). Logs a count, never a URL.
 */
const queueReplacedSignatureFiles = async (
  tx: Prisma.TransactionClient,
  { surveyId, previousData, nextData }: { surveyId: string; previousData: unknown; nextData: unknown }
): Promise<void> => {
  if (!previousData || typeof previousData !== "object" || Array.isArray(previousData)) return;

  // Any id may be a Signature, and an own-scoped bare string can only be an upload element's file, so
  // this finds the rare write worth reading the survey for without knowing the element types yet.
  const mightBeSignature = collectReplacedSignatureFileUrls({
    previousData,
    nextData,
    signatureElementIds: new Set(Object.keys(previousData)),
    surveyId,
  });
  if (mightBeSignature.length === 0) return;

  const survey = await tx.survey.findUnique({
    where: { id: surveyId },
    select: {
      id: true,
      workspaceId: true,
      blocks: true,
      questions: true,
      workspace: { select: { organizationId: true } },
    },
  });
  if (!survey) return;

  const fileUrls = collectReplacedSignatureFileUrls({
    previousData,
    nextData,
    signatureElementIds: getSurveyUploadElementIds(survey).signature,
    surveyId: survey.id,
  });
  if (fileUrls.length === 0) return;

  await enqueueResponseFilesDeletionCleanup(tx, {
    organizationId: survey.workspace.organizationId,
    workspaceId: survey.workspaceId,
    surveyId: survey.id,
    fileUrls,
  });
  logger.info(
    { surveyId: survey.id, fileCount: fileUrls.length },
    "Queued replaced signature images for deletion"
  );
};

/**
 * `enqueueReplacedSignatureFileCleanup` for a write that is not inside a transaction of its own: the
 * write has already committed, so a failure here is logged and swallowed rather than reported as a
 * failed update, and the image stays until the response is deleted. Inside a transaction the failure
 * has to propagate (Postgres has aborted it anyway), so pass `bestEffort: false` there.
 */
export const enqueueReplacedSignatureFileCleanup = async (
  client: Prisma.TransactionClient,
  input: { surveyId: string; previousData: unknown; nextData: unknown },
  { bestEffort }: { bestEffort: boolean }
): Promise<void> => {
  if (!bestEffort) return queueReplacedSignatureFiles(client, input);

  try {
    await queueReplacedSignatureFiles(client, input);
  } catch (error) {
    // The error's name only: a database error's message can quote the file keys it was inserting.
    logger.error(
      { surveyId: input.surveyId, errorName: error instanceof Error ? error.name : "unknown" },
      "Could not queue replaced signature images for deletion"
    );
  }
};
