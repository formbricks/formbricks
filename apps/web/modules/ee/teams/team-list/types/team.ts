import { ZTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
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
  members: z
    .array(
      z.object({
        userId: z.string().trim().min(1, "Please select a member"),
        role: ZTeamRole,
      })
    )
    .min(1, { message: "Please add at least one member" }),
  projects: z
    .array(
      z.object({
        projectId: z.string().trim().min(1, "Please select a project"),
        permission: ZTeamPermission,
      })
    )
    .min(1, { message: "Please add at least one project" }),
});

export type TTeamSettingsFormSchema = z.infer<typeof ZTeamSettingsFormSchema>;

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
