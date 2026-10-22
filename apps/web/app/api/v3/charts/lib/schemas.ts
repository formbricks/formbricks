import { z } from "zod";

/**
 * Request schemas for the chart operations. Every object is strict, so an argument the operation does
 * not take is a 400 naming it rather than something silently ignored.
 */

/**
 * The workspace a request acts in and the Feedback Dataset it reads. A dataset is shared by every
 * workspace it is assigned to, and access to it is granted per assignment, so a dataset is only ever
 * authorized together with the workspace it is used from.
 */
const datasetScope = {
  workspaceId: z.cuid2(),
  datasetId: z.cuid2(),
};

export const ZV3ChartFieldCatalogQuery = z.object(datasetScope).strict();
export type TV3ChartFieldCatalogQuery = z.infer<typeof ZV3ChartFieldCatalogQuery>;
