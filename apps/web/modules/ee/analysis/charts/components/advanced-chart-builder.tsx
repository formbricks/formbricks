"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TChartQuery } from "@formbricks/types/analysis";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { executeQueryAction } from "@/modules/ee/analysis/charts/actions";
import { AddToDashboardDialog } from "@/modules/ee/analysis/charts/components/add-to-dashboard-dialog";
import { AdvancedChartPreview } from "@/modules/ee/analysis/charts/components/advanced-chart-preview";
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
import type { AnalyticsResponse, TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";
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

  // Initialize: execute initialQuery once (deps intentionally minimal to avoid redundant runs).
  // Skip when hidePreview is true because the parent component handles data loading.
  useEffect(() => {
    if (!initialQuery || isInitialized) return;
    setIsInitialized(true);

    if (hidePreview) return;

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
      <div className="space-y-2">
        {!hidePreview && (
          <ChartTypeSelector
            selectedChartType={state.chartType}
            onChartTypeSelect={(chartType) => dispatch({ type: "SET_CHART_TYPE", payload: chartType })}
          />
        )}

        <MeasuresPanel
          selectedMeasures={state.selectedMeasures}
          customMeasures={state.customMeasures}
          onMeasuresChange={(measures) => dispatch({ type: "SET_MEASURES", payload: measures })}
          onCustomMeasuresChange={(measures) => dispatch({ type: "SET_CUSTOM_MEASURES", payload: measures })}
        />

        <DimensionsPanel
          selectedDimensions={state.selectedDimensions}
          onDimensionsChange={(dimensions) => dispatch({ type: "SET_DIMENSIONS", payload: dimensions })}
        />

        <TimeDimensionPanel
          timeDimension={state.timeDimension}
          onTimeDimensionChange={(config) => dispatch({ type: "SET_TIME_DIMENSION", payload: config })}
        />

        <FiltersPanel
          filters={state.filters}
          filterLogic={state.filterLogic}
          onFiltersChange={(filters) => dispatch({ type: "SET_FILTERS", payload: filters })}
          onFilterLogicChange={(logic) => dispatch({ type: "SET_FILTER_LOGIC", payload: logic })}
        />

        <div className="flex gap-2">
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
          onAdd={saveDashboard.handleAddToDashboard}
          isSaving={saveDashboard.isSaving}
        />
      )}
    </div>
  );
}
