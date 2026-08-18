import type { TFunction } from "i18next";
import {
  ActivityIcon,
  AreaChartIcon,
  BarChart3Icon,
  LineChartIcon,
  PieChartIcon,
  SmileIcon,
} from "lucide-react";
import type React from "react";
import type { TChartQuery } from "@formbricks/types/analysis";
import {
  SENTIMENT_DIMENSION_ID,
  getSentimentValueForMeasureId,
} from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";

export const DEFAULT_CHART_TYPE: TChartType = "area";

const RESPONSE_COUNT_MEASURE_ID = "FeedbackRecords.count";

export const CHART_TYPE_ICONS: Record<
  TChartType,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  area: AreaChartIcon,
  bar: BarChart3Icon,
  line: LineChartIcon,
  pie: PieChartIcon,
  big_number: ActivityIcon,
  sentiment: SmileIcon,
};

export function getChartTypes(t: TFunction): readonly {
  id: TChartType;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
}[] {
  return [
    { id: "area", icon: CHART_TYPE_ICONS.area, label: t("workspace.analysis.charts.chart_type_area") },
    { id: "bar", icon: CHART_TYPE_ICONS.bar, label: t("workspace.analysis.charts.chart_type_bar") },
    { id: "line", icon: CHART_TYPE_ICONS.line, label: t("workspace.analysis.charts.chart_type_line") },
    { id: "pie", icon: CHART_TYPE_ICONS.pie, label: t("workspace.analysis.charts.chart_type_pie") },
    {
      id: "big_number",
      icon: CHART_TYPE_ICONS.big_number,
      label: t("workspace.analysis.charts.chart_type_big_number"),
    },
    {
      id: "sentiment",
      icon: CHART_TYPE_ICONS.sentiment,
      label: t("workspace.analysis.charts.chart_type_sentiment"),
    },
  ];
}

/** A query already reads sentiment when it groups by the sentiment dimension or measures the
 * per-sentiment counts — either way the sentiment chart has something to split its bar by. */
const isSentimentQuery = (query: TChartQuery): boolean =>
  (query.dimensions?.includes(SENTIMENT_DIMENSION_ID) ?? false) ||
  (query.measures?.some((measure) => getSentimentValueForMeasureId(measure) !== undefined) ?? false);

/**
 * Query a chart type needs to be meaningful, for the types that describe a dataset rather than a
 * shape. "Sentiment" is the first of those: picking it pre-populates the builder with response
 * count grouped by the sentiment dimension so the chart renders sentiment data out of the box
 * (ENG-1558). Shape-only types (bar, line, …) return undefined and keep whatever the user built,
 * and so does a config that already reads sentiment — switching type must not throw away a
 * sentiment query the user (or a saved chart) already had.
 *
 * A fresh object every call on purpose — the builder re-initialises on `initialQuery` identity, so
 * re-picking the same type after editing the config restores the prefill.
 */
export const getChartTypePrefillQuery = (
  type: TChartType,
  currentQuery?: TChartQuery
): TChartQuery | undefined => {
  if (type !== "sentiment") return undefined;
  if (currentQuery && isSentimentQuery(currentQuery)) return undefined;
  return { measures: [RESPONSE_COUNT_MEASURE_ID], dimensions: [SENTIMENT_DIMENSION_ID] };
};
