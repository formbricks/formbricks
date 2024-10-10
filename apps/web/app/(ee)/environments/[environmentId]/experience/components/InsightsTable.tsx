"use client";

import { InsightView } from "@/app/(app)/environments/[environmentId]/components/InsightView";
import { getInsightsAction } from "@/app/(ee)/environments/[environmentId]/experience/actions";
import { InsightLoading } from "@/app/(ee)/environments/[environmentId]/experience/components/InsightLoading";
import { useCallback, useEffect, useState } from "react";
import { TInsight } from "@formbricks/types/insights";
import { Button } from "@formbricks/ui/components/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@formbricks/ui/components/Card";

interface InsightsTableProps {
  environmentId: string;
  insightsPerPage: number;
}

export const InsightsTable = ({ environmentId, insightsPerPage: insightsLimit }: InsightsTableProps) => {
  const [insights, setInsights] = useState<TInsight[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [hasMore, setHasMore] = useState<boolean>(true);

  useEffect(() => {
    const fetchInitialInsights = async () => {
      setIsFetching(true);
      const res = await getInsightsAction({
        environmentId: environmentId,
        limit: insightsLimit,
        offset: undefined,
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
  }, [environmentId, insightsLimit]);

  const fetchNextPage = useCallback(async () => {
    setIsFetching(true);
    const res = await getInsightsAction({
      environmentId,
      limit: insightsLimit,
      offset: insights.length,
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
  }, [environmentId, insights, insightsLimit]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Insights for My Product</CardTitle>
        <CardDescription>All the insights generated from responses across all your surveys</CardDescription>
      </CardHeader>
      <CardContent>
        {insights.length > 0 && <InsightView insights={insights} />}
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
