"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TChartQuery } from "@formbricks/types/analysis";
import { DimensionsPanel } from "@/modules/ee/analysis/charts/components/dimensions-panel";
import { FiltersPanel } from "@/modules/ee/analysis/charts/components/filters-panel";
import { MeasuresPanel } from "@/modules/ee/analysis/charts/components/measures-panel";
import { TimeDimensionPanel } from "@/modules/ee/analysis/charts/components/time-dimension-panel";
import { useChartQuery } from "@/modules/ee/analysis/charts/hooks/use-chart-query";
import {
  type ChartBuilderState,
  type FilterRow,
  type TimeDimensionConfig,
  buildCubeQuery,
  parseQueryToState,
} from "@/modules/ee/analysis/lib/query-builder";
import { FEEDBACK_FIELDS } from "@/modules/ee/analysis/lib/schema-definition";
import type { AnalyticsResponse, TChartType } from "@/modules/ee/analysis/types/analysis";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";

export interface ChartQueryState {
  isLoading: boolean;
  error: string | null;
  isPending: boolean;
}

interface AdvancedChartBuilderProps {
  workspaceId: string;
  chartType: TChartType;
  initialQuery?: TChartQuery;
  onChartGenerated?: (data: AnalyticsResponse) => void;
  onQueryStateChange?: (state: ChartQueryState) => void;
  feedbackDirectoryId: string | null;
}

const AUTO_RUN_DEBOUNCE_MS = 500;

const ACTION = {
  SET_MEASURES: "SET_MEASURES",
  SET_DIMENSIONS: "SET_DIMENSIONS",
  SET_FILTERS: "SET_FILTERS",
  SET_FILTER_LOGIC: "SET_FILTER_LOGIC",
  SET_TIME_DIMENSION: "SET_TIME_DIMENSION",
  INIT_FROM_QUERY: "INIT_FROM_QUERY",
} as const;

type Action =
  | { type: typeof ACTION.SET_MEASURES; payload: string[] }
  | { type: typeof ACTION.SET_DIMENSIONS; payload: string[] }
  | { type: typeof ACTION.SET_FILTERS; payload: FilterRow[] }
  | { type: typeof ACTION.SET_FILTER_LOGIC; payload: "and" | "or" }
  | { type: typeof ACTION.SET_TIME_DIMENSION; payload: TimeDimensionConfig | null }
  | { type: typeof ACTION.INIT_FROM_QUERY; payload: Partial<ChartBuilderState> };

const initialState: ChartBuilderState = {
  selectedMeasures: [],
  selectedDimensions: [],
  filters: [],
  filterLogic: "and",
  timeDimension: null,
};

const chartBuilderReducer = (state: ChartBuilderState, action: Action): ChartBuilderState => {
  switch (action.type) {
    case ACTION.SET_MEASURES:
      return { ...state, selectedMeasures: action.payload };
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

const toComparableQueryJson = (query: TChartQuery): string =>
  JSON.stringify(buildCubeQuery({ ...initialState, ...parseQueryToState(query) }));

export function AdvancedChartBuilder({
  workspaceId,
  chartType,
  initialQuery,
  onChartGenerated,
  onQueryStateChange,
  feedbackDirectoryId,
}: Readonly<AdvancedChartBuilderProps>) {
  const { t } = useTranslation();
  const parsedInitial = initialQuery ? parseQueryToState(initialQuery) : null;

  const [state, dispatch] = useReducer(
    chartBuilderReducer,
    initialQuery ? { ...initialState, ...parsedInitial } : initialState
  );

  const { isLoading, error, runQuery } = useChartQuery(workspaceId, feedbackDirectoryId, initialQuery);
  const [isConfigDirty, setIsConfigDirty] = useState(false);
  const chartTypeRef = useRef(chartType);

  useEffect(() => {
    chartTypeRef.current = chartType;
  }, [chartType]);

  useEffect(() => {
    onQueryStateChange?.({ isLoading, error, isPending: isConfigDirty || isLoading });
  }, [isLoading, error, isConfigDirty, onQueryStateChange]);

  const [dimensionsOpen, setDimensionsOpen] = useState(
    () => (parsedInitial?.selectedDimensions?.length ?? 0) > 0
  );
  const timeDimensionOpen = state.timeDimension != null;
  const filtersOpen = state.filters.length > 0;

  const currentQuery = useMemo(() => buildCubeQuery(state), [state]);
  const currentQueryJson = JSON.stringify(currentQuery);

  // The last query that was executed (or arrived pre-executed via initialQuery, e.g. from the
  // AI section or a saved chart). Auto-run only fires when the form drifts away from it.
  const lastRunQueryJsonRef = useRef<string | null>(
    initialQuery ? toComparableQueryJson(initialQuery) : null
  );

  const appliedInitialQueryRef = useRef<TChartQuery | null>(null);
  useEffect(() => {
    if (!initialQuery) return;
    if (appliedInitialQueryRef.current === initialQuery) return;
    appliedInitialQueryRef.current = initialQuery;
    const parsed = parseQueryToState(initialQuery);
    lastRunQueryJsonRef.current = JSON.stringify(buildCubeQuery({ ...initialState, ...parsed }));
    dispatch({ type: ACTION.INIT_FROM_QUERY, payload: parsed });
    setDimensionsOpen((parsed.selectedDimensions?.length ?? 0) > 0);
  }, [initialQuery]);

  // Incomplete configs (no measure yet, half-filled filter row) are skipped silently instead of
  // surfacing validation toasts on every keystroke; the preview keeps its last valid state.
  const isConfigComplete = useMemo(() => {
    if (state.selectedMeasures.length === 0) return false;
    if (dimensionsOpen && state.selectedDimensions.length === 0) return false;
    return !state.filters.some(
      (f) => f.operator !== "set" && f.operator !== "notSet" && (f.values === null || f.values.length === 0)
    );
  }, [state, dimensionsOpen]);

  // Latest-value ref so the debounce timer is not reset by parent re-renders or
  // identity changes of runQuery/onChartGenerated.
  const executeQueryRef = useRef<() => void>(() => {});
  useEffect(() => {
    executeQueryRef.current = () => {
      lastRunQueryJsonRef.current = currentQueryJson;
      setIsConfigDirty(false);
      void runQuery(currentQuery).then((result) => {
        if (result) {
          onChartGenerated?.({ ...result, chartType: chartTypeRef.current });
        }
      });
    };
  });

  useEffect(() => {
    const hasDrift = currentQueryJson !== lastRunQueryJsonRef.current;
    setIsConfigDirty(hasDrift);

    if (!feedbackDirectoryId || !isConfigComplete || !hasDrift) return;

    const timeout = setTimeout(() => {
      executeQueryRef.current();
    }, AUTO_RUN_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [currentQueryJson, isConfigComplete, feedbackDirectoryId]);

  return (
    <div className="mx-1 space-y-2">
      <div className="mt-4 flex w-full flex-col gap-3 overflow-hidden rounded-lg border bg-slate-50 p-4">
        <MeasuresPanel
          selectedMeasures={state.selectedMeasures}
          onMeasuresChange={(measures) => dispatch({ type: ACTION.SET_MEASURES, payload: measures })}
        />
      </div>

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
                  id: crypto.randomUUID(),
                  field: firstField?.id ?? "",
                  operator: "equals" as const,
                  values: null,
                },
              ],
            });
          }
        }}
        htmlId="chart-filters-toggle"
        title={t("workspace.analysis.charts.filter_data")}
        description={t("workspace.analysis.charts.filters_toggle_description")}
        customContainerClass="mt-2 px-0"
        childrenContainerClass="flex-col gap-3 p-4"
        childBorder>
        <FiltersPanel
          hideTitle
          workspaceId={workspaceId}
          feedbackDirectoryId={feedbackDirectoryId}
          filters={state.filters}
          filterLogic={state.filterLogic}
          onFiltersChange={(filters) => dispatch({ type: ACTION.SET_FILTERS, payload: filters })}
          onFilterLogicChange={(logic) => dispatch({ type: ACTION.SET_FILTER_LOGIC, payload: logic })}
        />
      </AdvancedOptionToggle>

      <AdvancedOptionToggle
        isChecked={dimensionsOpen}
        onToggle={(checked) => {
          setDimensionsOpen(checked);
          if (!checked) dispatch({ type: ACTION.SET_DIMENSIONS, payload: [] });
        }}
        htmlId="chart-dimensions-toggle"
        title={t("workspace.analysis.charts.group_data")}
        description={t("workspace.analysis.charts.dimensions_toggle_description")}
        customContainerClass="mt-2 px-0"
        childrenContainerClass="flex-col gap-3 p-4"
        childBorder>
        <DimensionsPanel
          hideTitle
          selectedDimensions={state.selectedDimensions}
          onDimensionsChange={(dimensions) => dispatch({ type: ACTION.SET_DIMENSIONS, payload: dimensions })}
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
                dateRange: "last 30 days",
              },
            });
          }
        }}
        htmlId="chart-time-dimension-toggle"
        title={t("workspace.analysis.charts.time_dimension_title")}
        description={t("workspace.analysis.charts.time_dimension_toggle_description")}
        customContainerClass="mt-2 px-0"
        childrenContainerClass="flex-col gap-3 p-4"
        childBorder>
        <TimeDimensionPanel
          hideTitle
          timeDimension={state.timeDimension}
          onTimeDimensionChange={(config) => dispatch({ type: ACTION.SET_TIME_DIMENSION, payload: config })}
        />
      </AdvancedOptionToggle>
    </div>
  );
}
