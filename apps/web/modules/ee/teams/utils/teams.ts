import { PermissionLevel, TeamRole } from "@prisma/client";

export const TeamPermissionMapping = {
  [PermissionLevel.read]: "Read",
  [PermissionLevel.readWrite]: "Read & write",
  [PermissionLevel.manage]: "Manage",
};

export const TeamRoleMapping = {
  [TeamRole.admin]: "Admin",
  [TeamRole.contributor]: "Contributor",
};

export const getTeamAccessFlags = (role?: TeamRole | null) => {
  const isAdmin = role === TeamRole.admin;
  const isContributor = role === TeamRole.contributor;

  return {
    isAdmin,
    isContributor,
  };
};

export const getTeamPermissionFlags = (permissionLevel?: PermissionLevel | null) => {
  const hasReadAccess = permissionLevel === PermissionLevel.read;
  const hasReadWriteAccess = permissionLevel === PermissionLevel.readWrite;
  const hasManageAccess = permissionLevel === PermissionLevel.manage;

  return {
    hasReadAccess,
    hasReadWriteAccess,
    hasManageAccess,
  };
};
