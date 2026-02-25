"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TChartQuery } from "@formbricks/types/analysis";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { executeQueryAction } from "@/modules/ee/analysis/charts/actions";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";

export interface QueryResult {
  query: TChartQuery;
  data: TChartDataRow[];
}

export function useChartQuery(environmentId: string, initialQuery?: TChartQuery) {
  const { t } = useTranslation();
  const [chartData, setChartData] = useState<TChartDataRow[] | null>(null);
  const [query, setQuery] = useState<TChartQuery | null>(initialQuery ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runQuery = async (cubeQuery: TChartQuery): Promise<QueryResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await executeQueryAction({ environmentId, query: cubeQuery });

      if (result?.serverError) {
        const msg = getFormattedErrorMessage(result);
        setError(msg);
        toast.error(msg);
        return null;
      }

      const data = Array.isArray(result?.data) ? result.data : [];
      if (data.length === 0) {
        const msg = t("environments.analysis.charts.no_data_returned");
        setError(msg);
        toast.error(msg);
        return null;
      }

      setChartData(data);
      setQuery(cubeQuery);
      toast.success(t("environments.analysis.charts.query_executed_successfully"));
      return { query: cubeQuery, data };
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : t("environments.analysis.charts.failed_to_execute_query");
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { chartData, query, isLoading, error, runQuery };
}
