import { z } from "zod";

/**
 * Zod schemas for the Unify Feedback taxonomy v3 routes.
 *
 * `sourceId` is intentionally NOT `.min(1)`: the empty string is the canonical "no source" bucket
 * for feedback ingested without an attributed source (Hub canonicalizes "no source" to ""), so the
 * scope must accept and forward it. `runId`/`nodeId` are Hub UUIDs, while `workspaceId`/`directoryId`
 * are Formbricks cuid2 ids.
 */

const workspaceId = z.cuid2();
const directoryId = z.cuid2();
const sourceType = z.string().trim().min(1).max(255);
const sourceId = z.string().trim().max(255);
const fieldId = z.string().trim().min(1).max(255);
const label = z.string().trim().min(1).max(1000);

export const ZWorkspaceDirectoryQuery = z
  .object({
    workspaceId,
    directoryId,
  })
  .strict();

export const ZTaxonomyStateQuery = z
  .object({
    workspaceId,
    directoryId,
    sourceType,
    sourceId,
    fieldId,
  })
  .strict();

export const ZNodeRecordsQuery = z
  .object({
    workspaceId,
    directoryId,
    limit: z.coerce.number().int().min(1).max(100).default(100),
  })
  .strict();

export const ZTriggerRunBody = z
  .object({
    workspaceId,
    directoryId,
    sourceType,
    sourceId,
    fieldId,
    fieldLabel: z.string().trim().max(1000).optional(),
  })
  .strict();

export const ZRenameNodeBody = z
  .object({
    workspaceId,
    directoryId,
    label,
  })
  .strict();

export const ZRunIdParams = z.object({ runId: z.string().uuid() }).strict();
export const ZNodeIdParams = z.object({ nodeId: z.string().uuid() }).strict();

export type TWorkspaceDirectoryQuery = z.infer<typeof ZWorkspaceDirectoryQuery>;
export type TTaxonomyStateQuery = z.infer<typeof ZTaxonomyStateQuery>;
export type TNodeRecordsQuery = z.infer<typeof ZNodeRecordsQuery>;
export type TTriggerRunBody = z.infer<typeof ZTriggerRunBody>;
export type TRenameNodeBody = z.infer<typeof ZRenameNodeBody>;
