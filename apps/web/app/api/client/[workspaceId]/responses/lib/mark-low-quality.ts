import "server-only";
import { Prisma } from "@formbricks/database/prisma";
import type { TResponse } from "@formbricks/types/responses";
import { enqueueResponseOutcomeCleanups } from "@/modules/deletion-cleanup/lib/enqueue";

/**
 * Mark as low quality from the survey (ENG-6933, ADR 0022/0023): a rule's action made the survey send
 * `markLowQuality: true` with this create or update. The response is marked exactly as a reviewer marks
 * it: the outcome becomes Low quality and the Hub reconcile is queued in the same transaction, so the
 * response leaves the Analysis export and Dashboards, and a reviewer can restore it.
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
): Promise<TResponse> => {
  const { count } = await tx.response.updateMany({
    where: { id: response.id, outcome: null },
    data: { outcome: "lowQuality" },
  });
  if (count === 0) return response;

  const { workspace } = await tx.survey.findUniqueOrThrow({
    where: { id: response.surveyId },
    select: { workspace: { select: { id: true, organizationId: true } } },
  });
  await enqueueResponseOutcomeCleanups(tx, {
    organizationId: workspace.organizationId,
    workspaceId: workspace.id,
    changes: [{ id: response.id, surveyId: response.surveyId }],
  });

  return { ...response, outcome: "lowQuality" };
};
