import type { TFunction } from "i18next";
import type { TChartConfig, TChartQuery } from "@formbricks/types/analysis";
import type { AnalyticsResponse, TChartType } from "@/modules/ee/analysis/types/analysis";

/**
 * Starting points for the metrics most people chart first. A preset only prefills the builder: the
 * saved chart is an ordinary chart, and nothing records that a preset produced it. The axis range,
 * band colors and response base are not stored here either — they follow from the members at render
 * time, so a chart built by hand from the same members looks the same.
 */
export const CHART_PRESET_IDS = [
  "nps_over_time",
  "nps_breakdown",
  "csat_over_time",
  "csat_breakdown",
] as const;

export type TChartPresetId = (typeof CHART_PRESET_IDS)[number];

export interface TChartPreset {
  id: TChartPresetId;
  chartType: TChartType;
  query: TChartQuery;
  config: TChartConfig;
}

const fieldTypeFilter = (fieldType: "nps" | "csat"): TChartQuery["filters"] => [
  { member: "FeedbackRecords.fieldType", operator: "equals", values: [fieldType] },
];

const weeklyOverLast90Days: TChartQuery["timeDimensions"] = [
  { dimension: "FeedbackRecords.collectedAt", granularity: "week", dateRange: "last 90 days" },
];

// The breakdowns count with npsCount / csatCount rather than the generic count: under the fieldType
// filter the numbers are identical, and the chart's response base then resolves to its own measure.
// The fieldType filter stays on the breakdown so a directory holding both scales never shows the
// other scale's bands.
const CHART_PRESETS: Record<TChartPresetId, TChartPreset> = {
  nps_over_time: {
    id: "nps_over_time",
    chartType: "area",
    query: {
      measures: ["FeedbackRecords.npsScore"],
      timeDimensions: weeklyOverLast90Days,
      filters: fieldTypeFilter("nps"),
    },
    config: { areaDisplay: "line" },
  },
  nps_breakdown: {
    id: "nps_breakdown",
    chartType: "pie",
    query: {
      measures: ["FeedbackRecords.npsCount"],
      dimensions: ["FeedbackRecords.valueBand"],
      filters: fieldTypeFilter("nps"),
    },
    config: { pieDisplay: "pie" },
  },
  csat_over_time: {
    id: "csat_over_time",
    chartType: "area",
    query: {
      measures: ["FeedbackRecords.csatScore"],
      timeDimensions: weeklyOverLast90Days,
      filters: fieldTypeFilter("csat"),
    },
    config: { areaDisplay: "line" },
  },
  csat_breakdown: {
    id: "csat_breakdown",
    chartType: "pie",
    query: {
      measures: ["FeedbackRecords.csatCount"],
      dimensions: ["FeedbackRecords.valueBand"],
      filters: fieldTypeFilter("csat"),
    },
    config: { pieDisplay: "pie" },
  },
};

export const getChartPreset = (id: TChartPresetId): TChartPreset => CHART_PRESETS[id];

/** The preset as the builder's hand-off shape: no rows yet, so the builder runs it on open. */
export const presetToAnalyticsResponse = (id: TChartPresetId, suggestedName: string): AnalyticsResponse => {
  const { query, chartType, config } = getChartPreset(id);
  return { query, chartType, config, suggestedName };
};

/** Each preset's card copy. Literal t() keys, so the i18n scanner can see them. */
export const getChartPresetCopy = (
  t: TFunction
): Record<TChartPresetId, { name: string; description: string }> => ({
  nps_over_time: {
    name: t("workspace.analysis.charts.preset_nps_over_time_name"),
    description: t("workspace.analysis.charts.preset_nps_over_time_description"),
  },
  nps_breakdown: {
    name: t("workspace.analysis.charts.preset_nps_breakdown_name"),
    description: t("workspace.analysis.charts.preset_nps_breakdown_description"),
  },
  csat_over_time: {
    name: t("workspace.analysis.charts.preset_csat_over_time_name"),
    description: t("workspace.analysis.charts.preset_csat_over_time_description"),
  },
  csat_breakdown: {
    name: t("workspace.analysis.charts.preset_csat_breakdown_name"),
    description: t("workspace.analysis.charts.preset_csat_breakdown_description"),
  },
});
