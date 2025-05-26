"use client";

import { useResponseFilter } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { getResponseCountAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { getFormattedFilters } from "@/app/lib/surveys/surveys";
import { getResponseCountBySurveySharingKeyAction } from "@/app/share/[sharingKey]/actions";
import { useParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { logger } from "@formbricks/logger";
import { TSurvey } from "@formbricks/types/surveys/types";

interface ResponseCountContextType {
  responseCount: number | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateOptimistically: (newCount: number) => void;
}

const ResponseCountContext = createContext<ResponseCountContextType | undefined>(undefined);

interface ResponseCountProviderProps {
  children: React.ReactNode;
  survey: TSurvey;
  initialCount?: number;
}

// Enterprise-ready configuration
const CACHE_TTL = 30000; // 30 seconds cache
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second base delay

export const ResponseCountProvider = ({ children, survey, initialCount }: ResponseCountProviderProps) => {
  const [responseCount, setResponseCount] = useState<number | null>(initialCount ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  // Request deduplication
  const pendingRequests = useRef<Map<string, Promise<any>>>(new Map());
  const abortController = useRef<AbortController | null>(null);

  const { selectedFilter, dateRange } = useResponseFilter();
  const params = useParams();
  const sharingKey = params.sharingKey as string;
  const isSharingPage = !!sharingKey;

  const filters = useMemo(
    () => getFormattedFilters(survey, selectedFilter, dateRange),
    [selectedFilter, dateRange, survey]
  );

  // Check if cache is still valid
  const isCacheValid = useCallback(() => {
    if (!lastFetched) return false;
    return Date.now() - lastFetched < CACHE_TTL;
  }, [lastFetched]);

  // Retry logic with exponential backoff
  const fetchWithRetry = useCallback(
    async (fetchFn: () => Promise<any>, retries = MAX_RETRIES): Promise<any> => {
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          return await fetchFn();
        } catch (error) {
          if (attempt === retries - 1) throw error;

          // Exponential backoff
          const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    },
    []
  );

  // Request deduplication wrapper
  const fetchWithDeduplication = useCallback(
    async (key: string, fetchFn: () => Promise<any>) => {
      if (pendingRequests.current.has(key)) {
        return pendingRequests.current.get(key);
      }

      const promise = fetchWithRetry(fetchFn);
      pendingRequests.current.set(key, promise);

      try {
        const result = await promise;
        return result;
      } finally {
        pendingRequests.current.delete(key);
      }
    },
    [fetchWithRetry]
  );

  const fetchResponseCount = useCallback(
    async (forceRefresh = false) => {
      // Check cache first (unless force refresh)
      if (!forceRefresh && isCacheValid() && responseCount !== null) {
        return;
      }

      // Cancel any pending request
      if (abortController.current) {
        abortController.current.abort();
      }
      abortController.current = new AbortController();

      setIsLoading(true);
      setError(null);

      try {
        const requestKey = JSON.stringify({
          surveyId: survey.id,
          filters,
          isSharingPage,
          sharingKey,
        });

        const fetchFn = () => {
          if (isSharingPage) {
            return getResponseCountBySurveySharingKeyAction({
              sharingKey,
              filterCriteria: filters,
            });
          }
          return getResponseCountAction({
            surveyId: survey.id,
            filterCriteria: filters,
          });
        };

        const result = await fetchWithDeduplication(requestKey, fetchFn);

        if (result?.data !== undefined) {
          setResponseCount(result.data);
          setLastFetched(Date.now());
          setError(null);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (err) {
        // Don't set error if request was aborted (component unmounted)
        if (err instanceof Error && err.name !== "AbortError") {
          logger.error(err, "Failed to fetch response count");
          setError(err.message || "Failed to fetch response count");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [survey.id, filters, isSharingPage, sharingKey, isCacheValid, responseCount, fetchWithDeduplication]
  );

  // Optimistic updates for better UX
  const updateOptimistically = useCallback((newCount: number) => {
    setResponseCount(newCount);
    // Invalidate cache to force refresh on next fetch
    setLastFetched(null);
  }, []);

  // Refetch function for manual refresh
  const refetch = useCallback(async () => {
    await fetchResponseCount(true);
  }, [fetchResponseCount]);

  // Auto-fetch when filters change
  useEffect(() => {
    fetchResponseCount();
  }, [fetchResponseCount]);

  // Cleanup on unmount
  useEffect(() => {
    const currentPendingRequests = pendingRequests.current;
    const currentAbortController = abortController.current;

    return () => {
      if (currentAbortController) {
        currentAbortController.abort();
      }
      // Clear pending requests
      currentPendingRequests.clear();
    };
  }, []);

  const contextValue: ResponseCountContextType = {
    responseCount,
    isLoading,
    error,
    refetch,
    updateOptimistically,
  };

  return <ResponseCountContext.Provider value={contextValue}>{children}</ResponseCountContext.Provider>;
};

export const useResponseCountContext = () => {
  const context = useContext(ResponseCountContext);
  if (context === undefined) {
    throw new Error("useResponseCountContext must be used within a ResponseCountProvider");
  }
  return context;
};
