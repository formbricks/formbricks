import { prisma } from "@formbricks/database";
import { type Prisma } from "@formbricks/database/prisma";
import { type TIngestFlag } from "@formbricks/types/embedded-data-ingest";
import { DatabaseError, ResourceNotFoundError, ResponseAlreadyFinishedError } from "@formbricks/types/errors";
import { TResponseWithQuotaFull } from "@formbricks/types/quota";
import { TClientResponseUpdateInput } from "@formbricks/types/responses";
import { type TResponseNotShown, ZResponseNotShown } from "@formbricks/types/surveys/not-shown";
import {
  type TLowQualityMark,
  auditLowQualityMark,
  markResponseLowQualityFromSurvey,
} from "@/app/api/client/[workspaceId]/responses/lib/mark-low-quality";
import { lockResponseForUpdate, updateResponse } from "@/lib/response/service";
import {
  evaluateResponseQuotas,
  loadQuotaEvaluationContext,
} from "@/modules/ee/quotas/lib/evaluation-service";

/**
 * The not-shown record stored on a response (ENG-6936), or `null` when it is unknown. An update that
 * sends no record keeps this one, so validating that update reads it too (ENG-7332). A stored record
 * that does not parse is a server fault, not an unknown record: it throws.
 */
export const getStoredResponseNotShown = async (
  responseId: string,
  client: Pick<Prisma.TransactionClient, "response"> = prisma
): Promise<TResponseNotShown | null> => {
  const row = await client.response.findUnique({ where: { id: responseId }, select: { notShown: true } });
  if (row?.notShown == null) return null;
  const parsed = ZResponseNotShown.safeParse(row.notShown);
  if (!parsed.success) throw new DatabaseError("The response's stored not-shown record is invalid");
  return parsed.data;
};

/**
 * `workspaceId` is the workspace the caller authorized; the row lock is scoped to it. `surveyId` is the stored
 * response's survey, as the caller already loaded it — passed in so the quota
 * definitions are read before the transaction opens. Evaluation still checks it against the updated
 * row and skips on a mismatch.
 *
 * Throws `ResponseAlreadyFinishedError` when the response is finished by the time the write runs. The
 * caller's own `finished` check reads before this transaction, so a finish that commits in between would
 * otherwise be overwritten or reopened (ENG-6869). Because the row is locked and unfinished here, a result
 * with `finished: true` is always this update's own false→true transition.
 */
export const updateResponseWithQuotaEvaluation = async ({
  responseId,
  workspaceId,
  surveyId,
  responseInput,
  ingestFlags,
}: {
  responseId: string;
  workspaceId: string;
  surveyId: string;
  responseInput: TClientResponseUpdateInput;
  ingestFlags?: readonly TIngestFlag[];
}): Promise<TResponseWithQuotaFull> => {
  const quotaContext = await loadQuotaEvaluationContext(surveyId);

  let lowQualityMark: TLowQualityMark | undefined;
  const txResponse = await prisma.$transaction(async (tx) => {
    const locked = await lockResponseForUpdate(tx, { responseId, workspaceId });
    if (!locked) {
      throw new ResourceNotFoundError("Response", responseId);
    }
    if (locked.finished) {
      throw new ResponseAlreadyFinishedError(responseId);
    }

    // An update without a not-shown record keeps the stored one (ENG-6936), and the write applies it as
    // when the survey sends it: an answer to anything it lists is removed (ENG-7332). Read under the lock,
    // so a concurrent update cannot make it stale.
    const storedNotShown =
      responseInput.notShown === undefined ? await getStoredResponseNotShown(responseId, tx) : null;
    const writeInput = storedNotShown ? { ...responseInput, notShown: storedNotShown } : responseInput;

    const updated = await updateResponse(responseId, writeInput, tx, ingestFlags);
    // ENG-6933: one way, and only on this flag; `outcome` itself is not part of the client update (#9847).
    lowQualityMark = responseInput.markLowQuality
      ? await markResponseLowQualityFromSurvey(tx, updated)
      : undefined;
    const response = lowQualityMark?.response ?? updated;

    const quotaResult = await evaluateResponseQuotas({
      surveyId: response.surveyId,
      responseId: response.id,
      data: response.data,
      variables: response.variables,
      language: response.language || "default",
      responseFinished: response.finished,
      // The row just written, so `reserved` quota operands resolve (ENG-1840).
      response,
      tx,
      quotaContext,
    });

    return {
      ...response,
      ...(quotaResult.quotaFull && { quotaFull: quotaResult.quotaFull }),
    };
  });

  // After commit: a rolled-back mark files no audit entry.
  if (lowQualityMark) await auditLowQualityMark(lowQualityMark);
  return txResponse;
};
