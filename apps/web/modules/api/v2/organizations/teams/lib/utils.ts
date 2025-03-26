import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { TGetTeamsFilter } from "@/modules/api/v2/organizations/teams/types/teams";
import { Prisma } from "@prisma/client";

export const getTeamsQuery = (organizationId: string, params?: TGetTeamsFilter) => {
  let query: Prisma.TeamFindManyArgs = {
    where: {
      organizationId,
    },
  };

  if (!params) return query;

  const baseFilter = pickCommonFilter(params);

  if (baseFilter) {
    query = buildCommonFilterQuery<Prisma.TeamFindManyArgs>(query, baseFilter);
  }

  return query;
};
