import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import {
  ZFeedbackDirectoryCreateInput,
  ZFeedbackDirectoryUpdateInput,
} from "@/modules/ee/feedback-directory/types/feedback-directory";

/**
 * Zod schemas for the internal feedback-datasets routes.
 *
 * `datasetId` is the FeedbackDirectory id, which is also the Hub `tenant_id`. It is the only input:
 * the organization is derived from the dataset server-side rather than supplied by the caller, so
 * there is nothing else to validate (see `requireFeedbackDatasetMutationAccess`).
 */

export const ZDatasetPathParams = z
  .object({
    datasetId: z.cuid2(),
  })
  .strict();

/** No query parameters are accepted; a stray one is a caller bug, not something to ignore. */
export const ZDatasetPurgeQuery = z.object({}).strict();

/** The organization a new dataset is created in. Named by the caller, then authorized. */
export const ZDatasetCreateQuery = z.object({ organizationId: ZId }).strict();

/** A new dataset: its name and, optionally, the workspaces it is assigned to. */
export const ZDatasetCreateBody = ZFeedbackDirectoryCreateInput.strict();

/** A change to a dataset: rename it, reassign its workspaces, or archive and unarchive it. */
export const ZDatasetUpdateBody = ZFeedbackDirectoryUpdateInput.strict();

/** No query parameters are accepted on the dataset itself. */
export const ZDatasetQuery = z.object({}).strict();

export type TDatasetCreateBody = z.infer<typeof ZDatasetCreateBody>;
export type TDatasetUpdateBody = z.infer<typeof ZDatasetUpdateBody>;
