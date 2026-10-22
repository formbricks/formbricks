import { z } from "zod";
import { V3_LIST_DEFAULT_LIMIT, V3_LIST_MAX_LIMIT } from "@/app/api/v3/lib/cursor-pagination";
import { ZChartType } from "@/modules/ee/analysis/types/analysis";

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

/** Longest name a chart or a dashboard may have, and so the longest search term worth sending. */
export const V3_NAME_MAX_LENGTH = 255;

/**
 * `GET /api/v3/charts`. Filters use v3's `filter[field][operator]` spelling, as on every other v3
 * collection, so a client builds them the same way everywhere.
 */
export const ZV3ChartListQuery = z
  .object({
    workspaceId: z.cuid2(),
    limit: z.coerce.number().int().min(1).max(V3_LIST_MAX_LIMIT).default(V3_LIST_DEFAULT_LIMIT),
    cursor: z.string().min(1).optional(),
    "filter[name][contains]": z.string().trim().min(1).max(V3_NAME_MAX_LENGTH).optional(),
    "filter[datasetId][eq]": z.cuid2().optional(),
  })
  .strict();
export type TV3ChartListQuery = z.infer<typeof ZV3ChartListQuery>;

export const ZV3ChartIdParams = z.object({ chartId: z.cuid2() }).strict();

/**
 * A chart query as a request carries it. Only "is an object" is checked here: everything about its
 * content is the chart query validator's, which answers 422 naming each problem rather than a 400.
 */
export const ZV3ChartQueryInput = z.record(z.string(), z.unknown());

/** `POST /api/v3/charts/preview`. `dateRange` is checked by the operation, like the query, so it is 422. */
export const ZV3ChartPreviewBody = z
  .object({
    ...datasetScope,
    type: ZChartType,
    query: ZV3ChartQueryInput,
    dateRange: z.unknown().optional(),
  })
  .strict();
export type TV3ChartPreviewBody = z.infer<typeof ZV3ChartPreviewBody>;
