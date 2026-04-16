import { useEffect, useState } from "react";
import { TOrganizationBilling } from "@formbricks/types/organizations";
import { getOrganizationBillingInfoAction } from "./actions";

export const useGetBillingInfo = (organizationId: string) => {
  const [billingInfo, setBillingInfo] = useState<TOrganizationBilling>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let isMounted = true;

    const getBillingInfo = async () => {
      if (isMounted) {
        setBillingInfo(undefined);
        setIsLoading(true);
        setError("");
      }

      try {
        const billingResponse = await getOrganizationBillingInfoAction({ organizationId });

        if (!billingResponse?.data) {
          throw new Error(`Missing billing record for organization ${organizationId}`);
        }

        if (isMounted) {
          setBillingInfo(billingResponse.data);
        }
      } catch (err) {
        if (isMounted) {
          setBillingInfo(undefined);
          setError(err instanceof Error ? err.message : "Failed to fetch billing info");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void getBillingInfo();

    return () => {
      isMounted = false;
    };
  }, [organizationId]);

  return { billingInfo, isLoading, error };
};
