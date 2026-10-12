import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { ZChartConfig, ZChartQuery } from "@formbricks/types/analysis";
import { DATE_RANGE_PRESETS } from "@/lib/date-ranges";
import { prepareQueryForChartType } from "@/modules/ee/analysis/charts/lib/big-number";
import { buildCubeQuery, parseQueryToState } from "@/modules/ee/analysis/lib/query-builder";
import {
  FEEDBACK_DIMENSION_IDS,
  FEEDBACK_MEASURE_IDS,
  getMeasureAxisDomain,
  getResponseBaseMeasureId,
} from "@/modules/ee/analysis/lib/schema-definition";
import {
  CHART_PRESET_IDS,
  getChartPreset,
  getChartPresetCopy,
  presetToAnalyticsResponse,
} from "./chart-presets";

const emptyState = {
  selectedMeasures: [],
  selectedDimensions: [],
  filters: [],
  filterLogic: "and" as const,
  timeDimension: null,
};

describe.each(CHART_PRESET_IDS)("the %s preset", (id) => {
  const preset = getChartPreset(id);

  test("is a valid chart query and config", () => {
    expect(ZChartQuery.parse(preset.query)).toEqual(preset.query);
    expect(ZChartConfig.parse(preset.config)).toEqual(preset.config);
  });

  test("only references members the chart builder offers", () => {
    const members = [
      ...(preset.query.measures ?? []),
      ...(preset.query.dimensions ?? []),
      ...(preset.query.timeDimensions ?? []).map((td) => td.dimension),
      ...(preset.query.filters ?? []).flatMap((filter) => ("member" in filter ? [filter.member] : [])),
    ];
    for (const member of members) {
      expect([...FEEDBACK_MEASURE_IDS, ...FEEDBACK_DIMENSION_IDS]).toContain(member);
    }
    for (const td of preset.query.timeDimensions ?? []) {
      expect(DATE_RANGE_PRESETS).toContain(td.dateRange);
    }
  });

  // The builder edits a preset through its form state. A query that did not survive the round trip
  // would drift on open and be re-run, or lose a filter, the moment the user touched it.
  test("round-trips through the builder's form state unchanged", () => {
    expect(buildCubeQuery({ ...emptyState, ...parseQueryToState(preset.query) })).toEqual(preset.query);
    expect(prepareQueryForChartType(preset.query, preset.chartType)).toBe(preset.query);
  });

  test("has a response base, so its chart always says how many answers it rests on", () => {
    expect(getResponseBaseMeasureId(preset.query.measures ?? [])).toBeDefined();
  });
});

describe("chart presets", () => {
  test("over-time presets chart a score on its fixed range, weekly over the last 90 days", () => {
    for (const id of ["nps_over_time", "csat_over_time"] as const) {
      const { query, chartType, config } = getChartPreset(id);
      expect(chartType).toBe("area");
      expect(config).toEqual({ areaDisplay: "line" });
      expect(getMeasureAxisDomain(query.measures?.[0] ?? "")).toBeDefined();
      expect(query.timeDimensions).toEqual([
        { dimension: "FeedbackRecords.collectedAt", granularity: "week", dateRange: "last 90 days" },
      ]);
    }
  });

  test("breakdown presets group by value band and count the base itself", () => {
    expect(getChartPreset("nps_breakdown").query).toMatchObject({
      measures: ["FeedbackRecords.npsCount"],
      dimensions: ["FeedbackRecords.valueBand"],
      filters: [{ member: "FeedbackRecords.fieldType", operator: "equals", values: ["nps"] }],
    });
    expect(getResponseBaseMeasureId(["FeedbackRecords.npsCount"])).toBe("FeedbackRecords.npsCount");
    expect(getChartPreset("csat_breakdown").query).toMatchObject({
      measures: ["FeedbackRecords.csatCount"],
      dimensions: ["FeedbackRecords.valueBand"],
      filters: [{ member: "FeedbackRecords.fieldType", operator: "equals", values: ["csat"] }],
    });
  });

  test("hands the builder a query with no rows, so the builder runs it", () => {
    expect(presetToAnalyticsResponse("nps_breakdown", "NPS breakdown")).toEqual({
      query: getChartPreset("nps_breakdown").query,
      chartType: "pie",
      config: { pieDisplay: "pie" },
      suggestedName: "NPS breakdown",
    });
  });
});

describe("getChartPresetCopy", () => {
  test("gives every preset a name and a description key", () => {
    const copy = getChartPresetCopy(((key: string) => key) as TFunction);
    for (const id of CHART_PRESET_IDS) {
      expect(copy[id]).toEqual({
        name: `workspace.analysis.charts.preset_${id}_name`,
        description: `workspace.analysis.charts.preset_${id}_description`,
      });
    }
  });
});
