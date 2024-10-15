"use client";

import { InsightView } from "@/app/(app)/environments/[environmentId]/components/InsightView";
import { getInsightsAction } from "@/app/(ee)/environments/[environmentId]/experience/actions";
import { InsightLoading } from "@/app/(ee)/environments/[environmentId]/experience/components/InsightLoading";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TDocumentFilterCriteria } from "@formbricks/types/documents";
import { TInsight, TInsightFilterCriteria } from "@formbricks/types/insights";
import { Button } from "@formbricks/ui/components/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@formbricks/ui/components/Card";

interface InsightsTableProps {
  environmentId: string;
  insightsPerPage: number;
  productName: string;
  statsFrom?: Date;
}

export const InsightsTable = ({
  statsFrom,
  environmentId,
  productName,
  insightsPerPage: insightsLimit,
}: InsightsTableProps) => {
  const [insights, setInsights] = useState<TInsight[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const insightsFilter: TInsightFilterCriteria = useMemo(
    () => ({
      documentCreatedAt: {
        min: statsFrom,
      },
    }),
    [statsFrom]
  );

  const documentsFilter: TDocumentFilterCriteria = useMemo(
    () => ({
      createdAt: {
        min: statsFrom,
      },
    }),
    [statsFrom]
  );

  useEffect(() => {
    const fetchInitialInsights = async () => {
      setIsFetching(true);
      setInsights([]);
      const res = await getInsightsAction({
        environmentId: environmentId,
        limit: insightsLimit,
        offset: undefined,
        insightsFilter,
      });
      if (res?.data) {
        if (res.data.length < insightsLimit) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }
        setInsights(res.data);
        setIsFetching(false);
      }
    };

    fetchInitialInsights();
  }, [environmentId, insightsLimit, insightsFilter]);

  const fetchNextPage = useCallback(async () => {
    setIsFetching(true);
    const res = await getInsightsAction({
      environmentId,
      limit: insightsLimit,
      offset: insights.length,
      insightsFilter,
    });
    if (res?.data) {
      if (res.data.length === 0 || res.data.length < insightsLimit) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      setInsights((prevInsights) => [...prevInsights, ...(res.data || [])]);
      setIsFetching(false);
    }
  }, [environmentId, insights, insightsLimit, insightsFilter]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Insights for {productName}</CardTitle>
        <CardDescription>All the insights generated from responses across all your surveys</CardDescription>
      </CardHeader>
      <CardContent>
        <InsightView insights={insights} documentsFilter={documentsFilter} />
        {isFetching && <InsightLoading />}
        {hasMore && (
          <div className="flex justify-center py-5">
            <Button onClick={fetchNextPage} variant="secondary" size="sm" loading={isFetching}>
              Load more
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
