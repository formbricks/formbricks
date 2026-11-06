import "server-only";
import { Prisma } from "@formbricks/database/prisma";
import type { TResponseOutcome } from "@formbricks/types/responses";
import { andVisibleSurveys } from "@/lib/survey/visibility/predicate";
import { enqueueResponseOutcomeCleanups } from "@/modules/deletion-cleanup/lib/enqueue";

/**
 * The response outcome write (ENG-6785), on its own so every path that sets an outcome shares it: the
 * v3 batch and single-response writes, and the survey's Mark as low quality (ENG-6933), whose client
 * routes must not load the v3 write service with them.
 */

/**
 * Queue the Hub cleanup for responses whose outcome changed, in the transaction that wrote it (ENG-6785):
 * a write that commits always gets it, and one that rolls back queues nothing.
 */
export const enqueueOutcomeCleanup = async (
  tx: Prisma.TransactionClient,
  workspaceId: string,
  changes: { id: string; surveyId: string }[]
): Promise<{ drainNowIds: string[]; organizationId: string }> => {
  const { organizationId } = await tx.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { organizationId: true },
  });
  const { drainNowIds } = await enqueueResponseOutcomeCleanups(tx, { organizationId, workspaceId, changes });
  return { drainNowIds, organizationId };
};

export type TOutcomeScope = {
  /** ENG-3282: responses of a survey the caller cannot see are scope-filtered out, like foreign ids. */
  visibleSurveyWhere?: Prisma.SurveyWhereInput;
  workspaceId: string;
};

export const outcomeScopeWhere = (
  ids: string[],
  { visibleSurveyWhere = {}, workspaceId }: TOutcomeScope
): Prisma.ResponseWhereInput => ({
  id: { in: ids },
  survey: { workspaceId, ...andVisibleSurveys(visibleSurveyWhere) },
});

export type TV3OutcomeChange = { id: string; surveyId: string; previous: TResponseOutcome | null };

/**
 * The one outcome write (ENG-6785): sets `outcome` on the in-scope responses of `ids` that don't carry
 * it yet, inside `tx`, and queues the Hub cleanup for exactly those in the same transaction. A response
 * already carrying it is left alone, so a retry neither churns `updatedAt` nor queues anything.
 * `onlyWhenUnset` changes only responses with no outcome at all: the survey's one-way Low quality
 * mark (ENG-6933) never overrides a reviewer's outcome.
 *
 * `drainNowIds` is for the caller to drain after commit, or to leave to the drain job.
 */
export async function writeResponsesOutcomeInTx(
  tx: Prisma.TransactionClient,
  ids: string[],
  outcome: TResponseOutcome | null,
  scope: TOutcomeScope,
  { onlyWhenUnset = false }: { onlyWhenUnset?: boolean } = {}
): Promise<{
  matched: number;
  changes: TV3OutcomeChange[];
  drainNowIds: string[];
  organizationId?: string;
}> {
  const inScope = await tx.response.findMany({
    where: outcomeScopeWhere(ids, scope),
    select: { id: true, surveyId: true, outcome: true },
  });
  const changes = inScope
    .filter((row) => row.outcome !== outcome && (!onlyWhenUnset || row.outcome === null))
    .map((row) => ({ id: row.id, surveyId: row.surveyId, previous: row.outcome }));
  if (changes.length === 0) return { matched: inScope.length, changes, drainNowIds: [] };

  await tx.response.updateMany({
    where: {
      ...outcomeScopeWhere(
        changes.map(({ id }) => id),
        scope
      ),
      // Re-checked in the write itself, so a reviewer's outcome landing in between is never overridden.
      ...(onlyWhenUnset ? { outcome: null } : {}),
    },
    data: { outcome },
  });

  const { drainNowIds, organizationId } = await enqueueOutcomeCleanup(
    tx,
    scope.workspaceId,
    changes.map(({ id, surveyId }) => ({ id, surveyId }))
  );
  return { matched: inScope.length, changes, drainNowIds, organizationId };
}
