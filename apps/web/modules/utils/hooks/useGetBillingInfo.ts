import { useEffect, useState } from "react";
import { TOrganizationBilling } from "@formbricks/types/organizations";
import { getOrganizationBillingInfoAction } from "./actions";

export const useGetBillingInfo = (organizationId: string | undefined) => {
  const [billingInfo, setBillingInfo] = useState<TOrganizationBilling>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    // Skip fetching if organizationId is not provided
    if (!organizationId) {
      return;
    }

    const getBillingInfo = async () => {
      try {
        setIsLoading(true);
        const billingInfo = await getOrganizationBillingInfoAction({ organizationId });

        if (billingInfo?.data) {
          setIsLoading(false);
          setBillingInfo(billingInfo.data);
        }

        setError("No billing info found");
        setIsLoading(false);
      } catch (err: any) {
        setIsLoading(false);
        setError(err.message);
      }
    };

    getBillingInfo();
  }, [organizationId]);

  return { billingInfo, isLoading, error };
};
