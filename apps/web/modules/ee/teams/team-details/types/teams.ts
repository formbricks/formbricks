import { ZTeamPermission } from "@/modules/ee/teams/product-teams/types/teams";
import { ZTeamRole } from "@/modules/ee/teams/team-list/types/teams";
import { z } from "zod";

export const ZTeamMember = z.object({
  role: ZTeamRole,
  id: z.string(),
  name: z.string(),
  email: z.string(),
  isRoleEditable: z.boolean(),
});

export type TTeamMember = z.infer<typeof ZTeamMember>;

export const ZTeam = z.object({
  id: z.string(),
  name: z.string({ message: "Team name is required" }).trim().min(1, {
    message: "Team name must be at least 1 character long",
  }),
  teamUsers: z.array(ZTeamMember),
});

export type TTeam = z.infer<typeof ZTeam>;

export const ZOrganizationMember = z.object({
  id: z.string(),
  name: z.string(),
});
export type TOrganizationMember = z.infer<typeof ZOrganizationMember>;

export const TTeamProduct = z.object({
  id: z.string(),
  name: z.string(),
  permission: ZTeamPermission,
});
export type TTeamProduct = z.infer<typeof TTeamProduct>;

export const ZOrganizationProduct = z.object({
  id: z.string(),
  name: z.string(),
});

export type TOrganizationProduct = z.infer<typeof ZOrganizationProduct>;
