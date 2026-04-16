import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const ZTeamPermission = z.enum(["read", "readWrite", "manage"]);
export type TTeamPermission = z.infer<typeof ZTeamPermission>;

export const ZWorkspaceTeam = z.object({
  id: ZId,
  name: z.string(),
  memberCount: z.number(),
  permission: ZTeamPermission,
});

export type TWorkspaceTeam = z.infer<typeof ZWorkspaceTeam>;

export const TOrganizationTeam = z.object({
  id: ZId,
  name: z.string(),
});

export type TOrganizationTeam = z.infer<typeof TOrganizationTeam>;
