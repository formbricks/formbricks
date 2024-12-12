import { ZTeamPermission } from "@/modules/ee/teams/project-teams/types/teams";
import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZOrganizationRole } from "@formbricks/types/memberships";

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

export const ZTeamDetails = z.object({
  id: ZId,
  name: z.string(),
  organizationId: ZId,
  members: z.array(
    z.object({
      userId: ZId,
      name: z.string(),
      role: ZTeamRole,
    })
  ),
  projects: z.array(
    z.object({
      projectId: ZId,
      projectName: z.string(),
      permission: ZTeamPermission,
    })
  ),
});

export type TTeamDetails = z.infer<typeof ZTeamDetails>;

export const ZOrganizationMember = z.object({
  id: ZId,
  name: z.string(),
  role: ZOrganizationRole,
});

export type TOrganizationMember = z.infer<typeof ZOrganizationMember>;

export const ZTeamSettingsFormSchema = z.object({
  name: z.string().trim().min(1, "Team name is required"),
  members: z.array(
    z.object({
      userId: z.string({ required_error: "Please select a user" }),
      role: ZTeamRole,
    })
  ),
  projects: z.array(
    z.object({
      projectId: z.string({ required_error: "Please select a project" }),
      permission: ZTeamPermission,
    })
  ),
});

export type TTeamSettingsFormSchema = z.infer<typeof ZTeamSettingsFormSchema>;
