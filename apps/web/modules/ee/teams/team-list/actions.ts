"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { InvalidInputError, ResourceNotFoundError, UnknownError } from "@formbricks/types/errors";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
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

const ZAddMemberToTeamAction = z.object({
  teamId: ZId,
  userId: ZId,
  role: z.enum(["admin", "contributor"]).default("contributor"),
});

export const addMemberToTeamAction = authenticatedActionClient.schema(ZAddMemberToTeamAction).action(
  withAuditLogging(
    "updated",
    "team",
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: AuthenticatedActionClientCtx;
      parsedInput: z.infer<typeof ZAddMemberToTeamAction>;
    }) => {
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

      const teamDetails = await getTeamDetails(parsedInput.teamId);
      if (!teamDetails) {
        throw new ResourceNotFoundError("Team", parsedInput.teamId);
      }

      if (teamDetails.projects.length === 0) {
        throw new InvalidInputError("team_requires_workspace");
      }

      const isAlreadyMember = teamDetails.members.some((m) => m.userId === parsedInput.userId);
      if (isAlreadyMember) {
        return { data: true };
      }

      // Owners and managers are always team admins, never contributors
      const userMembership = await getMembershipByUserIdOrganizationId(parsedInput.userId, organizationId);
      const isOwnerOrManager = userMembership?.role === "owner" || userMembership?.role === "manager";
      const teamRole = isOwnerOrManager ? "admin" : parsedInput.role;

      const updatedMembers = [
        ...teamDetails.members.map((m) => ({ userId: m.userId, role: m.role })),
        { userId: parsedInput.userId, role: teamRole },
      ];

      const updatedProjects = teamDetails.projects.map((p) => ({
        projectId: p.projectId,
        permission: p.permission,
      }));

      const result = await updateTeamDetails(parsedInput.teamId, {
        name: teamDetails.name,
        members: updatedMembers,
        projects: updatedProjects,
      });

      if (!result) {
        throw new UnknownError("Failed to add member to team");
      }

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.teamId = parsedInput.teamId;
      ctx.auditLoggingCtx.oldObject = teamDetails;
      ctx.auditLoggingCtx.newObject = await getTeamDetails(parsedInput.teamId);
      return { data: true };
    }
  )
);
