import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { PICKED_ITEMS_MAX } from "@/app/api/internal/lib/limits";
import { V3_NAME_MAX_LENGTH } from "@/app/api/v3/charts/lib/schemas";
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

/** The organization a new dataset is created in. Named by the caller, then authorized. */
export const ZDatasetCreateQuery = z.object({ organizationId: ZId }).strict();

/** A new dataset: its name and, optionally, the workspaces it is assigned to. */
export const ZDatasetCreateBody = ZFeedbackDirectoryCreateInput.extend({
  name: ZFeedbackDirectoryCreateInput.shape.name.max(V3_NAME_MAX_LENGTH),
  workspaceIds: z.array(ZId).max(PICKED_ITEMS_MAX).optional(),
}).strict();

/** A change to a dataset: rename it, reassign its workspaces, or archive and unarchive it. */
export const ZDatasetUpdateBody = ZFeedbackDirectoryUpdateInput.extend({
  name: ZFeedbackDirectoryUpdateInput.shape.name.unwrap().max(V3_NAME_MAX_LENGTH).optional(),
  workspaceIds: z.array(ZId).max(PICKED_ITEMS_MAX).optional(),
}).strict();

export type TDatasetCreateBody = z.infer<typeof ZDatasetCreateBody>;
export type TDatasetUpdateBody = z.infer<typeof ZDatasetUpdateBody>;
