import { useState, useEffect } from "react";
import { findUserMembershipRoleAction } from "./actions";

enum MembershipRole {
  Owner = "owner",
  Admin = "admin",
  Editor = "editor",
  Developer = "developer",
  Viewer = "viewer",
}

export default function useFindUserMembershipRole(environmentId: string) {
  const [membershipRole, setMembershipRole] = useState<MembershipRole>();

  useEffect(() => {
    const getRole = async () => {
      const role = await findUserMembershipRoleAction(environmentId);
      setMembershipRole(role as MembershipRole);
    };
    getRole();
  }, [environmentId]);

  return [membershipRole];
}
