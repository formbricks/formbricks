import { queryOptions } from "@tanstack/react-query";
import { listApiKeys } from "./api-client";

export const apiKeyKeys = {
  all: ["api-keys"] as const,
  list: (organizationId: string) => [...apiKeyKeys.all, "list", organizationId] as const,
};

/**
 * The organization's keys. Shared by the client hook and the page's server prefetch, so both read and fill
 * the same cache entry. On the server, `queryFn` is replaced with a direct read (see `page.tsx`).
 */
export const apiKeyListQueryOptions = (organizationId: string) =>
  queryOptions({
    queryKey: apiKeyKeys.list(organizationId),
    queryFn: ({ signal }) => listApiKeys({ organizationId, signal }),
  });
