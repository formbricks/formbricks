"use client";

import { useReducer, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { CodeIcon, DatabaseIcon } from "lucide-react";
import { Button } from "@/modules/ui/components/button";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import * as Collapsible from "@radix-ui/react-collapsible";
import { createChartAction, addChartToDashboardAction, getDashboardsAction, executeQueryAction } from "../../actions";
import { ChartRenderer } from "./ChartRenderer";
import { MeasuresPanel } from "./MeasuresPanel";
import { DimensionsPanel } from "./DimensionsPanel";
import { FiltersPanel } from "./FiltersPanel";
import { TimeDimensionPanel } from "./TimeDimensionPanel";
import { SaveChartDialog } from "./SaveChartDialog";
import { AddToDashboardDialog } from "./AddToDashboardDialog";
import { CHART_TYPES } from "../lib/chart-types";
import { ChartBuilderState, FilterRow, TimeDimensionConfig, CustomMeasure, buildCubeQuery } from "../lib/query-builder";
import { mapChartType } from "../lib/chart-utils";

interface AdvancedChartBuilderProps {
  environmentId: string;
  initialChartType?: string;
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

export function AdvancedChartBuilder({ environmentId, initialChartType }: AdvancedChartBuilderProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(chartBuilderReducer, {
    ...initialState,
    chartType: initialChartType || "",
  });
  const [chartData, setChartData] = useState<Record<string, any>[] | null>(null);
  const [query, setQuery] = useState<any>(null);
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
      router.push(`/environments/${environmentId}/analysis/charts`);
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
    console.log(query);
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
      router.push(`/environments/${environmentId}/analysis/dashboard/${selectedDashboardId}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to add chart to dashboard");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Left Column: Configuration */}
      <div className="space-y-8">
        {/* Chart Type Selection */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">
              1
            </span>
            <h2 className="font-medium text-gray-900">Choose chart type</h2>
          </div>
          <div className="ml-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {CHART_TYPES.map((chart) => {
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
          {chartData && (
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

      {/* Right Column: Preview */}
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
                            <th key={key} className="border-b border-gray-200 px-3 py-2 text-left font-medium">
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
            Configure your chart and click "Run Query" to preview
          </div>
        )}
      </div>

      {/* Dialogs */}
      <SaveChartDialog
        open={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
        chartName={chartName}
        onChartNameChange={setChartName}
        onSave={handleSaveChart}
        isSaving={isSaving}
      />

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
    </div>
  );
}
