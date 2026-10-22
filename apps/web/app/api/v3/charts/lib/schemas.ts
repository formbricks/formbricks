import { z } from "zod";
import { ZChartConfig } from "@formbricks/types/analysis";
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

/** A chart's name: unique within its workspace, trimmed, never empty. */
export const ZV3ChartName = z.string().trim().min(1).max(V3_NAME_MAX_LENGTH);

/**
 * Display settings. The app's own schema, closed and with every free-text value bounded, so a caller can
 * neither store keys no renderer reads nor arbitrarily large strings. A key the app adds to its schema is
 * accepted here without an edit.
 */
export const ZV3ChartConfig = ZChartConfig.extend({
  colors: z.array(z.string().max(64)).max(50).optional(),
  xAxisLabel: z.string().max(V3_NAME_MAX_LENGTH).optional(),
  yAxisLabel: z.string().max(V3_NAME_MAX_LENGTH).optional(),
  numberFormat: z.string().max(64).optional(),
  dateFormat: z.string().max(64).optional(),
  prefix: z.string().max(32).optional(),
  suffix: z.string().max(32).optional(),
}).strict();

/** `POST /api/v3/charts`. The query is the validator's to judge (422), like a preview's. */
export const ZV3ChartCreateBody = z
  .object({
    ...datasetScope,
    name: ZV3ChartName,
    type: ZChartType,
    query: ZV3ChartQueryInput,
    config: ZV3ChartConfig.optional(),
  })
  .strict();
export type TV3ChartCreateBody = z.infer<typeof ZV3ChartCreateBody>;

/**
 * A key a chart has but an update may not change, refused by name so the caller learns why rather than
 * reading a generic "unsupported field".
 */
const fixedKey = (reason: string) =>
  z
    .unknown()
    .optional()
    .superRefine((value, ctx) => {
      if (value !== undefined)
        ctx.addIssue({ code: "custom", message: reason, params: { code: "read_only_field" } });
    });

/**
 * `PATCH /api/v3/charts/{chartId}`. `config` replaces the stored display settings whole. A chart's
 * Feedback Dataset and workspace are fixed: to chart another dataset, create a new chart.
 */
export const ZV3ChartUpdateBody = z
  .object({
    name: ZV3ChartName.optional(),
    type: ZChartType.optional(),
    query: ZV3ChartQueryInput.optional(),
    config: ZV3ChartConfig.optional(),
    datasetId: fixedKey(
      "A chart's Feedback Dataset is fixed when it is created. Create a new chart to chart another dataset."
    ),
    workspaceId: fixedKey("A chart's workspace is fixed when it is created."),
  })
  .strict()
  .refine(
    (body) =>
      body.name !== undefined ||
      body.type !== undefined ||
      body.query !== undefined ||
      body.config !== undefined,
    { message: "Send at least one of name, type, query or config." }
  );
export type TV3ChartUpdateBody = z.infer<typeof ZV3ChartUpdateBody>;

/**
 * `GET /api/v3/charts/{chartId}/data`. The date range is either `dateRange` (a preset or `all-time`) or
 * the `from`/`to` pair of ISO calendar dates; the operation checks the values (422). A `timezone` is
 * refused by name: every range is read in the organization's display time zone.
 */
export const ZV3ChartDataQuery = z
  .object({
    dateRange: z.string().min(1).max(64).optional(),
    from: z.string().min(1).max(32).optional(),
    to: z.string().min(1).max(32).optional(),
    timezone: fixedKey(
      "A time zone cannot be supplied: every date range is read in the organization's display time zone."
    ),
  })
  .strict();
export type TV3ChartDataQuery = z.infer<typeof ZV3ChartDataQuery>;

/** `GET /api/v3/charts/fields/{field}/values`. */
export const ZV3ChartFieldValuesParams = z.object({ field: z.string().min(1).max(128) }).strict();

export const ZV3ChartFieldValuesQuery = z
  .object({
    ...datasetScope,
    search: z.string().trim().min(1).max(V3_NAME_MAX_LENGTH).optional(),
  })
  .strict();
export type TV3ChartFieldValuesQuery = z.infer<typeof ZV3ChartFieldValuesQuery>;
