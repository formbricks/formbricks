import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import {
  canManageOrganizationUsers,
  getApiKeyCreatorRole,
} from "@/modules/api/v2/organizations/[organizationId]/users/lib/utils";
import { TGetWorkspaceTeamsFilter } from "@/modules/api/v2/organizations/[organizationId]/workspace-teams/types/workspace-teams";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";

export const getWorkspaceTeamsQuery = (organizationId: string, params: TGetWorkspaceTeamsFilter) => {
  const { teamId, workspaceId } = params || {};

  let query: Prisma.WorkspaceTeamFindManyArgs = {
    where: {
      team: {
        organizationId,
      },
    },
  };

  if (teamId) {
    query = {
      ...query,
      where: {
        ...query.where,
        teamId,
      },
    };
  }

  if (workspaceId) {
    query = {
      ...query,
      where: {
        ...query.where,
        workspaceId,
        workspace: {
          organizationId,
        },
      },
    };
  }

  const baseFilter = pickCommonFilter(params);

  if (baseFilter) {
    query = buildCommonFilterQuery<Prisma.WorkspaceTeamFindManyArgs>(query, baseFilter);
  }

  return query;
};

export const validateTeamIdAndWorkspaceId = reactCache(
  async (organizationId: string, teamId: string, workspaceId: string) => {
    try {
      const hasAccess = await prisma.organization.findFirst({
        where: {
          id: organizationId,
          teams: {
            some: {
              id: teamId,
            },
          },
          workspaces: {
            some: {
              id: workspaceId,
            },
          },
        },
      });

      if (!hasAccess) {
        return err({ type: "not_found", details: [{ field: "teamId/workspaceId", issue: "not_found" }] });
      }

      return ok(true);
    } catch (error) {
      return err({
        type: "internal_server_error",
        details: [
          {
            field: "teamId/workspaceId",
            issue: error instanceof Error ? error.message : "Unknown error occurred",
          },
        ],
      });
    }
  }
);

export const checkAuthenticationAndAccess = async (
  teamId: string,
  workspaceId: string,
  authentication: TAuthenticationApiKey
): Promise<Result<boolean, ApiErrorResponseV2>> => {
  const hasAccess = await validateTeamIdAndWorkspaceId(authentication.organizationId, teamId, workspaceId);

  if (!hasAccess.ok) {
    return err(hasAccess.error as ApiErrorResponseV2);
  }

  return ok(true);
};

/**
 * Org API keys carry no role of their own, so workspace-team writes are anchored to the API key
 * creator's current role, the same clamp the teams and users routes apply. A key whose creator was
 * demoted, removed or never recorded (legacy keys) can no longer manage team access.
 */
export const checkApiKeyCreatorCanManageWorkspaceTeams = async (
  authentication: TAuthenticationApiKey
): Promise<Result<true, ApiErrorResponseV2>> => {
  const assignerRole = await getApiKeyCreatorRole(authentication.apiKeyId, authentication.organizationId);

  if (!canManageOrganizationUsers(assignerRole)) {
    return err({
      type: "forbidden",
      details: [
        {
          field: "workspaceTeam",
          issue: "You are not allowed to manage team access in this organization",
        },
      ],
    });
  }

  return ok(true);
};
