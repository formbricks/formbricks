import { QueryClient, defaultShouldDehydrateQuery } from "@tanstack/react-query";
import { V3ApiError } from "@/modules/api/lib/v3-client";

/**
 * How long fetched data counts as fresh. Non-zero so data a server component prefetched and hydrated is not
 * refetched the moment the page mounts — the round trip the prefetch exists to save.
 */
export const QUERY_STALE_TIME_MS = 30_000;

const MAX_QUERY_RETRIES = 2;

/**
 * Retry a failed read only when retrying can help: a network failure or a 5xx. A 4xx (forbidden, invalid
 * input, not authenticated) answers the same way every time, so retrying it only delays the error the user
 * needs to see.
 */
export const shouldRetryQuery = (failureCount: number, error: unknown): boolean => {
  if (error instanceof V3ApiError && error.status < 500) return false;
  return failureCount < MAX_QUERY_RETRIES;
};

/**
 * The app's `QueryClient` with house defaults, for client providers and for server-side prefetching alike,
 * so a hydrated cache and a client-side one behave the same.
 *
 * Mutations keep TanStack's default of no retries: a write the server may already have applied must not be
 * sent twice behind the user's back.
 */
export const makeQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { staleTime: QUERY_STALE_TIME_MS, retry: shouldRetryQuery },
      dehydrate: {
        // Also hand over queries still pending when the server finished rendering, so a prefetch that was
        // not awaited streams in instead of being fetched again.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
    },
  });
