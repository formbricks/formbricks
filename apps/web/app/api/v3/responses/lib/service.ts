import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError, UniqueConstraintError } from "@formbricks/types/errors";
import { deleteDisplay } from "@/lib/display/service";
import { deleteResponseFileUrls } from "@/modules/storage/lib/delete-response-files";
import { collectResponseFileUrls, getSurveyFileUploadElementIds } from "@/modules/storage/utils";

/**
 * The one service the v3 response operations go through.
 *
 * It **composes** the existing quota, storage and display helpers and adds its own workspace-scoped
 * accessors. It deliberately does not touch `apps/web/lib/response/service.ts` or anything else v1
 * management and the dashboard already run: retrofitting the old paths would move this project's blast
 * radius onto surfaces nobody asked to change.
 *
 * The rule that shapes every function here: **the resolved workspace goes in the `where` clause.** No v3
 * path may reach the bare-id accessor at `lib/response/service.ts` (`getResponse`, a `findUnique` on
 * `id` alone), because a bare id is how a caller reads another tenant's response. `Response` carries no
 * `workspaceId` column, so tenancy is only expressible as `survey: { workspaceId }`.
 */

/**
 * Prisma codes are branched **here**, before anything wraps them.
 *
 * `DatabaseError` takes only a message, and the codebase convention is to rethrow
 * `new DatabaseError(error.message)` — which destroys the code. By the time a shared mapper sees it there
 * is nothing left to branch on, so it correctly answers a generic 500. Mapping at the throw site is the
 * only place the code still exists.
 *
 * `P2025` becomes `ResourceNotFoundError` so the shared mapper renders it as the *same* 403 body a
 * pre-flight ownership rejection produces — which is the whole point, since a scoped write that matches
 * nothing must not be distinguishable from one the caller may not touch.
 *
 * `P2003` (a dangling foreign key) is deliberately left alone: it is the caller's input and deserves a
 * 422 naming the field, which only an operation that knows the field can build. On Prisma 7 its
 * constraint name is nested under `meta.driverAdapterError.cause`, not where the docs put it.
 */
function rethrowScopedPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      // No id in the message: it would travel into a log line that is already correlated by requestId,
      // and the operations layer keeps it out of the body.
      throw new ResourceNotFoundError("Response", null);
    }

    if (error.code === "P2002") {
      throw new UniqueConstraintError("A response with these unique values already exists");
    }
  }

  throw error;
}

type TWorkspaceScope = { workspaceId: string };

/**
 * Resolve which workspace owns a response, without asserting the caller may see it.
 *
 * Deliberately unscoped, and safe because of what the caller does next: the operation feeds this into
 * `requireV3WorkspaceAccess` and answers an identical 403 whether the response is missing or forbidden.
 * Resolving the scope *from the response* rather than trusting a client-supplied `workspaceId` is what
 * makes the scope unforgeable — a caller cannot pair someone else's response id with a workspace they
 * happen to have access to. Same shape as `authorizeTagMutation`.
 */
export async function getResponseWorkspaceId(responseId: string): Promise<string | null> {
  try {
    const response = await prisma.response.findFirst({
      where: { id: responseId },
      select: { survey: { select: { workspaceId: true } } },
    });

    return response?.survey.workspaceId ?? null;
  } catch (error) {
    rethrowScopedPrismaError(error);
  }
}

/**
 * The deleted row as recorded in the audit trail: the response's own scalars, no relations. Mirrors v1's
 * `responseSelection` minus its `contact`/`tags` joins, which are not worth adding to a delete.
 */
const deletedResponseSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  finished: true,
  surveyId: true,
  contactId: true,
  endingId: true,
  data: true,
  variables: true,
  ttc: true,
  // Deliberately absent: `meta` and `contactAttributes`. Nothing reads either — they would reach only
  // the audit log's `oldObject`, and `redactPII` (`lib/utils/logger-helpers.ts`) matches exact key
  // names, so `meta.ipAddress` lands there in plaintext. Those two are precisely what this resource's
  // contract names as never exposed in any view, and writing them to a store with its own retention,
  // access model and export path is exposing them. `contactId` and `surveyId` keep the record
  // reviewable without either. ENG-2873 covers the general shape of this problem.
  singleUseId: true,
  language: true,
  displayId: true,
} satisfies Prisma.ResponseSelect;

export type TDeletedResponse = Prisma.ResponseGetPayload<{ select: typeof deletedResponseSelect }>;

/**
 * Delete one response inside its workspace, and clean up everything that goes with it.
 *
 * The order is load-bearing, because what needs cleaning up **vanishes with the row**: the file URLs
 * live only inside `response.data`. Written the obvious way — delete, then work out what to clean up —
 * they are already gone. So the delete's own `select` captures them, which is also how the legacy path
 * gets them.
 *
 * Returns the deleted row so the caller can record it as the audit event's `oldObject`. A delete that
 * leaves no trace of *what* it destroyed is not a reviewable audit trail, and v1, v2 and
 * `deleteV3FeedbackRecord` all record it. Field set matches v1's `responseSelection` scalars; the
 * `contact` and `tags` joins it also carries are left out rather than adding joins to a delete.
 *
 * **The delete's `select` must stay scalar-only.** On Prisma 7 a `delete` whose `select` pulls in a
 * relation is compiled as read-then-delete, and the client returns the *read* payload without checking
 * that the DELETE matched a row — so a concurrent caller that lost the race is told it succeeded
 * instead of raising `P2025`. Measured: with a relation in the select two racing deletes of the same
 * row both resolved, 3 times out of 3; with scalars only, exactly one raised `P2025` every time. That
 * is why the survey's element ids are fetched by their own query rather than joined in here.
 *
 * Storage deletion happens **after** the transaction commits. Inside it, a rollback would leave a live
 * response pointing at deleted objects; both existing delete paths order it this way for that reason.
 *
 * Fires nothing to webhooks: there is no `responseDeleted` trigger anywhere in the repo, and none of the
 * three existing delete implementations dispatches one. The Hub cascade is ENG-2855's, after the Hub
 * release; this just does not make it harder to add.
 */
export async function deleteScopedResponse(
  responseId: string,
  { workspaceId }: TWorkspaceScope
): Promise<TDeletedResponse> {
  let deleted: { row: TDeletedResponse; fileUrls: string[] };

  try {
    deleted = await prisma.$transaction(async (tx) => {
      // Scoped `where`, never a bare id. A response outside the workspace matches nothing and Prisma
      // raises P2025, which becomes the same 403 as a pre-flight rejection — so one scoped statement
      // does the ownership check and the delete together, with no window between them and no second
      // query whose absence a caller could time.
      const deletedRow = await tx.response.delete({
        where: { id: responseId, survey: { workspaceId } },
        // Scalars only, deliberately — see the note above the function. The survey's element ids are
        // read separately, below.
        select: deletedResponseSelect,
      });

      // The survey outlives the response, so this reads correctly after the delete. Both shapes:
      // `getSurveyFileUploadElementIds` documents the union as mandatory and v1/v2 pass both.
      const survey = await tx.survey.findUnique({
        where: { id: deletedRow.surveyId },
        select: { blocks: true, questions: true },
      });

      if (deletedRow.displayId) {
        await deleteDisplay(deletedRow.displayId, tx);
      }

      // Deliberately no `reduceQuotaLimits` here. `ON DELETE CASCADE` drops the `ResponseQuotaLink`
      // rows, and the only fullness predicate in the repo is `screenedInCount >= quota.limit`
      // (`modules/ee/quotas/lib/utils.ts`) counting those same live rows — so the cascade *already*
      // gives the capacity back. Decrementing `limit` on top of that cancels the slot the cascade freed
      // and permanently shrinks a customer-configured setting that nothing restores; repeated deletes
      // ratchet it down. `limit` is user-facing ("Limit" in the quota editor), and the dashboard's
      // checkbox — "Decrement all limits of quotas including this response" — is an explicit opt-in to
      // that separate intent, not delete housekeeping. So v3 takes v1's `decrementQuotas = false`
      // default. Exposing it as an opt-in flag later is additive; making it unconditional now would be
      // an irreversible default no caller can decline.

      // Read inside the transaction, deleted outside it.
      return {
        row: deletedRow,
        fileUrls: collectResponseFileUrls(
          deletedRow.data,
          getSurveyFileUploadElementIds({ blocks: survey?.blocks, questions: survey?.questions })
        ),
      };
    });
  } catch (error) {
    rethrowScopedPrismaError(error);
  }

  const { row, fileUrls } = deleted;

  // Skipped rather than called with an empty list: nothing to do, and it keeps the storage call out of
  // the common path. `workspaceId` is never `undefined` here — it came from the scope the caller was
  // already authorized against — which matters because a falsy second argument makes
  // `deleteResponseFileUrls` delete nothing and only emit a `logger.error`, failing silently.
  if (fileUrls.length > 0) {
    try {
      await deleteResponseFileUrls(fileUrls, workspaceId);
    } catch (error) {
      // The row is already gone and the caller's request succeeded; orphaned objects are a
      // storage-cleanup problem, not a reason to report a failed delete. Logged loudly so it is not
      // invisible.
      logger.error(
        { err: error, responseId, workspaceId, fileCount: fileUrls.length },
        "V3 response file cleanup failed"
      );
    }
  }

  return row;
}

export type TBatchDeleteResult = {
  /** Rows the database actually removed. Authoritative, and may be lower than the ids submitted. */
  deleted: number;
  /** The ids that were in scope when the batch was read, for the audit trail. */
  deletedIds: string[];
};

/**
 * Delete up to a batch of responses inside one workspace, in a single transaction.
 *
 * **It scope-filters instead of rejecting.** Every statement carries `survey: { workspaceId }`, so an
 * id belonging to another workspace, or one already deleted, simply matches nothing. That is the
 * contract's semantics and it is what makes the call idempotent: rejecting the batch on a foreign id
 * would both leak that the id exists somewhere and break retries, because after a partial application
 * an already-deleted id is indistinguishable from a foreign one.
 *
 * `deleteMany`'s own `count` is what gets reported, never the length of the earlier read. The two can
 * disagree — a concurrent caller may remove a row in between — and only the write knows what it
 * actually did. This is also why the batch needs no equivalent of the single delete's scalar-only
 * `select` rule: `deleteMany` returns a count rather than a row, so there is no relation join for
 * Prisma to compile into a read-then-delete.
 *
 * Responses are deleted before displays. Both orders are correct — `Response_displayId_fkey` is
 * `ON DELETE SET NULL`, so removing a display first nulls the referencing rows rather than failing —
 * but that null-out is a wasted write pass over rows about to be deleted anyway, and it touches the
 * unique index on `displayId`. This order also matches the single delete. Files are collected before
 * either and removed only after the transaction commits, for the same reason as the single delete.
 */
export async function deleteScopedResponses(
  responseIds: string[],
  { workspaceId }: TWorkspaceScope
): Promise<TBatchDeleteResult> {
  let outcome: TBatchDeleteResult & { fileUrls: string[] };

  try {
    outcome = await prisma.$transaction(async (tx) => {
      // Scoped read first: the file URLs live inside `response.data` and the display ids on the rows,
      // and both are gone once the rows are.
      const rows = await tx.response.findMany({
        where: { id: { in: responseIds }, survey: { workspaceId } },
        select: { id: true, displayId: true, data: true, surveyId: true },
      });

      if (rows.length === 0) {
        return { deleted: 0, deletedIds: [], fileUrls: [] };
      }

      // One read per distinct survey rather than per response: a batch may span several surveys in the
      // workspace, and at 100 ids the per-row form would be 100 queries for a handful of answers.
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
        collectResponseFileUrls(row.data, uploadElementIds.get(row.surveyId) ?? new Set<string>())
      );

      // Responses before displays — see the note above. Not a correctness constraint: the FK is
      // SET NULL, so the reverse order also works, it just updates rows on their way out.
      const { count } = await tx.response.deleteMany({
        where: { id: { in: responseIds }, survey: { workspaceId } },
      });

      const displayIds = rows
        .map((row) => row.displayId)
        .filter((displayId): displayId is string => displayId !== null);

      if (displayIds.length > 0) {
        await tx.display.deleteMany({ where: { id: { in: displayIds } } });
      }

      return { deleted: count, deletedIds: rows.map((row) => row.id), fileUrls };
    });
  } catch (error) {
    rethrowScopedPrismaError(error);
  }

  const { fileUrls, ...result } = outcome;

  if (fileUrls.length > 0) {
    try {
      await deleteResponseFileUrls(fileUrls, workspaceId);
    } catch (error) {
      // The rows are already gone and the caller's request succeeded; orphaned objects are a
      // storage-cleanup problem, not a reason to report a failed delete. Same call as the single delete.
      logger.error(
        { err: error, workspaceId, responseCount: result.deleted, fileCount: fileUrls.length },
        "V3 batch response file cleanup failed"
      );
    }
  }

  return result;
}
