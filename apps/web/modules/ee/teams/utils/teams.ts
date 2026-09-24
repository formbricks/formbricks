import { type TTeamRole, ZTeamRole } from "@/modules/ee/teams/team-list/types/team";
import { type TTeamPermission, ZTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";

/** Translation keys rather than labels, so the permission column renders in the viewer's language. */
export const TeamPermissionTranslationKeys = {
  [ZTeamPermission.enum.read]: "workspace.settings.teams.read",
  [ZTeamPermission.enum.readWrite]: "workspace.settings.teams.read_write",
  [ZTeamPermission.enum.manage]: "workspace.settings.teams.manage",
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
