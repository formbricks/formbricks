"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TChartQuery } from "@formbricks/types/analysis";
import { getChartApiErrorMessage, previewChart } from "@/modules/ee/analysis/lib/api-client";
import type { TChartDataRow, TChartLabelMaps, TChartType } from "@/modules/ee/analysis/types/analysis";

export interface QueryResult extends TChartLabelMaps {
  /** The effective (server-rewritten) query used by Cube. May differ from the query the user
   * built when resolveOptionGrouping rewrote a value dimension (e.g. valueText → valueId for
   * single-select). Renderers must use this so xAxisKey matches the returned data keys. */
  query: TChartQuery;
  data: TChartDataRow[];
}

/** The chart builder's live preview, through `POST /api/v3/charts/preview`. */
export function useChartQuery(
  workspaceId: string,
  feedbackDirectoryId: string | null,
  initialQuery?: TChartQuery
) {
  const { t } = useTranslation();
  const [chartData, setChartData] = useState<TChartDataRow[] | null>(null);
  const [query, setQuery] = useState<TChartQuery | null>(initialQuery ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Queries run reactively while the user edits the config; only the latest response may win, and the
  // superseded request is aborted rather than left to finish.
  const runSeqRef = useRef(0);
  const inFlightRef = useRef<AbortController | null>(null);

  useEffect(() => {
    runSeqRef.current++;
    inFlightRef.current?.abort();
  }, [workspaceId, feedbackDirectoryId]);

  useEffect(() => () => inFlightRef.current?.abort(), []);

  const runQuery = async (cubeQuery: TChartQuery, chartType: TChartType): Promise<QueryResult | null> => {
    if (!feedbackDirectoryId) {
      setError(t("workspace.analysis.charts.select_data_source_first"));
      return null;
    }

    const seq = ++runSeqRef.current;
    inFlightRef.current?.abort();
    const controller = new AbortController();
    inFlightRef.current = controller;
    setIsLoading(true);
    setError(null);

    try {
      const result = await previewChart({
        workspaceId,
        datasetId: feedbackDirectoryId,
        type: chartType,
        query: cubeQuery,
        signal: controller.signal,
      });
      if (seq !== runSeqRef.current) return null;

      // The server-rewritten effective query, so the renderer's xAxisKey matches the actual data
      // columns (e.g. valueText → valueId after a single-select rewrite).
      setChartData(result.rows);
      setQuery(result.query);
      return {
        query: result.query,
        data: result.rows,
        ...(result.optionLabels ? { optionLabels: result.optionLabels } : {}),
        ...(result.fieldLabels ? { fieldLabels: result.fieldLabels } : {}),
        ...(result.memberLabels ? { memberLabels: result.memberLabels } : {}),
      };
    } catch (err: unknown) {
      if (seq !== runSeqRef.current) return null;
      setError(getChartApiErrorMessage(err, t("workspace.analysis.charts.failed_to_execute_query")));
      return null;
    } finally {
      if (seq === runSeqRef.current) {
        setIsLoading(false);
      }
    }
  };

  return { chartData, query, isLoading, error, runQuery };
}
