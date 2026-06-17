"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TChartQuery } from "@formbricks/types/analysis";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { executeQueryAction } from "@/modules/ee/analysis/charts/actions";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";

export interface QueryResult {
  query: TChartQuery;
  data: TChartDataRow[];
}

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
  // Queries run reactively while the user edits the config; only the latest response may win.
  const runSeqRef = useRef(0);

  useEffect(() => {
    runSeqRef.current++;
  }, [workspaceId, feedbackDirectoryId]);

  const runQuery = async (cubeQuery: TChartQuery): Promise<QueryResult | null> => {
    if (!feedbackDirectoryId) {
      setError(t("workspace.analysis.charts.select_data_source_first"));
      return null;
    }

    const seq = ++runSeqRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const result = await executeQueryAction({
        workspaceId,
        query: cubeQuery,
        feedbackDirectoryId,
      });
      if (seq !== runSeqRef.current) return null;

      if (result?.serverError) {
        setError(getFormattedErrorMessage(result));
        return null;
      }

      const data = Array.isArray(result?.data) ? result.data : [];
      if (data.length === 0) {
        setError(t("workspace.analysis.charts.no_data_returned"));
        return null;
      }

      setChartData(data);
      setQuery(cubeQuery);
      return { query: cubeQuery, data };
    } catch (err: unknown) {
      if (seq !== runSeqRef.current) return null;
      setError(err instanceof Error ? err.message : t("workspace.analysis.charts.failed_to_execute_query"));
      return null;
    } finally {
      if (seq === runSeqRef.current) {
        setIsLoading(false);
      }
    }
  };

  return { chartData, query, isLoading, error, runQuery };
}
