import type { TChartQuery } from "@formbricks/types/analysis";
import { getResponseBaseMeasureId } from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";

// Moved to `lib/` so the Cube client does not depend on chart code; re-exported for the chart callers.
export { withResponseBaseMeasure } from "@/modules/ee/analysis/lib/response-base-measure";

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
