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
  meta: true,
  contactAttributes: true,
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
        // The survey join is for the file cleanup below, not for the audit record — it is dropped
        // before the row is returned. Both shapes: `getSurveyFileUploadElementIds` documents the union
        // as mandatory and v1/v2 pass both, so v3 matches rather than betting on `questions` staying
        // empty everywhere.
        select: {
          ...deletedResponseSelect,
          survey: { select: { blocks: true, questions: true } },
        },
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
      const { survey, ...row } = deletedRow;
      return {
        row,
        fileUrls: collectResponseFileUrls(
          row.data,
          getSurveyFileUploadElementIds({ blocks: survey.blocks, questions: survey.questions })
        ),
      };
    });
  } catch (error) {
    rethrowScopedPrismaError(error);
  }

  const { row, fileUrls } = deleted;

  if (fileUrls.length === 0) {
    return row;
  }

  // Never `undefined` here — `workspaceId` came from the scope the caller already authorized against.
  // Worth stating because passing a falsy second argument makes `deleteResponseFileUrls` delete nothing
  // and only emit a `logger.error`, so the cleanup would fail silently.
  try {
    await deleteResponseFileUrls(fileUrls, workspaceId);
  } catch (error) {
    // The row is already gone and the caller's request succeeded; orphaned objects are a storage-cleanup
    // problem, not a reason to report a failed delete. Logged loudly so it is not invisible.
    logger.error(
      { err: error, responseId, workspaceId, fileCount: fileUrls.length },
      "V3 response file cleanup failed"
    );
  }

  return row;
}
