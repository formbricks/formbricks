import { useEffect, useState } from "react";

import { getMembershipByUserIdTeamIdAction } from "./actions";

enum MembershipRole {
  Owner = "owner",
  Admin = "admin",
  Editor = "editor",
  Developer = "developer",
  Viewer = "viewer",
}

export const useMembershipRole = (environmentId: string) => {
  const [membershipRole, setMembershipRole] = useState<MembershipRole>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const getRole = async () => {
      try {
        setIsLoading(true);
        const role = await getMembershipByUserIdTeamIdAction(environmentId);
        setMembershipRole(role as MembershipRole);
        setIsLoading(false);
      } catch (err: any) {
        const error = err?.message || "Something went wrong";
        setError(error);
      }
    };
    getRole();
  }, [environmentId]);

  return { membershipRole, isLoading, error };
};
