import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { enqueueAttachmentExportJob } from "@formbricks/jobs";
import type { TResponseFilterCriteria } from "@formbricks/types/responses";
import { ATTACHMENT_EXPORT_LIST_LIMIT } from "./constants";
import type { TAttachmentExport } from "./types";

export { buildAttachmentExportStorageKey, isAttachmentExportFilePath } from "./storage-key";

/**
 * Persistence for background attachment exports (ENG-6862). Every read is scoped by survey, workspace
 * and requester: an export holds respondent files, and only the user who started it may see or fetch it.
 */

const attachmentExportSelect = {
  id: true,
  surveyId: true,
  workspaceId: true,
  status: true,
  filterCriteria: true,
  dispatchCount: true,
  fileCount: true,
  responseCount: true,
  includedFileCount: true,
  totalBytes: true,
  truncated: true,
  storageKey: true,
  errorCode: true,
  createdAt: true,
  finishedAt: true,
  expiresAt: true,
} satisfies Prisma.AttachmentExportSelect;

export type TAttachmentExportRow = Prisma.AttachmentExportGetPayload<{
  select: typeof attachmentExportSelect;
}>;

const ACTIVE_STATUSES = ["queued", "running"] as const;

export const toAttachmentExportDto = (row: TAttachmentExportRow): TAttachmentExport => ({
  id: row.id,
  surveyId: row.surveyId,
  status: row.status,
  filtered: row.filterCriteria !== null,
  fileCount: row.fileCount,
  responseCount: row.responseCount,
  includedFileCount: row.includedFileCount,
  // A BigInt column for archives past 2 GB; JSON has no BigInt, and 5 GB is far inside Number's range.
  totalBytes: row.totalBytes === null ? null : Number(row.totalBytes),
  truncated: row.truncated,
  errorCode: row.errorCode,
  createdAt: row.createdAt.toISOString(),
  finishedAt: row.finishedAt?.toISOString() ?? null,
  expiresAt: row.expiresAt?.toISOString() ?? null,
});

interface TAttachmentExportScope {
  surveyId: string;
  workspaceId: string;
  requestedById: string;
}

/**
 * Creates a queued export, or returns the requester's export for this survey that is already queued or
 * running. The migration's partial unique index on (surveyId, requestedById) over active rows is what
 * makes this race-free: a concurrent second insert fails on it instead of starting a second build.
 */
export const createAttachmentExport = async ({
  surveyId,
  workspaceId,
  requestedById,
  filterCriteria,
  timeZone,
  fileCount,
  responseCount,
}: TAttachmentExportScope & {
  filterCriteria: TResponseFilterCriteria | undefined;
  timeZone: string;
  fileCount: number;
  responseCount: number;
}): Promise<{ row: TAttachmentExportRow; created: boolean }> => {
  try {
    const row = await prisma.attachmentExport.create({
      data: {
        surveyId,
        workspaceId,
        requestedById,
        filterCriteria: filterCriteria ?? Prisma.DbNull,
        timeZone,
        fileCount,
        responseCount,
      },
      select: attachmentExportSelect,
    });
    return { row, created: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PrismaErrorType.UniqueConstraintViolation
    ) {
      const active = await prisma.attachmentExport.findFirst({
        where: { surveyId, workspaceId, requestedById, status: { in: [...ACTIVE_STATUSES] } },
        select: attachmentExportSelect,
      });
      // Gone between the failed insert and this read only if it finished in that instant; the caller's
      // retry then creates a fresh one.
      if (active) return { row: active, created: false };
    }
    throw error;
  }
};

/** Enqueues the build. The job id carries the dispatch count, see `enqueueAttachmentExportJob`. */
export const dispatchAttachmentExport = async (
  row: Pick<TAttachmentExportRow, "id" | "workspaceId" | "dispatchCount">
): Promise<void> => {
  await enqueueAttachmentExportJob(
    { attachmentExportId: row.id, workspaceId: row.workspaceId },
    { jobId: `${row.id}-${row.dispatchCount}` }
  );
};

/** Fails an export that never got a job, so the menu stops showing it as in progress. */
export const failUndispatchedAttachmentExport = async ({
  id,
  workspaceId,
}: Pick<TAttachmentExportRow, "id" | "workspaceId">): Promise<void> => {
  await prisma.attachmentExport.updateMany({
    where: { id, workspaceId, status: "queued" },
    data: { status: "failed", errorCode: "enqueue_failed", finishedAt: new Date() },
  });
};

export const getAttachmentExport = async ({
  id,
  ...scope
}: TAttachmentExportScope & { id: string }): Promise<TAttachmentExportRow | null> =>
  prisma.attachmentExport.findFirst({
    where: { id, ...scope },
    select: attachmentExportSelect,
  });

/** The requester's recent exports of this survey that can still be shown, newest first. */
export const listAttachmentExports = async (scope: TAttachmentExportScope): Promise<TAttachmentExportRow[]> =>
  prisma.attachmentExport.findMany({
    where: { ...scope, status: { not: "expired" } },
    orderBy: { createdAt: "desc" },
    take: ATTACHMENT_EXPORT_LIST_LIMIT,
    select: attachmentExportSelect,
  });
