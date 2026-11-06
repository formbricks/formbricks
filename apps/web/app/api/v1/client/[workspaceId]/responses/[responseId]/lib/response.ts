import { prisma } from "@formbricks/database";
import { type TIngestFlag } from "@formbricks/types/embedded-data-ingest";
import { ResourceNotFoundError, ResponseAlreadyFinishedError } from "@formbricks/types/errors";
import { TResponseWithQuotaFull } from "@formbricks/types/quota";
import { TClientResponseUpdateInput } from "@formbricks/types/responses";
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

    const updated = await updateResponse(responseId, responseInput, tx, ingestFlags);
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
