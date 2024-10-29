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
