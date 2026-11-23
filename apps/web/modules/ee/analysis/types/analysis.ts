import { z } from "zod";
import {
  type TChartConfig,
  type TDashboardImageContent,
  type TDashboardTextContent,
  TWidgetLayout,
  ZChartConfig,
  ZChartQuery,
} from "@formbricks/types/analysis";
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

type TDashboardWidgetBase = {
  id: string;
  dashboardId: string;
  /** The Dashboard page the widget sits on. */
  pageId: string;
  layout: TWidgetLayout;
  order: number;
};

/** One chart's placement on a page. */
export type TDashboardChartWidget = TDashboardWidgetBase & {
  kind: "chart";
  chartId: string;
  chart: TChart;
  content: null;
};

export type TDashboardImageWidget = TDashboardWidgetBase & {
  kind: "image";
  chartId: null;
  chart: null;
  content: TDashboardImageContent;
};

export type TDashboardTextWidget = TDashboardWidgetBase & {
  kind: "text";
  chartId: null;
  chart: null;
  content: TDashboardTextContent;
};

export type TDashboardSeparatorWidget = TDashboardWidgetBase & {
  kind: "separator";
  chartId: null;
  chart: null;
  content: null;
};

/** A Widget: a chart's placement or a layout block (image, text, separator) on one Dashboard page. */
export type TDashboardWidget =
  | TDashboardChartWidget
  | TDashboardImageWidget
  | TDashboardTextWidget
  | TDashboardSeparatorWidget;

/** A Dashboard page as the app renders it: a tab, its order, and the teams it is limited to (none = all). */
export type TDashboardPage = {
  id: string;
  name: string;
  order: number;
  teamIds: string[];
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
  /**
   * Mapping from an embedded-data member (`FeedbackRecords.ed_…`) the query names to the key's own
   * name, so a column or legend reads the key rather than the member (ENG-6893).
   */
  memberLabels?: Record<string, string>;
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
