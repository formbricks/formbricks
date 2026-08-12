import { z } from "zod";

/**
 * Zod schemas for the internal feedback-datasets routes.
 *
 * `datasetId` is the FeedbackDirectory id, which is also the Hub `tenant_id`. It comes from the path;
 * `workspaceId` comes from the body because authorization is workspace-scoped (a dataset is reached
 * *through* a workspace the caller has access to — see `requireUnifyDirectoryMutationAccess`).
 */

const workspaceId = z.cuid2();
const datasetId = z.cuid2();

export const ZDatasetPathParams = z
  .object({
    datasetId,
  })
  .strict();

export const ZPurgeDatasetBody = z
  .object({
    workspaceId,
  })
  .strict();

export type TDatasetPathParams = z.infer<typeof ZDatasetPathParams>;
export type TPurgeDatasetBody = z.infer<typeof ZPurgeDatasetBody>;
