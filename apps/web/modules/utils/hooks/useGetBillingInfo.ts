import { useQuery } from "@tanstack/react-query";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { organizationBillingQueryOptions } from "./lib/billing-query";

/**
 * The organization's plan limits, or an error for a caller who may not see billing. Every file upload
 * question in the editor shares the one cached request.
 */
export const useGetBillingInfo = (organizationId: string) => {
  const { data, isLoading, error } = useQuery(organizationBillingQueryOptions(organizationId));

  return {
    billingInfo: data,
    isLoading,
    error: error ? getV3ApiErrorMessage(error, "Failed to fetch billing info") : "",
  };
};
