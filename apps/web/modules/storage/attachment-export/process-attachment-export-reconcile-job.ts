import "server-only";
import { prisma } from "@formbricks/database";
import { type JobHandler, type TAttachmentExportReconcileJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { deleteFile } from "@formbricks/storage";
import { getJobsQueueingConfig } from "@/lib/jobs/config";
import { isNewReleaseWorkEnabled } from "@/lib/upgrade/compatibility";
import { loggableError } from "@/lib/utils/loggable-error";
import {
  ATTACHMENT_EXPORT_RECONCILE_BATCH,
  ATTACHMENT_EXPORT_REDISPATCH_AFTER_MS,
  ATTACHMENT_EXPORT_STALE_AFTER_MS,
} from "./constants";
import { notifyAttachmentExportFailed } from "./notify-requester";
import { dispatchAttachmentExport } from "./service";
import { ATTACHMENT_EXPORT_ACTIVE_STATUSES } from "./types";

/**
 * Keeps attachment exports from getting stuck and archives from outliving their expiry (ENG-6862). Runs
 * every few minutes; every step is idempotent and safe to overlap with another tick or a running build.
 *
 * 1. **Stale:** a queued or running export older than the stale cutoff was lost — a pod killed past its
 *    retries, a job an older release dropped — and is failed so the user can start a new one. The
 *    requester is emailed, since the email is the only way they hear how the export ended.
 * 2. **Lost dispatch:** a queued export untouched for a few minutes never reached a worker (Redis
 *    hiccup, an older pod that completed the unknown job without running it). It is re-enqueued under a
 *    new job id; a bare id would dedupe against the dropped job for a day.
 * 3. **Expired:** a completed archive past `expiresAt` is deleted and the row marked `expired`.
 * 4. **Failed leftovers:** a failed export whose archive delete did not go through is retried.
 */

/** Fails lost exports one by one, so each requester whose export this tick settles is emailed once. */
const failStaleExports = async (now: number): Promise<number> => {
  const stale = await prisma.attachmentExport.findMany({
    where: {
      status: { in: [...ATTACHMENT_EXPORT_ACTIVE_STATUSES] },
      createdAt: { lt: new Date(now - ATTACHMENT_EXPORT_STALE_AFTER_MS) },
    },
    select: { id: true, workspaceId: true },
    orderBy: { createdAt: "asc" },
    take: ATTACHMENT_EXPORT_RECONCILE_BATCH,
  });

  let failed = 0;
  for (const row of stale) {
    // Guarded on the status, so an export a build settled since the read is left alone.
    const settled = await prisma.attachmentExport.updateMany({
      where: { id: row.id, status: { in: [...ATTACHMENT_EXPORT_ACTIVE_STATUSES] } },
      data: { status: "failed", errorCode: "stale", finishedAt: new Date(now) },
    });
    if (settled.count === 0) continue;
    failed++;
    await notifyAttachmentExportFailed({
      attachmentExportId: row.id,
      workspaceId: row.workspaceId,
      errorCode: "stale",
    });
  }
  return failed;
};

const redispatchLostExports = async (now: number): Promise<number> => {
  if (!getJobsQueueingConfig().enabled || !(await isNewReleaseWorkEnabled())) return 0;

  const lost = await prisma.attachmentExport.findMany({
    where: { status: "queued", updatedAt: { lt: new Date(now - ATTACHMENT_EXPORT_REDISPATCH_AFTER_MS) } },
    select: { id: true, workspaceId: true, dispatchCount: true },
    orderBy: { createdAt: "asc" },
    take: ATTACHMENT_EXPORT_RECONCILE_BATCH,
  });

  let redispatched = 0;
  for (const row of lost) {
    // Compare-and-set on the count, so two overlapping ticks enqueue one job, not two.
    const bumped = await prisma.attachmentExport.updateMany({
      where: { id: row.id, status: "queued", dispatchCount: row.dispatchCount },
      data: { dispatchCount: { increment: 1 } },
    });
    if (bumped.count === 0) continue;

    try {
      await dispatchAttachmentExport({ ...row, dispatchCount: row.dispatchCount + 1 });
      redispatched++;
    } catch (error) {
      // The bump moved `updatedAt`, so the next tick after the redispatch delay tries again.
      logger.warn(
        { attachmentExportId: row.id, err: loggableError(error) },
        "Failed to re-dispatch attachment export"
      );
    }
  }
  return redispatched;
};

/** Deletes the archives of the given rows; returns the ids whose delete succeeded. */
const deleteArchives = async (rows: { id: string; storageKey: string | null }[]): Promise<string[]> => {
  const deletedIds: string[] = [];
  for (const row of rows) {
    if (!row.storageKey) {
      deletedIds.push(row.id);
      continue;
    }
    const result = await deleteFile(row.storageKey);
    if (result.ok) deletedIds.push(row.id);
  }
  return deletedIds;
};

export const processAttachmentExportReconcileJob: JobHandler<
  TAttachmentExportReconcileJobData
> = async () => {
  const now = Date.now();

  const staleFailed = await failStaleExports(now);

  const redispatched = await redispatchLostExports(now);

  const expiring = await prisma.attachmentExport.findMany({
    where: { status: "completed", expiresAt: { lt: new Date(now) } },
    select: { id: true, storageKey: true },
    orderBy: { expiresAt: "asc" },
    take: ATTACHMENT_EXPORT_RECONCILE_BATCH,
  });
  const expiredIds = await deleteArchives(expiring);
  if (expiredIds.length > 0) {
    await prisma.attachmentExport.updateMany({
      where: { id: { in: expiredIds }, status: "completed" },
      data: { status: "expired", storageKey: null },
    });
  }

  const failedLeftovers = await prisma.attachmentExport.findMany({
    where: { status: "failed", storageKey: { not: null } },
    select: { id: true, storageKey: true },
    take: ATTACHMENT_EXPORT_RECONCILE_BATCH,
  });
  const cleanedIds = await deleteArchives(failedLeftovers);
  if (cleanedIds.length > 0) {
    await prisma.attachmentExport.updateMany({
      where: { id: { in: cleanedIds }, status: "failed" },
      data: { storageKey: null },
    });
  }

  if (staleFailed + redispatched + expiredIds.length + cleanedIds.length > 0) {
    logger.info(
      {
        staleFailed,
        redispatched,
        expired: expiredIds.length,
        failedArchivesDeleted: cleanedIds.length,
      },
      "Attachment export reconcile pass"
    );
  }
};
