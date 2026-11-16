import type { TChartQuery } from "@formbricks/types/analysis";
import {
  getResponseBaseMeasureId,
  isResponseTopicDimensionId,
} from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";

/**
 * The query with its response base count added, so one Cube round trip returns both the chart's
 * measures and how many answers they rest on. Returns the same query when the chart has no single
 * base (see getResponseBaseMeasureId) or already selects it.
 *
 * Also when it groups by a response-topic field (ENG-6989): a response that mentions two topics lands in
 * both rows, so the base summed over the rows (`computeResponseBase`) would count it twice. Without the
 * column, the "Based on N answers" line is not shown.
 */
export const withResponseBaseMeasure = (query: TChartQuery): TChartQuery => {
  const measures = query.measures ?? [];
  const base = getResponseBaseMeasureId(measures);
  if (!base || measures.includes(base)) return query;
  if ((query.dimensions ?? []).some(isResponseTopicDimensionId)) return query;
  return { ...query, measures: [...measures, base] };
};

/**
 * Total answers behind a chart: the base count summed over its rows. Every record lands in exactly
 * one row — the dimensions are single-valued and time buckets are disjoint — so the sum is the
 * total. Null when no row carries a count, which hides the footer rather than claiming zero.
 */
export const computeResponseBase = (rows: readonly TChartDataRow[], key: string): number | null => {
  let total: number | null = null;
  for (const row of rows) {
    const value = row[key];
    if (typeof value !== "number" && typeof value !== "string") continue;
    if (typeof value === "string" && value.trim() === "") continue;
    const count = Number(value);
    if (!Number.isFinite(count)) continue;
    total = (total ?? 0) + count;
  }
  return total;
};

/** True for the base column the server added on its own — data, not something the user selected. */
export const isInjectedResponseBaseColumn = (key: string, query: TChartQuery): boolean => {
  const measures = query.measures ?? [];
  return key === getResponseBaseMeasureId(measures) && !measures.includes(key);
};
