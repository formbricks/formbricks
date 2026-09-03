import "server-only";
import { prisma } from "@formbricks/database";
import { Team } from "@formbricks/database/prisma";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { runPostCommitProjection } from "@/lib/authzed/projection-boundary";
import { reconcileTeamWorkspaceRelationships } from "@/lib/authzed/team-workspace";
import { getTeamsQuery } from "@/modules/api/v2/organizations/[organizationId]/teams/lib/utils";
import {
  TGetTeamsFilter,
  TTeamInput,
} from "@/modules/api/v2/organizations/[organizationId]/teams/types/teams";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ApiResponseWithMeta } from "@/modules/api/v2/types/api-success";

export const createTeam = async (
  teamInput: TTeamInput,
  organizationId: string
): Promise<Result<Team, ApiErrorResponseV2>> => {
  const { name } = teamInput;

  try {
    const team = await prisma.team.create({
      data: {
        name,
        organizationId,
      },
    });

    await runPostCommitProjection("api_v2_team_create", () =>
      reconcileTeamWorkspaceRelationships({ teamIds: [team.id] })
    );

    return ok(team);
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [{ field: "team", issue: error instanceof Error ? error.message : "Unknown error occurred" }],
    });
  }
};

export const getTeams = async (
  organizationId: string,
  params: TGetTeamsFilter
): Promise<Result<ApiResponseWithMeta<Team[]>, ApiErrorResponseV2>> => {
  try {
    const query = getTeamsQuery(organizationId, params);

    const [teams, count] = await prisma.$transaction([
      prisma.team.findMany({
        ...query,
      }),
      prisma.team.count({
        where: query.where,
      }),
    ]);

    return ok({
      data: teams,
      meta: {
        total: count,
        limit: params.limit,
        offset: params.skip,
      },
    });
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [{ field: "teams", issue: error instanceof Error ? error.message : "Unknown error occurred" }],
    });
  }
};
