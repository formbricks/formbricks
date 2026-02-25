"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TChartQuery } from "@formbricks/types/analysis";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { executeQueryAction } from "@/modules/ee/analysis/charts/actions";
import { AddToDashboardDialog } from "@/modules/ee/analysis/charts/components/add-to-dashboard-dialog";
import { AdvancedChartPreview } from "@/modules/ee/analysis/charts/components/advanced-chart-preview";
import { ChartBuilderGuide } from "@/modules/ee/analysis/charts/components/chart-builder-guide";
import { ChartTypeSelector } from "@/modules/ee/analysis/charts/components/chart-type-selector";
import { DimensionsPanel } from "@/modules/ee/analysis/charts/components/dimensions-panel";
import { FiltersPanel } from "@/modules/ee/analysis/charts/components/filters-panel";
import { MeasuresPanel } from "@/modules/ee/analysis/charts/components/measures-panel";
import { SaveChartDialog } from "@/modules/ee/analysis/charts/components/save-chart-dialog";
import { TimeDimensionPanel } from "@/modules/ee/analysis/charts/components/time-dimension-panel";
import { useSaveDashboardDialogs } from "@/modules/ee/analysis/charts/hooks/use-save-dashboard-dialogs";
import {
  ChartBuilderState,
  type CustomMeasure,
  type FilterRow,
  type TimeDimensionConfig,
  buildCubeQuery,
  parseQueryToState,
} from "@/modules/ee/analysis/lib/query-builder";
import { FEEDBACK_FIELDS } from "@/modules/ee/analysis/lib/schema-definition";
import type { AnalyticsResponse, TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Button } from "@/modules/ui/components/button";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";

const DEBOUNCE_MS = 300;

interface AdvancedChartBuilderProps {
  environmentId: string;
  initialChartType?: TChartType;
  initialQuery?: TChartQuery;
  hidePreview?: boolean;
  /** Must be stable (memoized) to avoid effect re-runs on every parent render */
  onChartGenerated?: (data: AnalyticsResponse) => void;
  onSave?: (chartId: string) => void;
  onAddToDashboard?: (chartId: string, dashboardId: string) => void;
}

type Action =
  | { type: "SET_CHART_TYPE"; payload: TChartType }
  | { type: "SET_MEASURES"; payload: string[] }
  | { type: "SET_CUSTOM_MEASURES"; payload: CustomMeasure[] }
  | { type: "SET_DIMENSIONS"; payload: string[] }
  | { type: "SET_FILTERS"; payload: FilterRow[] }
  | { type: "SET_FILTER_LOGIC"; payload: "and" | "or" }
  | { type: "SET_TIME_DIMENSION"; payload: TimeDimensionConfig | null }
  | { type: "QUERY_START" }
  | { type: "QUERY_SUCCESS"; payload: { data: TChartDataRow[]; query: TChartQuery } }
  | { type: "QUERY_ERROR"; payload: string };

interface QueryState {
  chartData: TChartDataRow[] | null;
  query: TChartQuery | null;
  isLoading: boolean;
  error: string | null;
}

const initialQueryState: QueryState = {
  chartData: null,
  query: null,
  isLoading: false,
  error: null,
};

const initialState: ChartBuilderState = {
  chartType: "",
  selectedMeasures: [],
  customMeasures: [],
  selectedDimensions: [],
  filters: [],
  filterLogic: "and",
  timeDimension: null,
};

const chartBuilderReducer = (state: ChartBuilderState, action: Action): ChartBuilderState => {
  switch (action.type) {
    case "SET_CHART_TYPE":
      return { ...state, chartType: action.payload };
    case "SET_MEASURES":
      return { ...state, selectedMeasures: action.payload };
    case "SET_CUSTOM_MEASURES":
      return { ...state, customMeasures: action.payload };
    case "SET_DIMENSIONS":
      return { ...state, selectedDimensions: action.payload };
    case "SET_FILTERS":
      return { ...state, filters: action.payload };
    case "SET_FILTER_LOGIC":
      return { ...state, filterLogic: action.payload };
    case "SET_TIME_DIMENSION":
      return { ...state, timeDimension: action.payload };
    default:
      return state;
  }
};

const queryReducer = (state: QueryState, action: Action): QueryState => {
  switch (action.type) {
    case "QUERY_START":
      return { ...state, isLoading: true, error: null };
    case "QUERY_SUCCESS":
      return {
        chartData: action.payload.data,
        query: action.payload.query,
        isLoading: false,
        error: null,
      };
    case "QUERY_ERROR":
      return { ...state, isLoading: false, error: action.payload };
    default:
      return state;
  }
};

export function AdvancedChartBuilder({
  environmentId,
  initialChartType,
  initialQuery,
  hidePreview = false,
  onChartGenerated,
  onSave,
  onAddToDashboard,
}: Readonly<AdvancedChartBuilderProps>) {
  const { t } = useTranslation();
  const onChartGeneratedRef = useRef(onChartGenerated);
  onChartGeneratedRef.current = onChartGenerated;
  const prevInitialChartTypeRef = useRef(initialChartType);

  const getInitialState = useCallback((): ChartBuilderState => {
    if (initialQuery) {
      const parsedState = parseQueryToState(initialQuery, initialChartType);
      return {
        ...initialState,
        ...parsedState,
        chartType: parsedState.chartType || initialChartType || "",
      };
    }
    return { ...initialState, chartType: initialChartType || "" };
  }, [initialQuery, initialChartType]);

  const [state, dispatch] = useReducer(chartBuilderReducer, getInitialState());
  const [queryState, dispatchQuery] = useReducer(queryReducer, {
    ...initialQueryState,
    query: initialQuery || null,
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [showQuery, setShowQuery] = useState(false);
  const [showData, setShowData] = useState(false);
  const [dimensionsOpen, setDimensionsOpen] = useState(false);
  const [timeDimensionOpen, setTimeDimensionOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [customAggregationsOpen, setCustomAggregationsOpen] = useState(false);
  const lastStateRef = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const saveDashboard = useSaveDashboardDialogs({
    environmentId,
    getChartInput: () => {
      if (!queryState.chartData || !queryState.query || !state.chartType) return null;
      return { query: queryState.query, chartType: state.chartType };
    },
    onSave,
    onAddToDashboard,
  });

  // Sync initialChartType only when the prop changes (not when state diverges)
  useEffect(() => {
    if (initialChartType && initialChartType !== prevInitialChartTypeRef.current) {
      prevInitialChartTypeRef.current = initialChartType;
      dispatch({ type: "SET_CHART_TYPE", payload: initialChartType });
      if (!initialQuery && !isInitialized) {
        setIsInitialized(true);
      }
    }
  }, [initialChartType, initialQuery, isInitialized]);

  // Sync section open states when loading from initialQuery
  useEffect(() => {
    if (!initialQuery) return;
    const parsed = parseQueryToState(initialQuery, initialChartType);
    setDimensionsOpen((parsed.selectedDimensions?.length ?? 0) > 0);
    setTimeDimensionOpen(parsed.timeDimension != null);
    setFiltersOpen((parsed.filters?.length ?? 0) > 0);
    // Only set customAggregationsOpen to true when parsed has custom measures.
    // Never set to false here: parseQueryToState always returns customMeasures: [] because
    // Cube.js query format doesn't store custom measure definitions, so we'd incorrectly
    // turn off the toggle after running a query that uses custom measures.
    if ((parsed.customMeasures?.length ?? 0) > 0) {
      setCustomAggregationsOpen(true);
    }
  }, [initialQuery, initialChartType]);

  // Keep time dimension toggle in sync when panel's disable clears the config
  useEffect(() => {
    if (state.timeDimension == null) setTimeDimensionOpen(false);
  }, [state.timeDimension]);

  // Turn off filter toggle when the last filter is deleted
  useEffect(() => {
    if (state.filters.length === 0 && filtersOpen) setFiltersOpen(false);
  }, [state.filters.length, filtersOpen]);

  // Turn off custom aggregations toggle when the last custom measure is removed
  useEffect(() => {
    if (state.customMeasures.length === 0 && customAggregationsOpen) setCustomAggregationsOpen(false);
  }, [state.customMeasures.length, customAggregationsOpen]);

  // Initialize: execute initialQuery once (deps intentionally minimal to avoid redundant runs).
  // Skip when hidePreview is true because the parent component handles data loading.
  useEffect(() => {
    if (!initialQuery || isInitialized) return;
    setIsInitialized(true);

    if (hidePreview) {
      // Sync lastStateRef so the reactive effect does not re-run the same query on mount.
      lastStateRef.current = JSON.stringify({
        chartType: state.chartType,
        measures: state.selectedMeasures,
        dimensions: state.selectedDimensions,
        filters: state.filters,
        timeDimension: state.timeDimension,
      });
      return;
    }

    const chartType = state.chartType;
    const requestId = ++requestIdRef.current;

    executeQueryAction({ environmentId, query: initialQuery })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        if (result?.serverError) {
          dispatchQuery({ type: "QUERY_ERROR", payload: getFormattedErrorMessage(result) });
          return;
        }
        const data = Array.isArray(result?.data) ? result.data : [];
        if (data.length > 0) {
          dispatchQuery({ type: "QUERY_SUCCESS", payload: { data, query: initialQuery } });
          lastStateRef.current = JSON.stringify({
            chartType,
            measures: state.selectedMeasures,
            dimensions: state.selectedDimensions,
            filters: state.filters,
            timeDimension: state.timeDimension,
          });
          if (onChartGeneratedRef.current && chartType) {
            onChartGeneratedRef.current({ query: initialQuery, chartType, data });
          }
        }
      })
      .catch((err: unknown) => {
        if (requestId !== requestIdRef.current) return;
        const message =
          err instanceof Error ? err.message : t("environments.analysis.charts.failed_to_execute_query");
        dispatchQuery({ type: "QUERY_ERROR", payload: message });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init runs once; state/onChartGenerated via ref
  }, [initialQuery, environmentId, isInitialized]);

  // Reactive query with debounce and cancellation
  useEffect(() => {
    if (!isInitialized || !state.chartType) return;
    if (state.selectedMeasures.length === 0 && state.customMeasures.length === 0) return;

    const stateHash = JSON.stringify({
      chartType: state.chartType,
      measures: state.selectedMeasures,
      dimensions: state.selectedDimensions,
      filters: state.filters,
      timeDimension: state.timeDimension,
    });
    if (stateHash === lastStateRef.current) return;
    lastStateRef.current = stateHash;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const chartType = state.chartType;
      const updatedQuery = buildCubeQuery(state);
      const requestId = ++requestIdRef.current;
      dispatchQuery({ type: "QUERY_START" });

      executeQueryAction({ environmentId, query: updatedQuery })
        .then((result) => {
          if (requestId !== requestIdRef.current) return;
          if (result?.serverError) {
            dispatchQuery({ type: "QUERY_ERROR", payload: getFormattedErrorMessage(result) });
            return;
          }
          const data = Array.isArray(result?.data) ? result.data : [];
          if (data.length > 0) {
            dispatchQuery({ type: "QUERY_SUCCESS", payload: { data, query: updatedQuery } });
            if (onChartGeneratedRef.current && chartType) {
              onChartGeneratedRef.current({ query: updatedQuery, chartType, data });
            }
          } else {
            dispatchQuery({
              type: "QUERY_ERROR",
              payload: t("environments.analysis.charts.no_data_returned"),
            });
          }
        })
        .catch((err: unknown) => {
          if (requestId !== requestIdRef.current) return;
          const message =
            err instanceof Error ? err.message : t("environments.analysis.charts.failed_to_execute_query");
          dispatchQuery({ type: "QUERY_ERROR", payload: message });
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounced; onChartGenerated via ref
  }, [
    state.chartType,
    state.selectedMeasures,
    state.selectedDimensions,
    state.filters,
    state.filterLogic,
    state.customMeasures,
    state.timeDimension,
    isInitialized,
    environmentId,
  ]);

  const processQueryResult = useCallback(
    (
      result: Awaited<ReturnType<typeof executeQueryAction>>,
      cubeQuery: TChartQuery,
      chartType: TChartType,
      requestId: number
    ) => {
      if (requestId !== requestIdRef.current) return;
      if (result?.serverError) {
        const errorMsg = getFormattedErrorMessage(result);
        dispatchQuery({ type: "QUERY_ERROR", payload: errorMsg });
        toast.error(errorMsg);
        return;
      }
      const data = Array.isArray(result?.data) ? result.data : [];
      if (data.length === 0) {
        dispatchQuery({
          type: "QUERY_ERROR",
          payload: t("environments.analysis.charts.no_data_returned"),
        });
        toast.error(t("environments.analysis.charts.no_data_returned"));
        return;
      }
      dispatchQuery({ type: "QUERY_SUCCESS", payload: { data, query: cubeQuery } });
      toast.success(t("environments.analysis.charts.query_executed_successfully"));
      if (onChartGeneratedRef.current && chartType) {
        onChartGeneratedRef.current({ query: cubeQuery, chartType, data });
      }
    },
    [t]
  );

  const handleRunQuery = async () => {
    if (!state.chartType) {
      toast.error(t("environments.analysis.charts.please_select_chart_type"));
      return;
    }
    if (state.selectedMeasures.length === 0 && state.customMeasures.length === 0) {
      toast.error(t("environments.analysis.charts.please_select_at_least_one_measure"));
      return;
    }

    dispatchQuery({ type: "QUERY_START" });
    const cubeQuery = buildCubeQuery(state);
    const chartType = state.chartType;
    const requestId = ++requestIdRef.current;

    try {
      const result = await executeQueryAction({ environmentId, query: cubeQuery });
      processQueryResult(result, cubeQuery, chartType, requestId);
    } catch (err: unknown) {
      if (requestId !== requestIdRef.current) return;
      const message =
        err instanceof Error ? err.message : t("environments.analysis.charts.failed_to_execute_query");
      dispatchQuery({ type: "QUERY_ERROR", payload: message });
      toast.error(message);
    }
  };

  const { chartData, query, isLoading, error } = queryState;
  const showSaveDashboard = !onSave || !onAddToDashboard;

  return (
    <div className={hidePreview ? "space-y-2" : "grid gap-4 lg:grid-cols-2"}>
      <div className="mx-1 space-y-2">
        {!hidePreview && (
          <>
            <ChartBuilderGuide />
            <ChartTypeSelector
              selectedChartType={state.chartType}
              onChartTypeSelect={(chartType) => dispatch({ type: "SET_CHART_TYPE", payload: chartType })}
            />
          </>
        )}

        <div className="mt-4 flex w-full flex-col gap-3 overflow-hidden rounded-lg border bg-slate-50 p-4">
          <MeasuresPanel
            selectedMeasures={state.selectedMeasures}
            customMeasures={state.customMeasures}
            customAggregationsOpen={customAggregationsOpen}
            onCustomAggregationsOpenChange={(open) => {
              setCustomAggregationsOpen(open);
              if (!open) {
                dispatch({ type: "SET_CUSTOM_MEASURES", payload: [] });
              } else if (state.customMeasures.length === 0) {
                const dimensionOptions = FEEDBACK_FIELDS.dimensions
                  .filter((d) => d.type === "number")
                  .map((d) => d.id);
                dispatch({
                  type: "SET_CUSTOM_MEASURES",
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
            onMeasuresChange={(measures) => dispatch({ type: "SET_MEASURES", payload: measures })}
            onCustomMeasuresChange={(measures) =>
              dispatch({ type: "SET_CUSTOM_MEASURES", payload: measures })
            }
          />
        </div>

        <AdvancedOptionToggle
          isChecked={dimensionsOpen}
          onToggle={(checked) => {
            setDimensionsOpen(checked);
            if (!checked) dispatch({ type: "SET_DIMENSIONS", payload: [] });
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
            onDimensionsChange={(dimensions) => dispatch({ type: "SET_DIMENSIONS", payload: dimensions })}
          />
        </AdvancedOptionToggle>

        <AdvancedOptionToggle
          isChecked={timeDimensionOpen}
          onToggle={(checked) => {
            setTimeDimensionOpen(checked);
            if (!checked) dispatch({ type: "SET_TIME_DIMENSION", payload: null });
            else if (!state.timeDimension) {
              dispatch({
                type: "SET_TIME_DIMENSION",
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
            onTimeDimensionChange={(config) => dispatch({ type: "SET_TIME_DIMENSION", payload: config })}
          />
        </AdvancedOptionToggle>

        <AdvancedOptionToggle
          isChecked={filtersOpen}
          onToggle={(checked) => {
            setFiltersOpen(checked);
            if (!checked) {
              dispatch({ type: "SET_FILTERS", payload: [] });
            } else if (state.filters.length === 0) {
              const firstField = FEEDBACK_FIELDS.dimensions[0] ?? FEEDBACK_FIELDS.measures[0];
              dispatch({
                type: "SET_FILTERS",
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
            onFiltersChange={(filters) => dispatch({ type: "SET_FILTERS", payload: filters })}
            onFilterLogicChange={(logic) => dispatch({ type: "SET_FILTER_LOGIC", payload: logic })}
          />
        </AdvancedOptionToggle>

        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={handleRunQuery} disabled={isLoading || !state.chartType}>
            {isLoading ? <LoadingSpinner /> : t("environments.analysis.charts.run_query")}
          </Button>
          {chartData && showSaveDashboard && (
            <>
              <Button variant="outline" onClick={() => saveDashboard.setIsSaveDialogOpen(true)}>
                {t("environments.analysis.charts.save_chart")}
              </Button>
              <Button variant="outline" onClick={() => saveDashboard.setIsAddToDashboardDialogOpen(true)}>
                {t("environments.analysis.charts.add_to_dashboard")}
              </Button>
            </>
          )}
        </div>
      </div>

      {!hidePreview && (
        <AdvancedChartPreview
          error={error}
          isLoading={isLoading}
          chartData={chartData}
          chartType={state.chartType}
          query={query}
          showQuery={showQuery}
          onShowQueryChange={setShowQuery}
          showData={showData}
          onShowDataChange={setShowData}
        />
      )}

      {!onSave && (
        <SaveChartDialog
          open={saveDashboard.isSaveDialogOpen}
          onOpenChange={saveDashboard.setIsSaveDialogOpen}
          chartName={saveDashboard.chartName}
          onChartNameChange={saveDashboard.setChartName}
          onSave={saveDashboard.handleSaveChart}
          isSaving={saveDashboard.isSaving}
        />
      )}
      {!onAddToDashboard && (
        <AddToDashboardDialog
          isOpen={saveDashboard.isAddToDashboardDialogOpen}
          onOpenChange={saveDashboard.setIsAddToDashboardDialogOpen}
          chartName={saveDashboard.chartName}
          onChartNameChange={saveDashboard.setChartName}
          dashboards={saveDashboard.dashboards}
          selectedDashboardId={saveDashboard.selectedDashboardId}
          onDashboardSelect={saveDashboard.setSelectedDashboardId}
          onConfirm={saveDashboard.handleAddToDashboard}
          isSaving={saveDashboard.isSaving}
        />
      )}
    </div>
  );
}
