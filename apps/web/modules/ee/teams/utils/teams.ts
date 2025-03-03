import { ProjectTeamPermission, TeamUserRole } from "@prisma/client";

export const TeamPermissionMapping = {
  [ProjectTeamPermission.read]: "Read",
  [ProjectTeamPermission.readWrite]: "Read & write",
  [ProjectTeamPermission.manage]: "Manage",
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

export const getTeamPermissionFlags = (permissionLevel?: ProjectTeamPermission | null) => {
  const hasReadAccess = permissionLevel === ProjectTeamPermission.read;
  const hasReadWriteAccess = permissionLevel === ProjectTeamPermission.readWrite;
  const hasManageAccess = permissionLevel === ProjectTeamPermission.manage;

  return {
    hasReadAccess,
    hasReadWriteAccess,
    hasManageAccess,
  };
};
