import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { deleteResponseFileUrls } from "@/modules/storage/lib/delete-response-files";
import { deleteSurveyUploadFolder } from "@/modules/storage/service";
import {
  CLEANUP_SETTLE_MS,
  DELETION_CLEANUP_CLAIM_BATCH,
  DELETION_CLEANUP_HUB_CALL_BUDGET,
  DELETION_CLEANUP_LEASE_SECONDS,
  DELETION_CLEANUP_RUN_BUDGET_MS,
  getDeletionCleanupRetryDelayMs,
} from "./constants";
import {
  type THubCallBudget,
  type THubCleanupResult,
  deleteHubRecords,
  isHubCallBudgetSpent,
} from "./hub-cleanup";

type TClaimedCleanup = {
  id: string;
  kind: string;
  organizationId: string;
  workspaceId: string;
  surveyId: string;
  tenantIds: string[];
  responseIds: string[];
  fileKeys: string[];
  attempts: number;
  /** The lease this drain holds, as written to `nextAttemptAt`; the fence for finishing the row. */
  leaseUntil: Date;
};

type TCleanupOutcome =
  | { status: "done" }
  /** Progress, not a failure: look again after `delayMs`, with whatever is left. */
  | { status: "again"; delayMs: number }
  | { status: "failed"; error: string; fileKeys?: string[] };

export type TDeletionCleanupDrainSummary = { done: number; again: number; failed: number };

/**
 * Claim due rows for this drain: each is hidden from other drains for the lease. `SKIP LOCKED` lets
 * concurrent drains split the queue instead of queueing behind each other. A later claim is only possible
 * once the lease has passed, so its `nextAttemptAt` is always later: that value is the lease's token.
 * Times are bound from the app clock, the same one Prisma writes with.
 */
const claimDueCleanups = (now: Date, ids: readonly string[] | undefined): Promise<TClaimedCleanup[]> => {
  const leaseUntil = new Date(now.getTime() + DELETION_CLEANUP_LEASE_SECONDS * 1000);
  return prisma.$queryRaw<TClaimedCleanup[]>`
    UPDATE "DeletionCleanup"
    SET "nextAttemptAt" = ${leaseUntil}, "updated_at" = ${now}
    WHERE "id" IN (
      SELECT "id" FROM "DeletionCleanup"
      WHERE "nextAttemptAt" <= ${now}
      ${ids ? Prisma.sql`AND "id" = ANY(${ids}::text[])` : Prisma.empty}
      ORDER BY "nextAttemptAt", "id"
      LIMIT ${DELETION_CLEANUP_CLAIM_BATCH}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "kind"::text AS "kind", "organizationId", "workspaceId", "surveyId", "tenantIds",
      "responseIds", "fileKeys", "attempts", "nextAttemptAt" AS "leaseUntil"
  `;
};

const surveyExists = async (surveyId: string): Promise<boolean> =>
  (await prisma.survey.findUnique({ where: { id: surveyId }, select: { id: true } })) !== null;

/**
 * Whether the drain may act yet. A row is only ever written by the delete it follows, but every kind that
 * deletes broadly re-checks that its data is really gone first: removing a live survey's upload folder or
 * Hub records would be unrecoverable, so a row that names a live survey or response waits instead.
 */
const getStillExistsError = async (row: TClaimedCleanup): Promise<string | null> => {
  if (row.kind === "hubResponses") {
    const live = await prisma.response.findFirst({
      where: { id: { in: row.responseIds } },
      select: { id: true },
    });
    return live ? "responseExists" : null;
  }
  return (await surveyExists(row.surveyId)) ? "surveyExists" : null;
};

const fromHubResult = (result: THubCleanupResult): TCleanupOutcome => {
  switch (result.status) {
    case "clean":
      return { status: "done" };
    // Look once more after the settle time: done only when a pass finds nothing left.
    case "deleted":
      return { status: "again", delayMs: CLEANUP_SETTLE_MS };
    case "budget":
      return { status: "again", delayMs: 0 };
    case "failed":
      return { status: "failed", error: result.error };
  }
};

const processCleanup = async (row: TClaimedCleanup, hubBudget: THubCallBudget): Promise<TCleanupOutcome> => {
  switch (row.kind) {
    case "hubSurvey":
    case "hubResponses": {
      const stillExists = await getStillExistsError(row);
      if (stillExists) return { status: "failed", error: stillExists };
      return fromHubResult(
        await deleteHubRecords(
          {
            tenantIds: row.tenantIds,
            surveyId: row.surveyId,
            ...(row.kind === "hubResponses" ? { responseIds: row.responseIds } : {}),
          },
          hubBudget
        )
      );
    }
    case "storageSurveyFolder": {
      const stillExists = await getStillExistsError(row);
      if (stillExists) return { status: "failed", error: stillExists };
      const ok = await deleteSurveyUploadFolder({ workspaceId: row.workspaceId, surveyId: row.surveyId });
      return ok ? { status: "done" } : { status: "failed", error: "storage" };
    }
    case "storageFiles": {
      // Each URL is checked against the workspace before anything is deleted; a refused one is final.
      const { failed } = await deleteResponseFileUrls(row.fileKeys, row.workspaceId);
      return failed.length === 0
        ? { status: "done" }
        : { status: "failed", error: "storage", fileKeys: failed };
    }
    default:
      return { status: "failed", error: "unknownKind" };
  }
};

/** The row as this drain claimed it: matches nothing once another drain has claimed it since. */
const leased = (row: TClaimedCleanup) => ({ id: row.id, nextAttemptAt: row.leaseUntil });

const finishCleanup = async (row: TClaimedCleanup, outcome: TCleanupOutcome, now: Date): Promise<void> => {
  let written: { count: number };
  if (outcome.status === "done") {
    written = await prisma.deletionCleanup.deleteMany({ where: leased(row) });
  } else if (outcome.status === "again") {
    written = await prisma.deletionCleanup.updateMany({
      where: leased(row),
      data: { attempts: 0, lastError: null, nextAttemptAt: new Date(now.getTime() + outcome.delayMs) },
    });
  } else {
    const attempts = row.attempts + 1;
    const retryInMs = getDeletionCleanupRetryDelayMs(attempts);
    written = await prisma.deletionCleanup.updateMany({
      where: leased(row),
      data: {
        attempts,
        lastError: outcome.error,
        nextAttemptAt: new Date(now.getTime() + retryInMs),
        ...(outcome.fileKeys ? { fileKeys: outcome.fileKeys } : {}),
      },
    });
    // An unconfigured Hub is a deployment choice, not a fault: the row waits for it, quietly.
    const log = outcome.error === "hubNotConfigured" ? logger.info : logger.warn;
    log.call(
      logger,
      {
        cleanupId: row.id,
        kind: row.kind,
        surveyId: row.surveyId,
        organizationId: row.organizationId,
        attempts,
        retryInMs,
        error: outcome.error,
      },
      "Deletion cleanup failed; will retry"
    );
  }

  // The lease ran out mid-row and another drain claimed the row: its outcome stands, and this one's work
  // (idempotent deletes) is simply repeated by it.
  if (written.count === 0) {
    logger.warn(
      { cleanupId: row.id, kind: row.kind },
      "Deletion cleanup lease lost; left to the newer claim"
    );
  }
};

/** Hand claimed rows this drain won't get to straight back, rather than leaving them leased. */
const releaseCleanups = async (rows: readonly TClaimedCleanup[], now: Date): Promise<void> => {
  if (rows.length === 0) return;
  await prisma.deletionCleanup.updateMany({
    where: { OR: rows.map(leased) },
    data: { nextAttemptAt: now },
  });
};

/**
 * Work through due `DeletionCleanup` rows until none are left, the run's time budget is spent, or its Hub
 * call budget is. `ids` limits it to those rows, for the drain a delete runs straight after its commit.
 * Never throws for a row's failure: the row is rescheduled with backoff and the drain moves on.
 */
export const drainDeletionCleanups = async ({
  ids,
}: { ids?: readonly string[] } = {}): Promise<TDeletionCleanupDrainSummary> => {
  const summary: TDeletionCleanupDrainSummary = { done: 0, again: 0, failed: 0 };
  if (ids?.length === 0) return summary;

  const deadline = Date.now() + DELETION_CLEANUP_RUN_BUDGET_MS;
  const hubBudget: THubCallBudget = { remaining: DELETION_CLEANUP_HUB_CALL_BUDGET, deadline };

  while (Date.now() < deadline) {
    const rows = await claimDueCleanups(new Date(), ids);
    if (rows.length === 0) break;

    for (const [index, row] of rows.entries()) {
      // Out of time, or out of Hub calls (a row that hit the budget is due again at once, so claiming on
      // would only spin): leave the rest to the next run.
      if (Date.now() >= deadline || isHubCallBudgetSpent(hubBudget)) {
        await releaseCleanups(rows.slice(index), new Date());
        return summary;
      }

      let outcome: TCleanupOutcome;
      try {
        outcome = await processCleanup(row, hubBudget);
      } catch (error) {
        logger.error({ err: error, cleanupId: row.id, kind: row.kind }, "Deletion cleanup threw");
        outcome = { status: "failed", error: "error" };
      }
      await finishCleanup(row, outcome, new Date());
      summary[outcome.status] += 1;
    }
  }

  return summary;
};
