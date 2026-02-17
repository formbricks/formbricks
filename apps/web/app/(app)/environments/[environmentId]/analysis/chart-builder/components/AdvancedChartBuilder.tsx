"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { CodeIcon, DatabaseIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useReducer, useState } from "react";
import { toast } from "react-hot-toast";
import { AnalyticsResponse } from "@/app/api/analytics/_lib/types";
import { Button } from "@/modules/ui/components/button";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import {
  addChartToDashboardAction,
  createChartAction,
  executeQueryAction,
  getDashboardsAction,
} from "../../actions";
import { CHART_TYPES } from "../lib/chart-types";

// Filter out table, map, and scatter charts
const AVAILABLE_CHART_TYPES = CHART_TYPES.filter(
  (type) => !["table", "map", "scatter"].includes(type.id)
);
import { mapChartType } from "../lib/chart-utils";
import {
  ChartBuilderState,
  CustomMeasure,
  FilterRow,
  TimeDimensionConfig,
  buildCubeQuery,
  parseQueryToState,
} from "../lib/query-builder";
import { AddToDashboardDialog } from "./AddToDashboardDialog";
import { ChartRenderer } from "./ChartRenderer";
import { DimensionsPanel } from "./DimensionsPanel";
import { FiltersPanel } from "./FiltersPanel";
import { MeasuresPanel } from "./MeasuresPanel";
import { SaveChartDialog } from "./SaveChartDialog";
import { TimeDimensionPanel } from "./TimeDimensionPanel";

interface AdvancedChartBuilderProps {
  environmentId: string;
  initialChartType?: string;
  initialQuery?: any; // Prefill with AI-generated query
  hidePreview?: boolean; // Hide internal preview when using unified preview
  onChartGenerated?: (data: AnalyticsResponse) => void;
  onSave?: (chartId: string) => void;
  onAddToDashboard?: (chartId: string, dashboardId: string) => void;
}

type Action =
  | { type: "SET_CHART_TYPE"; payload: string }
  | { type: "ADD_MEASURE"; payload: string }
  | { type: "REMOVE_MEASURE"; payload: string }
  | { type: "SET_MEASURES"; payload: string[] }
  | { type: "ADD_CUSTOM_MEASURE"; payload: CustomMeasure }
  | { type: "UPDATE_CUSTOM_MEASURE"; payload: { index: number; measure: CustomMeasure } }
  | { type: "REMOVE_CUSTOM_MEASURE"; payload: number }
  | { type: "SET_CUSTOM_MEASURES"; payload: CustomMeasure[] }
  | { type: "SET_DIMENSIONS"; payload: string[] }
  | { type: "ADD_FILTER"; payload: FilterRow }
  | { type: "UPDATE_FILTER"; payload: { index: number; filter: FilterRow } }
  | { type: "REMOVE_FILTER"; payload: number }
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
}: AdvancedChartBuilderProps) {
  const router = useRouter();

  // Initialize state from initialQuery if provided
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
  const [chartData, setChartData] = useState<Record<string, any>[] | null>(null);
  const [query, setQuery] = useState<any>(initialQuery || null);
  const [isInitialized, setIsInitialized] = useState(false);
  const lastStateRef = React.useRef<string>("");

  // Sync initialChartType prop changes to state
  useEffect(() => {
    if (initialChartType && initialChartType !== state.chartType) {
      dispatch({ type: "SET_CHART_TYPE", payload: initialChartType });
      // If there's no initialQuery, mark as initialized so reactive updates can work
      if (!initialQuery && !isInitialized) {
        setIsInitialized(true);
      }
    }
  }, [initialChartType, state.chartType, initialQuery, isInitialized]);

  // Initialize: If initialQuery is provided (from AI), execute it and set chart data
  useEffect(() => {
    if (initialQuery && !isInitialized) {
      setIsInitialized(true);
      executeQueryAction({
        environmentId,
        query: initialQuery,
      }).then((result) => {
        if (result?.data?.data) {
          const data = Array.isArray(result.data.data) ? result.data.data : [];
          setChartData(data);
          setQuery(initialQuery);
          // Set initial state hash to prevent reactive update on initial load
          lastStateRef.current = JSON.stringify({
            chartType: state.chartType,
            measures: state.selectedMeasures,
            dimensions: state.selectedDimensions,
            filters: state.filters,
            timeDimension: state.timeDimension,
          });
          // Call onChartGenerated if provided
          if (onChartGenerated) {
            const analyticsResponse: AnalyticsResponse = {
              query: initialQuery,
              chartType: state.chartType as any,
              data,
            };
            onChartGenerated(analyticsResponse);
          }
        }
      });
    }
  }, [initialQuery, environmentId, isInitialized, state.chartType, state.selectedMeasures, state.selectedDimensions, state.filters, state.timeDimension, onChartGenerated]);

  // Update preview reactively when state changes (after initialization)
  useEffect(() => {
    // Skip if not initialized or no chart type selected
    if (!isInitialized || !state.chartType) return;

    // Create a hash of relevant state to detect changes
    const stateHash = JSON.stringify({
      chartType: state.chartType,
      measures: state.selectedMeasures,
      dimensions: state.selectedDimensions,
      filters: state.filters,
      timeDimension: state.timeDimension,
    });

    // Only update if state actually changed
    if (stateHash === lastStateRef.current) return;
    lastStateRef.current = stateHash;

    // If chart type changed but we have existing data, update the chart type in preview immediately
    // This handles the case where user changes chart type from ManualChartBuilder
    if (chartData && Array.isArray(chartData) && chartData.length > 0 && query) {
      if (onChartGenerated) {
        const analyticsResponse: AnalyticsResponse = {
          query: query, // Keep existing query
          chartType: state.chartType as any, // Update chart type
          data: chartData, // Keep existing data
        };
        onChartGenerated(analyticsResponse);
      }
    }

    // Only execute query if we have measures configured
    if (state.selectedMeasures.length === 0 && state.customMeasures.length === 0) {
      return; // Don't execute query without measures
    }

    // Build and execute query with current state
    const updatedQuery = buildCubeQuery(state);
    setIsLoading(true);
    setError(null);

    executeQueryAction({
      environmentId,
      query: updatedQuery,
    })
      .then((result) => {
        if (result?.data?.data) {
          const data = Array.isArray(result.data.data) ? result.data.data : [];
          setChartData(data);
          setQuery(updatedQuery);
          // Call onChartGenerated to update parent preview
          if (onChartGenerated) {
            const analyticsResponse: AnalyticsResponse = {
              query: updatedQuery,
              chartType: state.chartType as any,
              data,
            };
            onChartGenerated(analyticsResponse);
          }
        } else if (result?.serverError) {
          setError(result.serverError);
        }
      })
      .catch((err: any) => {
        setError(err.message || "Failed to execute query");
      })
      .finally(() => {
        setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.chartType, state.selectedMeasures, state.selectedDimensions, state.filters, state.filterLogic, state.customMeasures, state.timeDimension, isInitialized, environmentId, onChartGenerated, chartData, query]);
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

  useEffect(() => {
    if (isAddToDashboardDialogOpen) {
      getDashboardsAction({ environmentId }).then((result) => {
        if (result?.data) {
          setDashboards(result.data);
        } else if (result?.serverError) {
          toast.error(result.serverError);
        }
      });
    }
  }, [isAddToDashboardDialogOpen, environmentId]);

  const handleRunQuery = async () => {
    if (!state.chartType) {
      toast.error("Please select a chart type");
      return;
    }
    if (state.selectedMeasures.length === 0 && state.customMeasures.length === 0) {
      toast.error("Please select at least one measure");
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
        setError(result.serverError);
        toast.error(result.serverError);
        setChartData(null);
      } else if (result?.data?.data) {
        // Ensure data is always an array - result.data.data contains the actual array
        const data = Array.isArray(result.data.data) ? result.data.data : [];
        setChartData(data);
        setError(null);
        toast.success("Query executed successfully");

        // Call onChartGenerated callback if provided
        if (onChartGenerated) {
          const analyticsResponse: AnalyticsResponse = {
            query: cubeQuery,
            chartType: state.chartType as any,
            data,
          };
          onChartGenerated(analyticsResponse);
        }
      } else {
        throw new Error("No data returned");
      }
    } catch (err: any) {
      const errorMessage = err.message || "Failed to execute query";
      setError(errorMessage);
      toast.error(errorMessage);
      setChartData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveChart = async () => {
    if (!chartData || !chartName.trim()) {
      toast.error("Please enter a chart name");
      return;
    }
    if (!query) {
      toast.error("Please run a query first");
      return;
    }

    setIsSaving(true);
    try {
      const result = await createChartAction({
        environmentId,
        name: chartName,
        type: mapChartType(state.chartType),
        query,
        config: {},
      });

      if (!result?.data) {
        toast.error(result?.serverError || "Failed to save chart");
        return;
      }

      toast.success("Chart saved successfully!");
      setIsSaveDialogOpen(false);
      if (onSave) {
        onSave(result.data.id);
      } else {
        router.push(`/environments/${environmentId}/analysis/charts`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to save chart");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToDashboard = async () => {
    if (!chartData || !selectedDashboardId) {
      toast.error("Please select a dashboard");
      return;
    }
    if (!query) {
      toast.error("Please run a query first");
      return;
    }

    setIsSaving(true);
    try {
      const chartResult = await createChartAction({
        environmentId,
        name: chartName || `Chart ${new Date().toLocaleString()}`,
        type: mapChartType(state.chartType),
        query,
        config: {},
      });

      if (!chartResult?.data) {
        toast.error(chartResult?.serverError || "Failed to save chart");
        return;
      }

      const widgetResult = await addChartToDashboardAction({
        environmentId,
        chartId: chartResult.data.id,
        dashboardId: selectedDashboardId,
      });

      if (!widgetResult?.data) {
        toast.error(widgetResult?.serverError || "Failed to add chart to dashboard");
        return;
      }

      toast.success("Chart added to dashboard!");
      setIsAddToDashboardDialogOpen(false);
      if (onAddToDashboard) {
        onAddToDashboard(chartResult.data.id, selectedDashboardId);
      } else {
        router.push(`/environments/${environmentId}/analysis/dashboard/${selectedDashboardId}`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to add chart to dashboard");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={hidePreview ? "space-y-4" : "grid gap-4 lg:grid-cols-2"}>
      {/* Left Column: Configuration */}
      <div className="space-y-4">
        {/* Chart Type Selection - Hidden when hidePreview is true (unified flow) */}
        {!hidePreview && (
          <div className="space-y-4">
            <h2 className="font-medium text-gray-900">Choose chart type</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {AVAILABLE_CHART_TYPES.map((chart) => {
                const isSelected = state.chartType === chart.id;
                return (
                  <button
                    key={chart.id}
                    type="button"
                    onClick={() => dispatch({ type: "SET_CHART_TYPE", payload: chart.id })}
                    className={`rounded-md border p-4 text-center transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 ${isSelected
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

        {/* Measures Panel */}
        <MeasuresPanel
          selectedMeasures={state.selectedMeasures}
          customMeasures={state.customMeasures}
          onMeasuresChange={(measures) => dispatch({ type: "SET_MEASURES", payload: measures })}
          onCustomMeasuresChange={(measures) => dispatch({ type: "SET_CUSTOM_MEASURES", payload: measures })}
        />

        {/* Dimensions Panel */}
        <DimensionsPanel
          selectedDimensions={state.selectedDimensions}
          onDimensionsChange={(dimensions) => dispatch({ type: "SET_DIMENSIONS", payload: dimensions })}
        />

        {/* Time Dimension Panel */}
        <TimeDimensionPanel
          timeDimension={state.timeDimension}
          onTimeDimensionChange={(config) => dispatch({ type: "SET_TIME_DIMENSION", payload: config })}
        />

        {/* Filters Panel */}
        <FiltersPanel
          filters={state.filters}
          filterLogic={state.filterLogic}
          onFiltersChange={(filters) => dispatch({ type: "SET_FILTERS", payload: filters })}
          onFilterLogicChange={(logic) => dispatch({ type: "SET_FILTER_LOGIC", payload: logic })}
        />

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={handleRunQuery} disabled={isLoading || !state.chartType}>
            {isLoading ? <LoadingSpinner /> : "Run Query"}
          </Button>
          {chartData && !onSave && !onAddToDashboard && (
            <>
              <Button variant="outline" onClick={() => setIsSaveDialogOpen(true)}>
                Save Chart
              </Button>
              <Button variant="outline" onClick={() => setIsAddToDashboardDialogOpen(true)}>
                Add to Dashboard
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Right Column: Preview - Hidden when hidePreview is true */}
      {!hidePreview && (
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900">Chart Preview</h3>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
          )}

          {isLoading && (
            <div className="flex h-64 items-center justify-center">
              <LoadingSpinner />
            </div>
          )}

          {chartData && Array.isArray(chartData) && chartData.length > 0 && !isLoading && (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <ChartRenderer chartType={state.chartType} data={chartData} />
              </div>

              {/* Query Viewer */}
              <Collapsible.Root open={showQuery} onOpenChange={setShowQuery}>
                <Collapsible.CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CodeIcon className="mr-2 h-4 w-4" />
                    {showQuery ? "Hide" : "View"} Query
                  </Button>
                </Collapsible.CollapsibleTrigger>
                <Collapsible.CollapsibleContent className="mt-2">
                  <pre className="max-h-64 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs">
                    {JSON.stringify(query, null, 2)}
                  </pre>
                </Collapsible.CollapsibleContent>
              </Collapsible.Root>

              {/* Data Viewer */}
              <Collapsible.Root open={showData} onOpenChange={setShowData}>
                <Collapsible.CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <DatabaseIcon className="mr-2 h-4 w-4" />
                    {showData ? "Hide" : "View"} Data
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
                                {key}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(chartData) &&
                          chartData.slice(0, 10).map((row, idx) => {
                            // Create a unique key from row data
                            const rowKey = Object.values(row)
                              .slice(0, 3)
                              .map((v) => String(v || ""))
                              .join("-");
                            return (
                              <tr key={`row-${idx}-${rowKey}`} className="border-b border-gray-100">
                                {Object.entries(row).map(([key, value]) => (
                                  <td key={`${rowKey}-${key}`} className="px-3 py-2">
                                    {value?.toString() || "-"}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                    {Array.isArray(chartData) && chartData.length > 10 && (
                      <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500">
                        Showing first 10 of {chartData.length} rows
                      </div>
                    )}
                  </div>
                </Collapsible.CollapsibleContent>
              </Collapsible.Root>
            </div>
          )}

          {!chartData && !isLoading && !error && (
            <div className="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-500">
              Configure your chart and click &quot;Run Query&quot; to preview
            </div>
          )}
        </div>
      )}

      {/* Dialogs - Only render when callbacks are not provided (standalone mode) */}
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
