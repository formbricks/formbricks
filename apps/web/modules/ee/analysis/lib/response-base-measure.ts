import type { TChartQuery } from "@formbricks/types/analysis";
import { getResponseBaseMeasureId } from "@/modules/ee/analysis/lib/schema-definition";

/**
 * The query with its response base count added, so one Cube round trip returns both the query's
 * measures and how many answers they rest on. Returns the same query when it has no single base (see
 * getResponseBaseMeasureId) or already selects it.
 *
 * Lives here, not next to the chart renderer that shows the "Based on N answers" footer, because the
 * Cube client applies it and must not depend on chart code.
 */
export const withResponseBaseMeasure = (query: TChartQuery): TChartQuery => {
  const measures = query.measures ?? [];
  const base = getResponseBaseMeasureId(measures);
  if (!base || measures.includes(base)) return query;
  return { ...query, measures: [...measures, base] };
};
