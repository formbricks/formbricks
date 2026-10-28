import { QueryClient, defaultShouldDehydrateQuery } from "@tanstack/react-query";
import { retryUnlessClientError, v3RetryDelay } from "@/modules/api/lib/v3-client";

/**
 * How long fetched data counts as fresh. Non-zero so data a server component prefetched and hydrated is not
 * refetched the moment the page mounts — the round trip the prefetch exists to save.
 */
export const QUERY_STALE_TIME_MS = 30_000;

const MAX_QUERY_RETRIES = 3;

/**
 * The house retry rule for reads, also for a query that has to carry it itself (one rendered under a client
 * without these defaults): retry a request that got no answer or a 5xx, never a 4xx, which answers the
 * same way every time, except a 429 asking for a few seconds' wait (see `retryUnlessClientError`).
 */
export const QUERY_RETRY = {
  retry: retryUnlessClientError(MAX_QUERY_RETRIES),
  retryDelay: v3RetryDelay,
} as const;

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
      queries: { staleTime: QUERY_STALE_TIME_MS, ...QUERY_RETRY },
      dehydrate: {
        // Also hand over queries still pending when the server finished rendering, so a prefetch that was
        // not awaited streams in instead of being fetched again.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
    },
  });
