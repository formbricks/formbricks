import { useEffect, useState } from "react";
import { TOrganizationBilling } from "@formbricks/types/organizations";
import { getOrganizationBillingInfoAction } from "./actions";

export const useGetBillingInfo = (organizationId: string) => {
  const [billingInfo, setBillingInfo] = useState<TOrganizationBilling>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const getBillingInfo = async () => {
      try {
        setIsLoading(true);
        setError("");
        const billingResponse = await getOrganizationBillingInfoAction({ organizationId });

        if (billingResponse?.data) {
          setBillingInfo(billingResponse.data);
          setIsLoading(false);
          return;
        }

        setError("No billing info found");
        setIsLoading(false);
      } catch (err) {
        setIsLoading(false);
        setError(err instanceof Error ? err.message : "Failed to fetch billing info");
      }
    };

    getBillingInfo();
  }, [organizationId]);

  return { billingInfo, isLoading, error };
};
