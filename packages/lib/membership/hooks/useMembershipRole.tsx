import { useEffect, useState } from "react";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { getMembershipByUserIdOrganizationIdAction } from "./actions";

export const useMembershipRole = (environmentId: string, userId: string) => {
  const [membershipRole, setMembershipRole] = useState<TOrganizationRole>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const getRole = async () => {
      try {
        setIsLoading(true);
        const role = await getMembershipByUserIdOrganizationIdAction(environmentId, userId);
        setMembershipRole(role);
        setIsLoading(false);
      } catch (err: any) {
        const error = err?.message || "Something went wrong";
        setError(error);
      }
    };
    getRole();
  }, [environmentId, userId]);

  return { membershipRole, isLoading, error };
};
