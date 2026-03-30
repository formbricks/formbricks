import { type TTeamPermission, ZTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { type TTeamRole, ZTeamRole } from "@/modules/ee/teams/team-list/types/team";

export const TeamPermissionMapping = {
  [ZTeamPermission.enum.read]: "Read",
  [ZTeamPermission.enum.readWrite]: "Read & write",
  [ZTeamPermission.enum.manage]: "Manage",
};

export const TeamRoleMapping = {
  [ZTeamRole.enum.admin]: "Team Admin",
  [ZTeamRole.enum.contributor]: "Contributor",
};

export const getTeamAccessFlags = (role?: TTeamRole | null) => {
  const isAdmin = role === ZTeamRole.enum.admin;
  const isContributor = role === ZTeamRole.enum.contributor;

  return {
    isAdmin,
    isContributor,
  };
};

export const getTeamPermissionFlags = (permissionLevel?: TTeamPermission | null) => {
  const hasReadAccess = permissionLevel === ZTeamPermission.enum.read;
  const hasReadWriteAccess = permissionLevel === ZTeamPermission.enum.readWrite;
  const hasManageAccess = permissionLevel === ZTeamPermission.enum.manage;

  return {
    hasReadAccess,
    hasReadWriteAccess,
    hasManageAccess,
  };
};
