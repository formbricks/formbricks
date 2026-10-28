import { queryOptions } from "@tanstack/react-query";
import type { TOrganizationBillingLimitsResource } from "@/app/api/internal/organizations/[organizationId]/billing/serializers";
import { getApiData } from "@/modules/api/lib/internal-api-client";
import { QUERY_RETRY, QUERY_STALE_TIME_MS } from "@/modules/api/lib/query-client";

export const organizationBillingKeys = {
  all: ["organization-billing"] as const,
  detail: (organizationId: string) => [...organizationBillingKeys.all, organizationId] as const,
};

/**
 * The organization's plan limits. Carries the house retry rule itself: the survey editor renders it under
 * a query client without those defaults, and a 403 (a member who may not see billing) must not be retried.
 */
export const organizationBillingQueryOptions = (organizationId: string) =>
  queryOptions({
    queryKey: organizationBillingKeys.detail(organizationId),
    queryFn: ({ signal }) =>
      getApiData<TOrganizationBillingLimitsResource>(
        `/api/internal/organizations/${encodeURIComponent(organizationId)}/billing`,
        { signal }
      ),
    staleTime: QUERY_STALE_TIME_MS,
    ...QUERY_RETRY,
  });
