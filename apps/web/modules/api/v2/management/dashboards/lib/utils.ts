import { Prisma } from "@prisma/client";
import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { TGetDashboardsFilter } from "@/modules/api/v2/management/dashboards/types/dashboards";

export const getDashboardsQuery = (projectIds: string[], params?: TGetDashboardsFilter) => {
  let query: Prisma.DashboardFindManyArgs = {
    where: {
      projectId: { in: projectIds },
    },
    orderBy: { createdAt: "desc" },
  };

  if (!params) return query;

  if (params.projectId) {
    query = {
      ...query,
      where: {
        ...query.where,
        projectId: params.projectId,
      },
    };
  }

  const baseFilter = pickCommonFilter(params);

  if (baseFilter) {
    query = buildCommonFilterQuery<Prisma.DashboardFindManyArgs>(query, baseFilter);
  }

  return query;
};
