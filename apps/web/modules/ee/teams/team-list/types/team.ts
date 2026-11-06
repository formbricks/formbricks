import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZOrganizationRole } from "@formbricks/types/memberships";
import { ZTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";

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
  id: z.cuid2(),
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
  workspaces: z.array(
    z.object({
      workspaceId: ZId,
      workspaceName: z.string(),
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

/** Bounds every request string (ENG-1652); ids are cuids, far shorter than this. */
export const TEAM_NAME_MAX = 255;
const ID_MAX = 255;

export const ZTeamSettingsFormSchema = z.object({
  name: z.string().trim().min(1, "Team name is required").max(TEAM_NAME_MAX),
  members: z
    .array(
      z.object({
        userId: z.string().trim().min(1, "Please select a member").max(ID_MAX),
        role: ZTeamRole,
      })
    )
    .min(1, {
      error: "Please add at least one member",
    }),
  workspaces: z
    .array(
      z.object({
        workspaceId: z.string().trim().min(1, "Please select a workspace").max(ID_MAX),
        permission: ZTeamPermission,
      })
    )
    .min(1, {
      error: "Please add at least one workspace",
    }),
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
  name: z
    .string({
      error: "Team name is required",
    })
    .trim()
    .min(1, {
      error: "Team name must be at least 1 character long",
    }),
  teamUsers: z.array(ZTeamMember),
});

export type TTeam = z.infer<typeof ZTeam>;
