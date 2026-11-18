import type { TChartQuery } from "@formbricks/types/analysis";
import { prepareQueryForChartType } from "@/modules/ee/analysis/charts/lib/big-number";
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
