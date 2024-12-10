import { z } from "zod";
import { ZId } from "@formbricks/types/common";

export const ZTeamRole = z.enum(["admin", "contributor"]);
export type TTeamRole = z.infer<typeof ZTeamRole>;

export const ZUserTeam = z.object({
  id: ZId,
  name: z.string(),
  userRole: ZTeamRole,
  memberCount: z.number(),
});

export type TUserTeam = z.infer<typeof ZUserTeam>;

export const ZOtherTeam = z.object({
  id: ZId,
  name: z.string(),
  memberCount: z.number(),
});

export type TOtherTeam = z.infer<typeof ZOtherTeam>;

export const ZOrganizationTeam = z.object({
  id: z.string().cuid2(),
  name: z.string(),
});

export type TOrganizationTeam = z.infer<typeof ZOrganizationTeam>;
