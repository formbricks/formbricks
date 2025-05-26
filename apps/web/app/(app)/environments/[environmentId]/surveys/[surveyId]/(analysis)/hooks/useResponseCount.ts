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

  // Use a ref to track the current abort controller
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setIsLoading(true);
      try {
        let count;

        if (isSharingPage) {
          count = await getResponseCountBySurveySharingKeyAction({
            sharingKey,
            filterCriteria: filters,
          });
        } else {
          count = await getResponseCountAction({
            surveyId: survey.id,
            filterCriteria: filters,
          });
        }

        // Check if this request was cancelled
        if (abortController.signal.aborted) {
          return;
        }

        const responseCount = count?.data ?? 0;
        setResponseCount(responseCount);
      } catch (error) {
        // Don't log errors for cancelled requests
        if (!abortController.signal.aborted) {
          console.error("Error fetching response count:", error);
        }
      } finally {
        // Only update loading state if this request wasn't cancelled
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    // Cleanup function to cancel any pending requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [filters, isSharingPage, sharingKey, survey.id]);

  const refetch = useCallback(async () => {
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    try {
      let count;

      if (isSharingPage) {
        count = await getResponseCountBySurveySharingKeyAction({
          sharingKey,
          filterCriteria: filters,
        });
      } else {
        count = await getResponseCountAction({
          surveyId: survey.id,
          filterCriteria: filters,
        });
      }

      // Check if this request was cancelled
      if (abortController.signal.aborted) {
        return;
      }

      const responseCount = count?.data ?? 0;
      setResponseCount(responseCount);
    } catch (error) {
      // Don't log errors for cancelled requests
      if (!abortController.signal.aborted) {
        console.error("Error fetching response count:", error);
      }
    } finally {
      // Only update loading state if this request wasn't cancelled
      if (!abortController.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [filters, isSharingPage, sharingKey, survey.id]);

  return {
    responseCount,
    isLoading,
    refetch,
  };
};
