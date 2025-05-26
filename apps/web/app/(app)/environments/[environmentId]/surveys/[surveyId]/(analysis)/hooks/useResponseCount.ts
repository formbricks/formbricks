"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { getResponseCountAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import { getResponseCountBySurveySharingKeyAction } from "@/app/share/[sharingKey]/actions";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TSurvey } from "@formbricks/types/surveys/types";

interface UseResponseCountProps {
  survey: TSurvey;
  initialCount?: number;
}

export const useResponseCount = ({ survey, initialCount = 0 }: UseResponseCountProps) => {
  const params = useParams();
  const sharingKey = params.sharingKey as string;
  const isSharingPage = !!sharingKey;

  const [responseCount, setResponseCount] = useState<number | null>(initialCount);
  const [isLoading, setIsLoading] = useState(false);

  const { selectedFilter, dateRange } = useResponseFilter();

  const filters = useMemo(
    () => getFormattedFilters(survey, selectedFilter, dateRange),
    [selectedFilter, dateRange, survey]
  );

  // Use a ref to keep the latest state and props
  const latestFiltersRef = useRef(filters);
  latestFiltersRef.current = filters;

  const getResponseCount = useCallback(() => {
    if (isSharingPage)
      return getResponseCountBySurveySharingKeyAction({
        sharingKey,
        filterCriteria: latestFiltersRef.current,
      });
    return getResponseCountAction({
      surveyId: survey.id,
      filterCriteria: latestFiltersRef.current,
    });
  }, [isSharingPage, sharingKey, survey.id]);

  const fetchResponseCount = useCallback(async () => {
    setIsLoading(true);
    try {
      const count = await getResponseCount();
      const responseCount = count?.data ?? 0;
      setResponseCount(responseCount);
    } catch (error) {
      console.error("Error fetching response count:", error);
    } finally {
      setIsLoading(false);
    }
  }, [getResponseCount]);

  useEffect(() => {
    fetchResponseCount();
  }, [filters, isSharingPage, sharingKey, survey.id, fetchResponseCount]);

  return {
    responseCount,
    isLoading,
    refetch: fetchResponseCount,
  };
};
