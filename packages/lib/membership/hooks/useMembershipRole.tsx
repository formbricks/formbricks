import { useState, useEffect } from "react";
import { findUserMembershipRoleAction } from "./actions";

enum MembershipRole {
  Owner = "owner",
  Admin = "admin",
  Editor = "editor",
  Developer = "developer",
  Viewer = "viewer",
}

export const useMembershipRole = (environmentId: string) => {
  const [membershipRole, setMembershipRole] = useState<MembershipRole>();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const getRole = async () => {
      try {
        setLoading(true);
        const role = await findUserMembershipRoleAction(environmentId);
        setMembershipRole(role as MembershipRole);
        setLoading(false);
      } catch (err: any) {
        const error = err?.message || "Something went wrong";
        setError(error);
      }
    };
    getRole();
  }, [environmentId]);

  return { membershipRole, loading, error };
};
