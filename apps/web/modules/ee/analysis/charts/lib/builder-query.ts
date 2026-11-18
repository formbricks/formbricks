import type { TChartQuery } from "@formbricks/types/analysis";
import { prepareQueryForChartType } from "@/modules/ee/analysis/charts/lib/big-number";
import { supportsTimeGrouping } from "@/modules/ee/analysis/charts/lib/chart-display";
import {
  type ChartBuilderState,
  buildCubeQuery,
  parseQueryToState,
} from "@/modules/ee/analysis/lib/query-builder";
import type { TChartType } from "@/modules/ee/analysis/types/analysis";

export const EMPTY_CHART_BUILDER_STATE: ChartBuilderState = {
  selectedMeasures: [],
  selectedDimensions: [],
  filters: [],
  filterLogic: "and",
  timeDimension: null,
};

/** The query a builder form runs for a chart type, serialised so two forms that run the same query compare equal. */
export const toBuilderQueryJson = (state: ChartBuilderState, chartType: TChartType): string =>
  JSON.stringify(prepareQueryForChartType(buildCubeQuery(state), chartType));

/** The same serialisation for a stored query, as the builder form would hold it; no query is the empty form. */
export const toComparableQueryJson = (query: TChartQuery | undefined, chartType: TChartType): string =>
  toBuilderQueryJson({ ...EMPTY_CHART_BUILDER_STATE, ...(query ? parseQueryToState(query) : {}) }, chartType);

/**
 * A stored query as the builder holds it once loaded: a chart type that can't group by time loses its
 * granularity on load (the builder drops it automatically), so that drop is not an edit of the user's.
 */
export const toAdoptedQueryJson = (query: TChartQuery | undefined, chartType: TChartType): string => {
  const form = { ...EMPTY_CHART_BUILDER_STATE, ...(query ? parseQueryToState(query) : {}) };
  if (!supportsTimeGrouping(chartType) && form.timeDimension?.granularity) {
    const { granularity: _granularity, ...timeDimension } = form.timeDimension;
    return toBuilderQueryJson({ ...form, timeDimension }, chartType);
  }
  return toBuilderQueryJson(form, chartType);
};
