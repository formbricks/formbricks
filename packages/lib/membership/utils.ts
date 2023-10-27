import { TMembershipRole } from "@formbricks/types/memberships";

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
