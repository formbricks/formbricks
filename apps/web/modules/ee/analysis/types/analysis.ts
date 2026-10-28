import { z } from "zod";
import { type TChartConfig, TWidgetLayout, ZChartConfig, ZChartQuery } from "@formbricks/types/analysis";
import { ZId } from "@formbricks/types/common";

export const CHART_TYPE_IDS = ["area", "bar", "pie", "big_number", "matrix"] as const;
export const ZChartType = z.enum(CHART_TYPE_IDS);
export type TChartType = z.infer<typeof ZChartType>;

// ── Chart as the app renders it ──────────────────────────────────────────────

export const ZChart = z.object({
  id: ZId,
  name: z.string(),
  type: ZChartType,
  query: ZChartQuery,
  config: ZChartConfig,
  feedbackDirectoryId: ZId,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type TChart = z.infer<typeof ZChart>;

export const ZChartWithCreator = ZChart.extend({
  creator: z
    .object({
      name: z.string().nullable(),
    })
    .nullable(),
});
export type TChartWithCreator = z.infer<typeof ZChartWithCreator>;

// ── Widget as the app renders it ─────────────────────────────────────────────

export type TDashboardWidget = {
  id: string;
  dashboardId: string;
  chartId: string;
  layout: TWidgetLayout;
  order: number;
  chart: TChart;
};

// ── Charts UI (query execution, AI response) ─────────────────────────────────

/** Row from Cube.js tablePivot - keys are measure/dimension names, values are primitives */
export type TChartDataRow = Record<string, string | number | null | boolean | undefined>;

/** Label maps the server attaches so a renderer can show survey text instead of stored ids. */
export interface TChartLabelMaps {
  /**
   * Mapping from value_id (choice UUID) to the choice's default-language label. Present when the
   * query groups by `FeedbackRecords.valueId` (i.e., the server rewrote a valueText grouping for a
   * single-select question). Renderers use this to display human-readable labels instead of raw ids.
   * Keys are in survey order, which the matrix chart uses as its column order.
   */
  optionLabels?: Record<string, string>;
  /**
   * Mapping from a matrix row's field_id (`<elementId>__<rowId>`) to its default-language statement,
   * in survey order. Present when the query groups by `FeedbackRecords.fieldId` and matrix questions
   * are behind the rows; the matrix chart uses it for row labels and row order.
   */
  fieldLabels?: Record<string, string>;
}

export interface AnalyticsResponse extends TChartLabelMaps {
  query: z.infer<typeof ZChartQuery>;
  chartType: TChartType;
  data?: TChartDataRow[];
  error?: string;
  suggestedName?: string;
  /** Display settings to start from, e.g. a preset's line style. */
  config?: TChartConfig;
}
