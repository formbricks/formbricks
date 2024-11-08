import { ProductTeamPermission, TeamUserRole } from "@prisma/client";

export const TeamPermissionMapping = {
  [ProductTeamPermission.read]: "Read",
  [ProductTeamPermission.readWrite]: "Read & write",
  [ProductTeamPermission.manage]: "Manage",
};

export const TeamRoleMapping = {
  [TeamUserRole.admin]: "Team Admin",
  [TeamUserRole.contributor]: "Contributor",
};

export const getTeamAccessFlags = (role?: TeamUserRole | null) => {
  const isAdmin = role === TeamUserRole.admin;
  const isContributor = role === TeamUserRole.contributor;

  return {
    isAdmin,
    isContributor,
  };
};

export const getTeamPermissionFlags = (permissionLevel?: ProductTeamPermission | null) => {
  const hasReadAccess = permissionLevel === ProductTeamPermission.read;
  const hasReadWriteAccess = permissionLevel === ProductTeamPermission.readWrite;
  const hasManageAccess = permissionLevel === ProductTeamPermission.manage;

  return {
    hasReadAccess,
    hasReadWriteAccess,
    hasManageAccess,
  };
};
