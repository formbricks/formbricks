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

export const getUserManagementAccess = (
  role: TOrganizationRole,
  minimumRole: "owner" | "manager" | "disabled"
): boolean => {
  // If minimum role is "disabled", no one has access
  if (minimumRole === "disabled") {
    return false;
  }
  if (minimumRole === "owner") {
    return role === "owner";
  }

  if (minimumRole === "manager") {
    return role === "owner" || role === "manager";
  }
  return false;
};
