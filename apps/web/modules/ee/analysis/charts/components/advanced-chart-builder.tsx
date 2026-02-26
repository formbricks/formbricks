"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TChartQuery } from "@formbricks/types/analysis";
import { AdvancedChartPreview } from "@/modules/ee/analysis/charts/components/advanced-chart-preview";
import { ChartBuilderGuide } from "@/modules/ee/analysis/charts/components/chart-builder-guide";
import { ChartTypeSelector } from "@/modules/ee/analysis/charts/components/chart-type-selector";
import { DimensionsPanel } from "@/modules/ee/analysis/charts/components/dimensions-panel";
import { FiltersPanel } from "@/modules/ee/analysis/charts/components/filters-panel";
import { MeasuresPanel } from "@/modules/ee/analysis/charts/components/measures-panel";
import { TimeDimensionPanel } from "@/modules/ee/analysis/charts/components/time-dimension-panel";
import { useChartQuery } from "@/modules/ee/analysis/charts/hooks/use-chart-query";
import {
  type ChartBuilderState,
  type CustomMeasure,
  type FilterRow,
  type TimeDimensionConfig,
  buildCubeQuery,
  parseQueryToState,
} from "@/modules/ee/analysis/lib/query-builder";
import { FEEDBACK_FIELDS } from "@/modules/ee/analysis/lib/schema-definition";
import type { AnalyticsResponse, TChartType } from "@/modules/ee/analysis/types/analysis";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Button } from "@/modules/ui/components/button";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";

interface AdvancedChartBuilderProps {
  environmentId: string;
  chartType: TChartType;
  initialQuery?: TChartQuery;
  hidePreview?: boolean;
  onChartGenerated?: (data: AnalyticsResponse) => void;
}

const ACTION = {
  SET_MEASURES: "SET_MEASURES",
  SET_CUSTOM_MEASURES: "SET_CUSTOM_MEASURES",
  SET_DIMENSIONS: "SET_DIMENSIONS",
  SET_FILTERS: "SET_FILTERS",
  SET_FILTER_LOGIC: "SET_FILTER_LOGIC",
  SET_TIME_DIMENSION: "SET_TIME_DIMENSION",
  INIT_FROM_QUERY: "INIT_FROM_QUERY",
} as const;

type Action =
  | { type: typeof ACTION.SET_MEASURES; payload: string[] }
  | { type: typeof ACTION.SET_CUSTOM_MEASURES; payload: CustomMeasure[] }
  | { type: typeof ACTION.SET_DIMENSIONS; payload: string[] }
  | { type: typeof ACTION.SET_FILTERS; payload: FilterRow[] }
  | { type: typeof ACTION.SET_FILTER_LOGIC; payload: "and" | "or" }
  | { type: typeof ACTION.SET_TIME_DIMENSION; payload: TimeDimensionConfig | null }
  | { type: typeof ACTION.INIT_FROM_QUERY; payload: Partial<ChartBuilderState> };

const initialState: ChartBuilderState = {
  selectedMeasures: [],
  customMeasures: [],
  selectedDimensions: [],
  filters: [],
  filterLogic: "and",
  timeDimension: null,
};

const chartBuilderReducer = (state: ChartBuilderState, action: Action): ChartBuilderState => {
  switch (action.type) {
    case ACTION.SET_MEASURES:
      return { ...state, selectedMeasures: action.payload };
    case ACTION.SET_CUSTOM_MEASURES:
      return { ...state, customMeasures: action.payload };
    case ACTION.SET_DIMENSIONS:
      return { ...state, selectedDimensions: action.payload };
    case ACTION.SET_FILTERS:
      return { ...state, filters: action.payload };
    case ACTION.SET_FILTER_LOGIC:
      return { ...state, filterLogic: action.payload };
    case ACTION.SET_TIME_DIMENSION:
      return { ...state, timeDimension: action.payload };
    case ACTION.INIT_FROM_QUERY:
      return { ...state, ...action.payload };
    default:
      return state;
  }
};

export function AdvancedChartBuilder({
  environmentId,
  chartType,
  initialQuery,
  hidePreview = false,
  onChartGenerated,
}: Readonly<AdvancedChartBuilderProps>) {
  const { t } = useTranslation();
  const parsedInitial = initialQuery ? parseQueryToState(initialQuery) : null;

  const [state, dispatch] = useReducer(
    chartBuilderReducer,
    initialQuery ? { ...initialState, ...parsedInitial } : initialState
  );

  const { chartData, query, isLoading, error, runQuery } = useChartQuery(environmentId, initialQuery);

  const appliedInitialQueryRef = useRef<TChartQuery | null>(null);
  useEffect(() => {
    if (!initialQuery) return;
    if (appliedInitialQueryRef.current === initialQuery) return;
    appliedInitialQueryRef.current = initialQuery;
    const parsed = parseQueryToState(initialQuery);
    dispatch({ type: ACTION.INIT_FROM_QUERY, payload: parsed });
    setDimensionsOpen((parsed.selectedDimensions?.length ?? 0) > 0);
  }, [initialQuery]);

  const handleRunQuery = async () => {
    if (state.selectedMeasures.length === 0) {
      toast.error(t("environments.analysis.charts.please_select_at_least_one_measure"));
      return;
    }
    const result = await runQuery(buildCubeQuery(state));
    if (result) {
      onChartGenerated?.({ ...result, chartType });
    }
  };

  const [dimensionsOpen, setDimensionsOpen] = useState(
    () => (parsedInitial?.selectedDimensions?.length ?? 0) > 0
  );
  const timeDimensionOpen = state.timeDimension != null;
  const filtersOpen = state.filters.length > 0;
  const customAggregationsOpen = state.customMeasures.length > 0;

  return (
    <div className={hidePreview ? "space-y-2" : "grid gap-4 lg:grid-cols-2"}>
      <div className="mx-1 space-y-2">
        {!hidePreview && (
          <>
            <ChartBuilderGuide />
            <ChartTypeSelector selectedChartType={chartType} onChartTypeSelect={() => {}} />
          </>
        )}

        <div className="mt-4 flex w-full flex-col gap-3 overflow-hidden rounded-lg border bg-slate-50 p-4">
          <MeasuresPanel
            selectedMeasures={state.selectedMeasures}
            customMeasures={state.customMeasures}
            customAggregationsOpen={customAggregationsOpen}
            onCustomAggregationsOpenChange={() => {
              if (customAggregationsOpen) {
                dispatch({ type: ACTION.SET_CUSTOM_MEASURES, payload: [] });
              } else if (state.customMeasures.length === 0) {
                const dimensionOptions = FEEDBACK_FIELDS.dimensions
                  .filter((d) => d.type === "number")
                  .map((d) => d.id);
                dispatch({
                  type: ACTION.SET_CUSTOM_MEASURES,
                  payload: [
                    {
                      id: `measure-${crypto.randomUUID()}`,
                      field: dimensionOptions[0] ?? "",
                      aggregation: "avg",
                    },
                  ],
                });
              }
            }}
            onMeasuresChange={(measures) => dispatch({ type: ACTION.SET_MEASURES, payload: measures })}
            onCustomMeasuresChange={(measures) =>
              dispatch({ type: ACTION.SET_CUSTOM_MEASURES, payload: measures })
            }
          />
        </div>

        <AdvancedOptionToggle
          isChecked={dimensionsOpen}
          onToggle={(checked) => {
            setDimensionsOpen(checked);
            if (!checked) dispatch({ type: ACTION.SET_DIMENSIONS, payload: [] });
          }}
          htmlId="chart-dimensions-toggle"
          title={t("environments.analysis.charts.dimensions")}
          description={t("environments.analysis.charts.dimensions_toggle_description")}
          customContainerClass="mt-2 px-0"
          childrenContainerClass="flex-col gap-3 p-4"
          childBorder>
          <DimensionsPanel
            hideTitle
            selectedDimensions={state.selectedDimensions}
            onDimensionsChange={(dimensions) =>
              dispatch({ type: ACTION.SET_DIMENSIONS, payload: dimensions })
            }
          />
        </AdvancedOptionToggle>

        <AdvancedOptionToggle
          isChecked={timeDimensionOpen}
          onToggle={() => {
            if (timeDimensionOpen) dispatch({ type: ACTION.SET_TIME_DIMENSION, payload: null });
            else if (!state.timeDimension) {
              dispatch({
                type: ACTION.SET_TIME_DIMENSION,
                payload: {
                  dimension: "FeedbackRecords.collectedAt",
                  granularity: "day",
                  dateRange: "last 30 days",
                },
              });
            }
          }}
          htmlId="chart-time-dimension-toggle"
          title={t("environments.analysis.charts.time_dimension")}
          description={t("environments.analysis.charts.time_dimension_toggle_description")}
          customContainerClass="mt-2 px-0"
          childrenContainerClass="flex-col gap-3 p-4"
          childBorder>
          <TimeDimensionPanel
            hideTitle
            timeDimension={state.timeDimension}
            onTimeDimensionChange={(config) => dispatch({ type: ACTION.SET_TIME_DIMENSION, payload: config })}
          />
        </AdvancedOptionToggle>

        <AdvancedOptionToggle
          isChecked={filtersOpen}
          onToggle={() => {
            if (filtersOpen) {
              dispatch({ type: ACTION.SET_FILTERS, payload: [] });
            } else if (state.filters.length === 0) {
              const firstField = FEEDBACK_FIELDS.dimensions[0] ?? FEEDBACK_FIELDS.measures[0];
              dispatch({
                type: ACTION.SET_FILTERS,
                payload: [
                  {
                    field: firstField?.id ?? "",
                    operator: "equals" as const,
                    values: null,
                  },
                ],
              });
            }
          }}
          htmlId="chart-filters-toggle"
          title={t("environments.analysis.charts.filters")}
          description={t("environments.analysis.charts.filters_toggle_description")}
          customContainerClass="mt-2 px-0"
          childrenContainerClass="flex-col gap-3 p-4"
          childBorder>
          <FiltersPanel
            hideTitle
            filters={state.filters}
            filterLogic={state.filterLogic}
            onFiltersChange={(filters) => dispatch({ type: ACTION.SET_FILTERS, payload: filters })}
            onFilterLogicChange={(logic) => dispatch({ type: ACTION.SET_FILTER_LOGIC, payload: logic })}
          />
        </AdvancedOptionToggle>

        <Button onClick={handleRunQuery} disabled={isLoading}>
          {isLoading ? <LoadingSpinner /> : t("environments.analysis.charts.run_query")}
        </Button>
      </div>

      {!hidePreview && (
        <AdvancedChartPreview
          error={error}
          isLoading={isLoading}
          chartData={chartData}
          chartType={chartType}
          query={query}
        />
      )}
    </div>
  );
}
