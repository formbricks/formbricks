import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const ZTeamPermission = z.enum(["read", "readWrite", "manage"]);
export type TTeamPermission = z.infer<typeof ZTeamPermission>;

export const ZProjectTeam = z.object({
  id: ZId,
  name: z.string(),
  memberCount: z.number(),
  permission: ZTeamPermission,
});

export type TProjectTeam = z.infer<typeof ZProjectTeam>;

export const TOrganizationTeam = z.object({
  id: ZId,
  name: z.string(),
});

export type TOrganizationTeam = z.infer<typeof TOrganizationTeam>;
