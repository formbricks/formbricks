import { z } from "zod";

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

export type TDatasetPathParams = z.infer<typeof ZDatasetPathParams>;
