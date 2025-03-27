import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { TGetProjectTeamsFilter } from "@/modules/api/v2/organizations/project-teams/types/projectTeams";
import { Prisma } from "@prisma/client";

export const getProjectTeamsQuery = (params: TGetProjectTeamsFilter) => {
    const { teamId, projectId } = params || {};

  let query: Prisma.ProjectTeamFindManyArgs = {
    where: {
      teamId,
    },
  };

  if (projectId) {
    query = {
      ...query,
      where: {
        ...query.where,
        projectId,
      },
    };
  }

  const baseFilter = pickCommonFilter(params);

  if (baseFilter) {
    query = buildCommonFilterQuery<Prisma.ProjectTeamFindManyArgs>(query, baseFilter);
  }

  return query;
};
