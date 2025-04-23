import { TOrganizationRole } from "@formbricks/types/memberships";

export const getAccessFlags = (role?: TOrganizationRole) => {
  const isOwner = role === "owner";
  const isManager = role === "manager";
  const isBilling = role === "billing";
  const isMember = role === "member";

  return {
    isManager,
    isOwner,
    isBilling,
    isMember,
  };
};
