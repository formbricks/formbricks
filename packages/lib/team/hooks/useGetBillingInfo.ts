import { useEffect, useState } from "react";

import { TTeamBilling } from "@formbricks/types/teams";

import { getTeamBillingInfoAction } from "./actions";

export const useGetBillingInfo = (teamId: string) => {
  const [billingInfo, setBillingInfo] = useState<TTeamBilling>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const getBillingInfo = async () => {
      try {
        setIsLoading(true);
        const billingInfo = await getTeamBillingInfoAction(teamId);

        if (!billingInfo) {
          setError("No billing info found");
          setIsLoading(false);
          return;
        }

        setIsLoading(false);
        setBillingInfo(billingInfo);
      } catch (err: any) {
        setIsLoading(false);
        setError(err.message);
      }
    };

    getBillingInfo();
  }, [teamId]);

  return { billingInfo, isLoading, error };
};
