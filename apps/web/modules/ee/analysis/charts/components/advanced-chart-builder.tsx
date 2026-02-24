"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { CodeIcon, DatabaseIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useReducer, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TChartQuery } from "@formbricks/types/dashboard";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createChartAction, executeQueryAction } from "@/modules/ee/analysis/charts/actions";
import { AddToDashboardDialog } from "@/modules/ee/analysis/charts/components/add-to-dashboard-dialog";
import { ChartRenderer } from "@/modules/ee/analysis/charts/components/chart-renderer";
import { DimensionsPanel } from "@/modules/ee/analysis/charts/components/dimensions-panel";
import { FiltersPanel } from "@/modules/ee/analysis/charts/components/filters-panel";
import { MeasuresPanel } from "@/modules/ee/analysis/charts/components/measures-panel";
import { SaveChartDialog } from "@/modules/ee/analysis/charts/components/save-chart-dialog";
import { TimeDimensionPanel } from "@/modules/ee/analysis/charts/components/time-dimension-panel";
import { CHART_TYPES } from "@/modules/ee/analysis/charts/lib/chart-types";
import { formatCellValue, mapChartType } from "@/modules/ee/analysis/charts/lib/chart-utils";
import { addChartToDashboardAction, getDashboardsAction } from "@/modules/ee/analysis/dashboards/actions";
import {
  ChartBuilderState,
  type CustomMeasure,
  type FilterRow,
  type TimeDimensionConfig,
  buildCubeQuery,
  parseQueryToState,
} from "@/modules/ee/analysis/lib/query-builder";
import { formatCubeColumnHeader } from "@/modules/ee/analysis/lib/schema-definition";
import type { AnalyticsResponse, TApiChartType, TChartDataRow } from "@/modules/ee/analysis/types/analysis";
import { Button } from "@/modules/ui/components/button";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";

interface AdvancedChartBuilderProps {
  environmentId: string;
  initialChartType?: TApiChartType;
  initialQuery?: TChartQuery;
  hidePreview?: boolean;
  onChartGenerated?: (data: AnalyticsResponse) => void;
  onSave?: (chartId: string) => void;
  onAddToDashboard?: (chartId: string, dashboardId: string) => void;
}

type Action =
  | { type: "SET_CHART_TYPE"; payload: TApiChartType }
  | { type: "SET_MEASURES"; payload: string[] }
  | { type: "SET_CUSTOM_MEASURES"; payload: CustomMeasure[] }
  | { type: "SET_DIMENSIONS"; payload: string[] }
  | { type: "SET_FILTERS"; payload: FilterRow[] }
  | { type: "SET_FILTER_LOGIC"; payload: "and" | "or" }
  | { type: "SET_TIME_DIMENSION"; payload: TimeDimensionConfig | null };

const initialState: ChartBuilderState = {
  chartType: "",
  selectedMeasures: [],
  customMeasures: [],
  selectedDimensions: [],
  filters: [],
  filterLogic: "and",
  timeDimension: null,
};

function chartBuilderReducer(state: ChartBuilderState, action: Action): ChartBuilderState {
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
}

export function AdvancedChartBuilder({
  environmentId,
  initialChartType,
  initialQuery,
  hidePreview = false,
  onChartGenerated,
  onSave,
  onAddToDashboard,
}: Readonly<AdvancedChartBuilderProps>) {
  const router = useRouter();

  const getInitialState = (): ChartBuilderState => {
    if (initialQuery) {
      const parsedState = parseQueryToState(initialQuery, initialChartType);
      return {
        ...initialState,
        ...parsedState,
        chartType: parsedState.chartType || initialChartType || "",
      };
    }
    return {
      ...initialState,
      chartType: initialChartType || "",
    };
  };

  const [state, dispatch] = useReducer(chartBuilderReducer, getInitialState());
  const [chartData, setChartData] = useState<TChartDataRow[] | null>(null);
  const [query, setQuery] = useState<TChartQuery | null>(initialQuery || null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isAddToDashboardDialogOpen, setIsAddToDashboardDialogOpen] = useState(false);
  const [chartName, setChartName] = useState("");
  const [dashboards, setDashboards] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [showQuery, setShowQuery] = useState(false);
  const [showData, setShowData] = useState(false);
  const lastStateRef = React.useRef<string>("");

  // Sync initialChartType prop changes to state
  useEffect(() => {
    if (initialChartType && initialChartType !== state.chartType) {
      dispatch({ type: "SET_CHART_TYPE", payload: initialChartType });
      if (!initialQuery && !isInitialized) {
        setIsInitialized(true);
      }
    }
  }, [initialChartType, state.chartType, initialQuery, isInitialized]);

  // Initialize: If initialQuery is provided (from AI), execute it and set chart data
  useEffect(() => {
    if (initialQuery && !isInitialized) {
      setIsInitialized(true);
      const chartType = state.chartType;
      executeQueryAction({
        environmentId,
        query: initialQuery,
      }).then((result) => {
        if (result?.serverError) {
          setError(getFormattedErrorMessage(result));
          return;
        }
        const data = Array.isArray(result?.data) ? result.data : [];
        if (data.length > 0) {
          setChartData(data);
          setQuery(initialQuery);
          lastStateRef.current = JSON.stringify({
            chartType,
            measures: state.selectedMeasures,
            dimensions: state.selectedDimensions,
            filters: state.filters,
            timeDimension: state.timeDimension,
          });
          if (onChartGenerated && chartType) {
            onChartGenerated({ query: initialQuery, chartType, data });
          }
        }
      });
    }
  }, [
    initialQuery,
    environmentId,
    isInitialized,
    state.chartType,
    state.selectedMeasures,
    state.selectedDimensions,
    state.filters,
    state.timeDimension,
    onChartGenerated,
  ]);

  // Update preview reactively when state changes (after initialization)
  useEffect(() => {
    if (!isInitialized || !state.chartType) return;

    const stateHash = JSON.stringify({
      chartType: state.chartType,
      measures: state.selectedMeasures,
      dimensions: state.selectedDimensions,
      filters: state.filters,
      timeDimension: state.timeDimension,
    });

    if (stateHash === lastStateRef.current) return;
    lastStateRef.current = stateHash;

    if (state.selectedMeasures.length === 0 && state.customMeasures.length === 0) {
      return;
    }

    const chartType = state.chartType;
    const updatedQuery = buildCubeQuery(state);
    setIsLoading(true);
    setError(null);

    executeQueryAction({
      environmentId,
      query: updatedQuery,
    })
      .then((result) => {
        const data = Array.isArray(result?.data) ? result.data : [];
        if (data.length > 0) {
          setChartData(data);
          setQuery(updatedQuery);
          if (onChartGenerated && chartType) {
            onChartGenerated({ query: updatedQuery, chartType, data });
          }
        } else if (result?.serverError) {
          setError(getFormattedErrorMessage(result));
        }
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : t("environments.analysis.charts.failed_to_execute_query");
        setError(message);
      })
      .finally(() => {
        setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- state excluded to avoid sync loops
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
    onChartGenerated,
  ]);

  useEffect(() => {
    if (isAddToDashboardDialogOpen) {
      getDashboardsAction({ environmentId }).then((result) => {
        if (result?.data) {
          setDashboards(result.data.map((d) => ({ id: d.id, name: d.name })));
        } else if (result?.serverError) {
          toast.error(getFormattedErrorMessage(result));
        }
      });
    }
  }, [isAddToDashboardDialogOpen, environmentId]);

  const { t } = useTranslation();

  const handleRunQuery = async () => {
    if (!state.chartType) {
      toast.error(t("environments.analysis.charts.please_select_chart_type"));
      return;
    }
    if (state.selectedMeasures.length === 0 && state.customMeasures.length === 0) {
      toast.error(t("environments.analysis.charts.please_select_at_least_one_measure"));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const cubeQuery = buildCubeQuery(state);
      setQuery(cubeQuery);

      const result = await executeQueryAction({
        environmentId,
        query: cubeQuery,
      });

      if (result?.serverError) {
        const errorMsg = getFormattedErrorMessage(result);
        setError(errorMsg);
        toast.error(errorMsg);
        setChartData(null);
      } else if (result?.data !== undefined && Array.isArray(result.data)) {
        const data = result.data;
        setChartData(data);
        setError(null);
        toast.success(t("environments.analysis.charts.query_executed_successfully"));

        if (onChartGenerated && state.chartType) {
          onChartGenerated({ query: cubeQuery, chartType: state.chartType, data });
        }
      } else {
        throw new Error(t("environments.analysis.charts.no_data_returned"));
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("environments.analysis.charts.failed_to_execute_query");
      setError(errorMessage);
      toast.error(errorMessage);
      setChartData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveChart = async () => {
    if (!chartData || !chartName.trim()) {
      toast.error(t("environments.analysis.charts.please_enter_chart_name"));
      return;
    }
    if (!query) {
      toast.error(t("environments.analysis.charts.please_run_query_first"));
      return;
    }

    setIsSaving(true);
    try {
      const result = await createChartAction({
        environmentId,
        chartInput: {
          name: chartName,
          type: mapChartType(state.chartType),
          query,
          config: {},
        },
      });

      if (!result?.data) {
        toast.error(
          (result && getFormattedErrorMessage(result)) ||
            t("environments.analysis.charts.failed_to_save_chart")
        );
        return;
      }

      toast.success(t("environments.analysis.charts.chart_saved_successfully"));
      setIsSaveDialogOpen(false);
      if (onSave) {
        onSave(result.data.id);
      } else {
        router.push(`/environments/${environmentId}/analysis/charts`);
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("environments.analysis.charts.failed_to_save_chart");
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToDashboard = async () => {
    if (!chartData || !selectedDashboardId) {
      toast.error(t("environments.analysis.charts.please_select_dashboard"));
      return;
    }
    if (!query) {
      toast.error(t("environments.analysis.charts.please_run_query_first"));
      return;
    }

    setIsSaving(true);
    try {
      const chartResult = await createChartAction({
        environmentId,
        chartInput: {
          name: chartName || `Chart ${new Date().toLocaleString()}`,
          type: mapChartType(state.chartType),
          query,
          config: {},
        },
      });

      if (!chartResult?.data) {
        toast.error(
          (chartResult && getFormattedErrorMessage(chartResult)) ||
            t("environments.analysis.charts.failed_to_save_chart")
        );
        return;
      }

      const widgetResult = await addChartToDashboardAction({
        environmentId,
        chartId: chartResult.data.id,
        dashboardId: selectedDashboardId,
      });

      if (!widgetResult?.data) {
        toast.error(
          (widgetResult && getFormattedErrorMessage(widgetResult)) ||
            t("environments.analysis.charts.failed_to_add_chart_to_dashboard")
        );
        return;
      }

      toast.success(t("environments.analysis.charts.chart_added_to_dashboard"));
      setIsAddToDashboardDialogOpen(false);
      if (onAddToDashboard) {
        onAddToDashboard(chartResult.data.id, selectedDashboardId);
      } else {
        router.push(`/environments/${environmentId}/analysis/dashboards/${selectedDashboardId}`);
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : t("environments.analysis.charts.failed_to_add_chart_to_dashboard");
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={hidePreview ? "space-y-4" : "grid gap-4 lg:grid-cols-2"}>
      {/* Left Column: Configuration */}
      <div className="space-y-4">
        {!hidePreview && (
          <div className="space-y-4">
            <h2 className="font-medium text-gray-900">
              {t("environments.analysis.charts.chart_builder_choose_chart_type")}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {CHART_TYPES.map((chart) => {
                const isSelected = state.chartType === chart.id;
                return (
                  <button
                    key={chart.id}
                    type="button"
                    onClick={() => dispatch({ type: "SET_CHART_TYPE", payload: chart.id })}
                    className={`rounded-md border p-4 text-center transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isSelected
                        ? "border-brand-dark ring-brand-dark bg-brand-dark/5 ring-1"
                        : "border-gray-200 hover:border-gray-300"
                    }`}>
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded bg-gray-100">
                      <chart.icon className="h-6 w-6 text-gray-600" strokeWidth={1.5} />
                    </div>
                    <span className="text-xs font-medium text-gray-700">{chart.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
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
          {chartData && !onSave && !onAddToDashboard && (
            <>
              <Button variant="outline" onClick={() => setIsSaveDialogOpen(true)}>
                {t("environments.analysis.charts.save_chart")}
              </Button>
              <Button variant="outline" onClick={() => setIsAddToDashboardDialogOpen(true)}>
                {t("environments.analysis.charts.add_to_dashboard")}
              </Button>
            </>
          )}
        </div>
      </div>

      {!hidePreview && (
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900">{t("environments.analysis.charts.chart_preview")}</h3>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
          )}

          {isLoading && (
            <div className="flex h-64 items-center justify-center">
              <LoadingSpinner />
            </div>
          )}

          {chartData && Array.isArray(chartData) && chartData.length > 0 && !isLoading && state.chartType && (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <ChartRenderer chartType={state.chartType} data={chartData} />
              </div>

              <Collapsible.Root open={showQuery} onOpenChange={setShowQuery}>
                <Collapsible.CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CodeIcon className="mr-2 h-4 w-4" />
                    {showQuery ? t("common.hide") : t("common.view")} Query
                  </Button>
                </Collapsible.CollapsibleTrigger>
                <Collapsible.CollapsibleContent className="mt-2">
                  <pre className="max-h-64 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs">
                    {JSON.stringify(query, null, 2)}
                  </pre>
                </Collapsible.CollapsibleContent>
              </Collapsible.Root>

              <Collapsible.Root open={showData} onOpenChange={setShowData}>
                <Collapsible.CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <DatabaseIcon className="mr-2 h-4 w-4" />
                    {showData ? t("common.hide") : t("common.view")} Data
                  </Button>
                </Collapsible.CollapsibleTrigger>
                <Collapsible.CollapsibleContent className="mt-2">
                  <div className="max-h-64 overflow-auto rounded-lg border border-gray-200">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {Array.isArray(chartData) &&
                            chartData.length > 0 &&
                            Object.keys(chartData[0]).map((key) => (
                              <th
                                key={key}
                                className="border-b border-gray-200 px-3 py-2 text-left font-medium">
                                {formatCubeColumnHeader(key)}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(chartData) &&
                          chartData.slice(0, 10).map((row, idx) => {
                            const rowKey = Object.values(row)
                              .slice(0, 3)
                              .map((v) => String(v || ""))
                              .join("-");
                            return (
                              <tr key={`row-${idx}-${rowKey}`} className="border-b border-gray-100">
                                {Object.entries(row).map(([key, value]) => (
                                  <td key={`${rowKey}-${key}`} className="px-3 py-2">
                                    {formatCellValue(value) || "-"}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                    {Array.isArray(chartData) && chartData.length > 10 && (
                      <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500">
                        {t("environments.analysis.charts.showing_first_10_of", { count: chartData.length })}
                      </div>
                    )}
                  </div>
                </Collapsible.CollapsibleContent>
              </Collapsible.Root>
            </div>
          )}

          {!chartData && !isLoading && !error && (
            <div className="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-500">
              {t("environments.analysis.charts.advanced_chart_builder_config_prompt")}
            </div>
          )}
        </div>
      )}

      {!onSave && (
        <SaveChartDialog
          open={isSaveDialogOpen}
          onOpenChange={setIsSaveDialogOpen}
          chartName={chartName}
          onChartNameChange={setChartName}
          onSave={handleSaveChart}
          isSaving={isSaving}
        />
      )}

      {!onAddToDashboard && (
        <AddToDashboardDialog
          open={isAddToDashboardDialogOpen}
          onOpenChange={setIsAddToDashboardDialogOpen}
          chartName={chartName}
          onChartNameChange={setChartName}
          dashboards={dashboards}
          selectedDashboardId={selectedDashboardId}
          onDashboardSelect={setSelectedDashboardId}
          onAdd={handleAddToDashboard}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
