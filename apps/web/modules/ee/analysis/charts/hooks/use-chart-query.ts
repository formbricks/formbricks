"use client";

import { useEffect, useReducer, useRef } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TChartQuery } from "@formbricks/types/analysis";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { executeQueryAction } from "@/modules/ee/analysis/charts/actions";
import { type ChartBuilderState, buildCubeQuery } from "@/modules/ee/analysis/lib/query-builder";
import type { AnalyticsResponse, TChartDataRow, TChartType } from "@/modules/ee/analysis/types/analysis";

const DEBOUNCE_MS = 300;

interface QueryState {
  chartData: TChartDataRow[] | null;
  query: TChartQuery | null;
  isLoading: boolean;
  error: string | null;
}

type QueryAction =
  | { type: "QUERY_START" }
  | { type: "QUERY_SUCCESS"; payload: { data: TChartDataRow[]; query: TChartQuery } }
  | { type: "QUERY_ERROR"; payload: string };

const initialQueryState: QueryState = {
  chartData: null,
  query: null,
  isLoading: false,
  error: null,
};

const queryReducer = (state: QueryState, action: QueryAction): QueryState => {
  switch (action.type) {
    case "QUERY_START":
      return { ...state, isLoading: true, error: null };
    case "QUERY_SUCCESS":
      return { chartData: action.payload.data, query: action.payload.query, isLoading: false, error: null };
    case "QUERY_ERROR":
      return { ...state, isLoading: false, error: action.payload };
    default:
      return state;
  }
};

export interface UseChartQueryProps {
  environmentId: string;
  chartType: TChartType | "";
  state: ChartBuilderState;
  initialQuery?: TChartQuery;
  onChartGenerated?: (data: AnalyticsResponse) => void;
}

export interface UseChartQueryReturn {
  chartData: TChartDataRow[] | null;
  query: TChartQuery | null;
  isLoading: boolean;
  error: string | null;
  runQuery: () => void;
}

export function useChartQuery({
  environmentId,
  chartType,
  state,
  initialQuery,
  onChartGenerated,
}: Readonly<UseChartQueryProps>): UseChartQueryReturn {
  const { t } = useTranslation();
  const onChartGeneratedRef = useRef(onChartGenerated);
  onChartGeneratedRef.current = onChartGenerated;

  const [queryState, dispatch] = useReducer(queryReducer, {
    ...initialQueryState,
    query: initialQuery || null,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const isFirstRun = useRef(true);

  const handleQueryResult = (
    result: Awaited<ReturnType<typeof executeQueryAction>>,
    cubeQuery: TChartQuery,
    chartType: TChartType | "",
    requestId: number,
    options: { showToast?: boolean } = {}
  ) => {
    if (requestId !== requestIdRef.current) return;
    if (result?.serverError) {
      const errorMsg = getFormattedErrorMessage(result);
      dispatch({ type: "QUERY_ERROR", payload: errorMsg });
      if (options.showToast) toast.error(errorMsg);
      return;
    }
    const data = Array.isArray(result?.data) ? result.data : [];
    if (data.length === 0) {
      const noDataMsg = t("environments.analysis.charts.no_data_returned");
      dispatch({ type: "QUERY_ERROR", payload: noDataMsg });
      if (options.showToast) toast.error(noDataMsg);
      return;
    }
    dispatch({ type: "QUERY_SUCCESS", payload: { data, query: cubeQuery } });
    if (options.showToast) toast.success(t("environments.analysis.charts.query_executed_successfully"));
    if (onChartGeneratedRef.current && chartType) {
      onChartGeneratedRef.current({ query: cubeQuery, chartType, data });
    }
  };

  // Auto-query when state changes (skip mount — no query until the user changes something)
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (!chartType || state.selectedMeasures.length === 0) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const updatedQuery = buildCubeQuery(state);
      const requestId = ++requestIdRef.current;
      dispatch({ type: "QUERY_START" });

      executeQueryAction({ environmentId, query: updatedQuery })
        .then((result) => {
          handleQueryResult(result, updatedQuery, chartType, requestId);
        })
        .catch((err: unknown) => {
          if (requestId !== requestIdRef.current) return;
          const message =
            err instanceof Error ? err.message : t("environments.analysis.charts.failed_to_execute_query");
          dispatch({ type: "QUERY_ERROR", payload: message });
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onChartGenerated via ref
  }, [
    chartType,
    state.selectedMeasures,
    state.selectedDimensions,
    state.filters,
    state.filterLogic,
    state.timeDimension,
    environmentId,
  ]);

  const runQuery = () => {
    if (!chartType) {
      toast.error(t("environments.analysis.charts.please_select_chart_type"));
      return;
    }
    if (state.selectedMeasures.length === 0) {
      toast.error(t("environments.analysis.charts.please_select_at_least_one_measure"));
      return;
    }

    dispatch({ type: "QUERY_START" });
    const cubeQuery = buildCubeQuery(state);
    const requestId = ++requestIdRef.current;

    executeQueryAction({ environmentId, query: cubeQuery })
      .then((result) => {
        handleQueryResult(result, cubeQuery, chartType, requestId, { showToast: true });
      })
      .catch((err: unknown) => {
        if (requestId !== requestIdRef.current) return;
        const message =
          err instanceof Error ? err.message : t("environments.analysis.charts.failed_to_execute_query");
        dispatch({ type: "QUERY_ERROR", payload: message });
        toast.error(message);
      });
  };

  return {
    chartData: queryState.chartData,
    query: queryState.query,
    isLoading: queryState.isLoading,
    error: queryState.error,
    runQuery,
  };
}
