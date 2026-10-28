import { z } from "zod";
import { ZV3FeedbackFieldCatalogQuery, ZV3FeedbackQuery } from "@/app/api/v3/feedback-queries/lib/schemas";

const datasetIdField = z
  .cuid2()
  .optional()
  .describe(
    "Feedback dataset to query. Optional when the workspace has exactly one dataset; required when it has more than one. Use list_feedback_datasets to discover ids."
  );

export const ZMcpQueryFeedbackInput = z
  .object({
    workspaceId: z.cuid2().describe("Workspace ID whose feedback dataset should be queried."),
    datasetId: datasetIdField,
    query: ZV3FeedbackQuery.describe(
      "The feedback query: measures, dimensions, timeDimensions, filters, order and limit, written over the fields get_feedback_field_catalog lists. Read-only; the tenant is applied by the server and cannot be set here."
    ),
  })
  .strict();

export const ZMcpGetFeedbackFieldCatalogInput = ZV3FeedbackFieldCatalogQuery.extend({
  workspaceId: z
    .cuid2()
    .describe("Workspace ID the catalog is read for. The catalog is the same for every workspace."),
}).strict();

export type TMcpQueryFeedbackInput = z.infer<typeof ZMcpQueryFeedbackInput>;
export type TMcpGetFeedbackFieldCatalogInput = z.infer<typeof ZMcpGetFeedbackFieldCatalogInput>;
