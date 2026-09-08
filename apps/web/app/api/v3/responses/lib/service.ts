import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError, UniqueConstraintError } from "@formbricks/types/errors";
import { deleteDisplay } from "@/lib/display/service";
import { reduceQuotaLimits } from "@/modules/ee/quotas/lib/quotas";
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
 * Delete one response inside its workspace, and clean up everything that goes with it.
 *
 * The order is load-bearing, because two of the things needing cleanup **vanish with the row**: the file
 * URLs live only inside `response.data`, and `quotaLinks` go with `ON DELETE CASCADE`. Written the
 * obvious way — delete, then work out what to clean up — both are already gone. So the delete's own
 * `select` captures them, which is also how the legacy path gets them.
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
): Promise<void> {
  let fileUrls: string[] = [];

  try {
    await prisma.$transaction(async (tx) => {
      // Scoped `where`, never a bare id. A response outside the workspace matches nothing and Prisma
      // raises P2025, which becomes the same 403 as a pre-flight rejection — so one scoped statement
      // does the ownership check and the delete together, with no window between them and no second
      // query whose absence a caller could time.
      const deleted = await tx.response.delete({
        where: { id: responseId, survey: { workspaceId } },
        select: {
          displayId: true,
          data: true,
          survey: { select: { blocks: true } },
          // Captured in the delete's own select: once the row is gone these are gone too, so a separate
          // SELECT afterwards returns nothing. `screenedIn` only — a response screened out never counted
          // against a quota, so there is nothing to give back.
          quotaLinks: {
            where: { status: "screenedIn" },
            select: { quota: { select: { id: true } } },
          },
        },
      });

      if (deleted.displayId) {
        await deleteDisplay(deleted.displayId, tx);
      }

      // The cascade removes the *links*, which fixes the count. It does not touch `SurveyQuota.limit`,
      // so without this a deleted response keeps consuming quota capacity forever. Both management APIs
      // miss this today (v1 takes `deleteResponse`'s `decrementQuotas = false` default, v2 has no quota
      // code at all); only the dashboard opts in.
      const quotaIds = deleted.quotaLinks.map((link) => link.quota.id);
      if (quotaIds.length > 0) {
        await reduceQuotaLimits(quotaIds, tx);
      }

      // Read inside the transaction, deleted outside it.
      fileUrls = collectResponseFileUrls(
        deleted.data,
        getSurveyFileUploadElementIds({ blocks: deleted.survey.blocks })
      );
    });
  } catch (error) {
    rethrowScopedPrismaError(error);
  }

  if (fileUrls.length === 0) {
    return;
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
}
