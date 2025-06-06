import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { TGetProjectTeamsFilter } from "@/modules/api/v2/organizations/[organizationId]/project-teams/types/project-teams";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getProjectTeamsQuery = (organizationId: string, params: TGetProjectTeamsFilter) => {
  const { teamId, projectId } = params || {};

  let query: Prisma.ProjectTeamFindManyArgs = {
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

  if (projectId) {
    query = {
      ...query,
      where: {
        ...query.where,
        projectId,
        project: {
          organizationId,
        },
      },
    };
  }

  const baseFilter = pickCommonFilter(params);

  if (baseFilter) {
    query = buildCommonFilterQuery<Prisma.ProjectTeamFindManyArgs>(query, baseFilter);
  }

  return query;
};

export const validateTeamIdAndProjectId = reactCache(
  async (organizationId: string, teamId: string, projectId: string) => {
    try {
      const hasAccess = await prisma.organization.findFirst({
        where: {
          id: organizationId,
          teams: {
            some: {
              id: teamId,
            },
          },
          projects: {
            some: {
              id: projectId,
            },
          },
        },
      });

      if (!hasAccess) {
        return err({ type: "not_found", details: [{ field: "teamId/projectId", issue: "not_found" }] });
      }

      return ok(true);
    } catch (error) {
      return err({
        type: "internal_server_error",
        details: [{ field: "teamId/projectId", issue: error.message }],
      });
    }
  }
);

export const checkAuthenticationAndAccess = async (
  teamId: string,
  projectId: string,
  authentication: TAuthenticationApiKey
): Promise<Result<boolean, ApiErrorResponseV2>> => {
  const hasAccess = await validateTeamIdAndProjectId(authentication.organizationId, teamId, projectId);

  if (!hasAccess.ok) {
    return err(hasAccess.error as ApiErrorResponseV2);
  }

  return ok(true);
};
