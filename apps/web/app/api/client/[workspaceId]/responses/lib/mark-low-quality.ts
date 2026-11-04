import "server-only";
import { Prisma } from "@formbricks/database/prisma";
import type { TResponse } from "@formbricks/types/responses";
import { writeResponsesOutcomeInTx } from "@/app/api/v3/responses/lib/outcome-write";
import { queueAuditEvent } from "@/modules/ee/audit-logs/lib/handler";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";

/** What marking did: the response as it now reads, and, when the outcome changed, its organization. */
export interface TLowQualityMark {
  response: TResponse;
  /** Set only when this call changed the outcome: what the audit entry is filed under. */
  organizationId?: string;
}

/**
 * Mark as low quality from the survey (ENG-6933, ADR 0022/0023): a rule's action made the survey send
 * `markLowQuality: true` with this create or update. The response is marked exactly as a reviewer marks
 * it, through the same outcome write the v3 API uses (`writeResponsesOutcomeInTx`, `outcome-write.ts`): the outcome becomes
 * Low quality and the Hub reconcile is queued in the same transaction, so the response leaves the
 * Analysis export and Dashboards, and a reviewer can restore it.
 *
 * One way: only a response with no outcome changes. One that already has an outcome keeps it, and nothing
 * is queued for it. There is no way for the survey to clear an outcome.
 *
 * Every read and write goes through `tx`: the client routes run inside one transaction per response, and a
 * second pool connection here could queue behind the very transaction waiting for it (ENG-3285).
 *
 * The queued row is left to the drain job instead of being drained before the respondent's request
 * returns: a finished Low quality response is never published to the Hub, so there is nothing to remove
 * in the common case, and the respondent must not wait on the Hub.
 */
export const markResponseLowQualityFromSurvey = async (
  tx: Prisma.TransactionClient,
  response: TResponse
): Promise<TLowQualityMark> => {
  const { workspaceId } = await tx.survey.findUniqueOrThrow({
    where: { id: response.surveyId },
    select: { workspaceId: true },
  });
  const { changes, organizationId } = await writeResponsesOutcomeInTx(
    tx,
    [response.id],
    "lowQuality",
    { workspaceId },
    { onlyWhenUnset: true }
  );
  if (changes.length === 0) return { response };
  return { response: { ...response, outcome: "lowQuality" }, organizationId };
};

/**
 * The audit entry for a mark, as the v3 outcome write files one ("updated" on the response, the outcome
 * before and after), attributed to the system: the survey's rule set it, not a person. Called after the
 * transaction committed; a mark that changed nothing files nothing.
 */
export const auditLowQualityMark = async ({ response, organizationId }: TLowQualityMark): Promise<void> => {
  if (!organizationId) return;
  await queueAuditEvent({
    action: "updated",
    targetType: "response",
    targetId: response.id,
    userId: UNKNOWN_DATA,
    userType: "system",
    organizationId,
    status: "success",
    oldObject: { id: response.id, outcome: null },
    newObject: { id: response.id, outcome: "lowQuality" },
  });
};
