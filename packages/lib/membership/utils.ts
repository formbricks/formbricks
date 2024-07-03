import "server-only";
import { AuthorizationError } from "@formbricks/types/errors";
import { TMembershipRole } from "@formbricks/types/memberships";
import { getMembershipByUserIdOrganizationId } from "./service";

export const getAccessFlags = (role?: TMembershipRole) => {
  const isAdmin = role === "admin";
  const isEditor = role === "editor";
  const isOwner = role === "owner";
  const isDeveloper = role === "developer";
  const isViewer = role === "viewer";

  return {
    isAdmin,
    isEditor,
    isOwner,
    isDeveloper,
    isViewer,
  };
};

export const getMembershipRole = async (userId: string, organizationId: string) => {
  const membership = await getMembershipByUserIdOrganizationId(userId, organizationId);
  if (!membership) {
    throw new AuthorizationError("Not authorized");
  }

  return membership.role;
};
