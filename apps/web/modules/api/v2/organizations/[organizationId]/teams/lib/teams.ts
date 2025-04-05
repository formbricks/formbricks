import "server-only";
import { teamCache } from "@/lib/cache/team";
import { getTeamsQuery } from "@/modules/api/v2/organizations/[organizationId]/teams/lib/utils";
import {
  TGetTeamsFilter,
  TTeamInput,
} from "@/modules/api/v2/organizations/[organizationId]/teams/types/teams";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ApiResponseWithMeta } from "@/modules/api/v2/types/api-success";
import { Prisma, Team } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { organizationCache } from "@formbricks/lib/organization/cache";
import { captureTelemetry } from "@formbricks/lib/telemetry";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const createTeam = async (
  teamInput: TTeamInput,
  organizationId: string
): Promise<Result<Team, ApiErrorResponseV2>> => {
  captureTelemetry("team created");

  const { name } = teamInput;

  try {
    const prismaData: Prisma.TeamCreateInput = {
      name,
      organization: {
        connect: {
          id: organizationId,
        },
      },
    };

    const team = await prisma.team.create({
      data: prismaData,
    });

    organizationCache.revalidate({
      id: organizationId,
    });

    teamCache.revalidate({
      organizationId: organizationId,
    });

    return ok(team);
  } catch (error) {
    return err({ type: "internal_server_error", details: [{ field: "team", issue: error.message }] });
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
    return err({ type: "internal_server_error", details: [{ field: "teams", issue: error.message }] });
  }
};
