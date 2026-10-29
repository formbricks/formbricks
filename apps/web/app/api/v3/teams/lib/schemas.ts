import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { lengthBoundedArray } from "@/app/api/v3/lib/bounded-array";
import { ZTeamRole } from "@/modules/ee/teams/team-list/types/team";
import { ZTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";

const MAX_NAME_LENGTH = 255;

/** Most members or workspace grants one `update_team` call may carry: the list replaces the stored one. */
export const V3_TEAM_MAX_MEMBERS = 1000;
export const V3_TEAM_MAX_WORKSPACES = 1000;

export const ZV3TeamIdParams = z.object({ teamId: z.cuid2() }).strict();

const confirmField = z
  .boolean()
  .optional()
  .describe(
    "Must be true to apply a change that takes access away. Without it nothing is changed and the call only returns what would happen. Set it only after the person has approved this exact change."
  );

/** `create_team` body. A new team has no members and no workspace access; `update_team` fills both. */
export const ZV3TeamCreateBody = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(MAX_NAME_LENGTH)
      .describe("Name of the new team. Unique per organization."),
  })
  .strict();
export type TV3TeamCreateBody = z.infer<typeof ZV3TeamCreateBody>;

const ZV3TeamMemberInput = z
  .object({
    userId: ZId.describe("Id of an organization member. Take it from list_members."),
    role: ZTeamRole.optional().describe(
      "Role in this team: admin (manages the team) or contributor. Defaults to the role the person has now, or admin for an organization owner or manager and contributor for anyone else. Owners and managers are always admins."
    ),
  })
  .strict();

const ZV3TeamWorkspaceGrantInput = z
  .object({
    workspaceId: ZId.describe("Id of a workspace of this organization. Take it from list_workspaces."),
    permission: ZTeamPermission.describe("What the team may do in the workspace: read, readWrite or manage."),
  })
  .strict();

const hasDuplicate = (values: readonly string[]): boolean => new Set(values).size !== values.length;

/**
 * `update_team` body. Every field is optional but at least one change is required (the operation answers
 * 400 for an empty one). `members` and `workspaces` are the COMPLETE new lists, exactly like the form this
 * replaced: anyone or any workspace left out is removed from the team, and a change that takes access away
 * is previewed unless `confirm` is true.
 */
export const ZV3TeamUpdateFields = z
  .object({
    name: z.string().trim().min(1).max(MAX_NAME_LENGTH).optional().describe("New team name."),
    members: lengthBoundedArray(ZV3TeamMemberInput, {
      max: V3_TEAM_MAX_MEMBERS,
      description:
        "The team's complete member list. Omit to leave the members as they are; an empty list removes everyone.",
    }).optional(),
    workspaces: lengthBoundedArray(ZV3TeamWorkspaceGrantInput, {
      max: V3_TEAM_MAX_WORKSPACES,
      description:
        "The team's complete workspace access. Omit to leave it as it is; an empty list removes all of it. Only organization owners and managers may change it.",
    }).optional(),
    confirm: confirmField,
  })
  .strict();

/** The fields plus the rule that neither list may repeat an entry. The MCP input extends the bare fields. */
export const ZV3TeamUpdateBody = ZV3TeamUpdateFields.superRefine((body, ctx) => {
  if (body.members && hasDuplicate(body.members.map((member) => member.userId))) {
    ctx.addIssue({ code: "custom", path: ["members"], message: "A member appears more than once" });
  }
  if (body.workspaces && hasDuplicate(body.workspaces.map((grant) => grant.workspaceId))) {
    ctx.addIssue({ code: "custom", path: ["workspaces"], message: "A workspace appears more than once" });
  }
});
export type TV3TeamUpdateBody = z.infer<typeof ZV3TeamUpdateBody>;

/** `delete_team` input. On REST it arrives as the `confirm` query parameter. */
export const ZV3TeamDeleteInput = z.object({ confirm: confirmField }).strict();
export type TV3TeamDeleteInput = z.infer<typeof ZV3TeamDeleteInput>;

/** The REST query of `DELETE /api/v3/teams/{teamId}`: a query string carries `confirm` as text. */
export const ZV3TeamDeleteQuery = z
  .object({ confirm: z.enum(["true", "false"]).optional() })
  .strict()
  .transform(({ confirm }) => ({ confirm: confirm === undefined ? undefined : confirm === "true" }));

const ZV3TeamWorkspaceAccess = z.object({
  workspaceId: z.string(),
  workspaceName: z.string(),
  permission: ZTeamPermission,
});

const ZV3TeamMember = z.object({
  userId: z.string(),
  name: z.string(),
  role: ZTeamRole,
});

/**
 * One row of the team list. `workspaces` is the team's workspace access and is `null` for a caller who is
 * not an organization owner or manager, who may not see it; `viewerRole` is the caller's own role in the
 * team, `null` when they are not in it.
 */
export const ZV3TeamListItem = z.object({
  id: z.string(),
  name: z.string(),
  memberCount: z.number().int(),
  viewerRole: ZTeamRole.nullable(),
  workspaces: z.array(ZV3TeamWorkspaceAccess).nullable(),
});
export type TV3TeamListItem = z.infer<typeof ZV3TeamListItem>;

/** A team with its full member list and workspace access. */
export const ZV3TeamResource = z.object({
  id: z.string(),
  name: z.string(),
  organizationId: z.string(),
  members: z.array(ZV3TeamMember),
  workspaces: z.array(ZV3TeamWorkspaceAccess),
});
export type TV3TeamResource = z.infer<typeof ZV3TeamResource>;

const ZV3TeamRoleChange = z.object({ userId: z.string(), from: ZTeamRole, to: ZTeamRole });
const ZV3TeamPermissionChange = z.object({
  workspaceId: z.string(),
  from: ZTeamPermission,
  to: ZTeamPermission,
});

/** What an update changes, as ids: names and emails are looked up from the team itself. */
export const ZV3TeamChanges = z.object({
  name: z.object({ from: z.string(), to: z.string() }).nullable(),
  membersAdded: z.array(z.string()),
  membersRemoved: z.array(z.string()),
  memberRolesChanged: z.array(ZV3TeamRoleChange),
  workspacesAdded: z.array(z.string()),
  workspacesRemoved: z.array(z.string()),
  workspacePermissionsChanged: z.array(ZV3TeamPermissionChange),
});
export type TV3TeamChanges = z.infer<typeof ZV3TeamChanges>;

/**
 * The outcome of `update_team`. `preview`: the change takes access away and `confirm` was not true, so
 * nothing was written (`team` is the team as it is now). `updated`: written (`team` is the result).
 * `unchanged`: the request matched what is stored, nothing was written.
 */
export const ZV3TeamUpdateResource = z.object({
  status: z.enum(["preview", "updated", "unchanged"]),
  changes: ZV3TeamChanges,
  team: ZV3TeamResource,
  message: z.string(),
});
export type TV3TeamUpdateResource = z.infer<typeof ZV3TeamUpdateResource>;

/** The outcome of `delete_team`. `preview`: nothing was deleted. */
export const ZV3TeamDeleteResource = z.object({
  status: z.enum(["preview", "deleted"]),
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  memberCount: z.number().int(),
  workspaceCount: z.number().int(),
  message: z.string(),
});
export type TV3TeamDeleteResource = z.infer<typeof ZV3TeamDeleteResource>;
