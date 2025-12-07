"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { AuthenticatedActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getOrganizationIdFromTeamId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { checkRoleManagementPermission } from "@/modules/ee/role-management/actions";
import { getTeamRoleByTeamIdUserId } from "@/modules/ee/teams/lib/roles";
import {
  createTeam,
  deleteTeam,
  getTeamDetails,
  updateTeamDetails,
} from "@/modules/ee/teams/team-list/lib/team";
import { ZTeamSettingsFormSchema } from "@/modules/ee/teams/team-list/types/team";
import { sendInviteMemberEmail } from "@/modules/email";
import { inviteUser } from "@/modules/organization/settings/teams/lib/invite";

const ZCreateTeamAction = z.object({
  organizationId: z.string().cuid(),
  name: z.string().trim().min(1, "Team name is required"),
});

export const createTeamAction = authenticatedActionClient.schema(ZCreateTeamAction).action(
  withAuditLogging(
    "created",
    "team",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId: parsedInput.organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
        ],
      });
      await checkRoleManagementPermission(parsedInput.organizationId);

      const result = await createTeam(parsedInput.organizationId, parsedInput.name);
      ctx.auditLoggingCtx.organizationId = parsedInput.organizationId;
      ctx.auditLoggingCtx.teamId = result;
      ctx.auditLoggingCtx.newObject = {
        ...(await getTeamDetails(result)),
      };
      return result;
    }
  )
);

const ZGetTeamDetailsAction = z.object({
  teamId: ZId,
});

export const getTeamDetailsAction = authenticatedActionClient
  .schema(ZGetTeamDetailsAction)
  .action(async ({ parsedInput, ctx }) => {
    const organizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          teamId: parsedInput.teamId,
          type: "team",
          minPermission: "admin",
        },
      ],
    });

    await checkRoleManagementPermission(organizationId);

    return await getTeamDetails(parsedInput.teamId);
  });

const ZDeleteTeamAction = z.object({
  teamId: ZId,
});

export const deleteTeamAction = authenticatedActionClient.schema(ZDeleteTeamAction).action(
  withAuditLogging(
    "deleted",
    "team",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      const organizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
        ],
      });

      await checkRoleManagementPermission(organizationId);
      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.teamId = parsedInput.teamId;
      const oldObject = await getTeamDetails(parsedInput.teamId);
      ctx.auditLoggingCtx.oldObject = oldObject;
      return await deleteTeam(parsedInput.teamId);
    }
  )
);

const ZUpdateTeamAction = z.object({
  teamId: ZId,
  data: ZTeamSettingsFormSchema,
});

export const updateTeamDetailsAction = authenticatedActionClient.schema(ZUpdateTeamAction).action(
  withAuditLogging(
    "updated",
    "team",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      const organizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);

      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "team",
            teamId: parsedInput.teamId,
            minPermission: "admin",
          },
        ],
      });

      await checkRoleManagementPermission(organizationId);
      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.teamId = parsedInput.teamId;
      const oldObject = await getTeamDetails(parsedInput.teamId);
      const result = await updateTeamDetails(parsedInput.teamId, parsedInput.data);
      ctx.auditLoggingCtx.oldObject = oldObject;
      ctx.auditLoggingCtx.newObject = await getTeamDetails(parsedInput.teamId);
      return result;
    }
  )
);

const ZGetTeamRoleAction = z.object({
  teamId: ZId,
});

export const getTeamRoleAction = authenticatedActionClient
  .schema(ZGetTeamRoleAction)
  .action(async ({ ctx, parsedInput }) => {
    return await getTeamRoleByTeamIdUserId(parsedInput.teamId, ctx.user.id);
  });

const ZInviteToTeamAction = z.object({
  teamId: ZId,
  email: z.string().email(),
  name: z.string(),
});

/**
 * Allows team admins to invite new users to their team.
 * Invited users are added to the organization with "member" role
 * and to the team with "contributor" role.
 */
export const inviteToTeamAction = authenticatedActionClient.schema(ZInviteToTeamAction).action(
  withAuditLogging(
    "created",
    "invite",
    async ({ ctx, parsedInput }: { ctx: AuthenticatedActionClientCtx; parsedInput: Record<string, any> }) => {
      // Get organization ID from team ID
      const organizationId = await getOrganizationIdFromTeamId(parsedInput.teamId);

      // Check authorization - allow org owner/manager OR team admin
      await checkAuthorizationUpdated({
        userId: ctx.user.id,
        organizationId,
        access: [
          {
            type: "organization",
            roles: ["owner", "manager"],
          },
          {
            type: "team",
            teamId: parsedInput.teamId,
            minPermission: "admin",
          },
        ],
      });

      await checkRoleManagementPermission(organizationId);

      // Create invite with fixed role="member" and teamIds=[teamId]
      const inviteId = await inviteUser({
        organizationId,
        invitee: {
          email: parsedInput.email,
          name: parsedInput.name,
          role: "member", // Hardcoded to prevent privilege escalation
          teamIds: [parsedInput.teamId], // User joins this specific team
        },
        currentUserId: ctx.user.id,
      });

      // Send email
      await sendInviteMemberEmail(inviteId, parsedInput.email, ctx.user.name || "", parsedInput.name);

      // Set audit logging context
      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.teamId = parsedInput.teamId;
      ctx.auditLoggingCtx.inviteId = inviteId;
      ctx.auditLoggingCtx.newObject = {
        email: parsedInput.email,
        name: parsedInput.name,
        role: "member",
        teamIds: [parsedInput.teamId],
      };

      return inviteId;
    }
  )
);
