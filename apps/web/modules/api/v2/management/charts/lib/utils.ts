import { Prisma } from "@prisma/client";
import { TAPIKeyEnvironmentPermission } from "@formbricks/types/auth";
import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { TGetChartsFilter } from "@/modules/api/v2/management/charts/types/charts";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";

export const hasProjectPermission = (
  permissions: TAPIKeyEnvironmentPermission[],
  projectId: string,
  method: "GET" | "POST" | "PUT" | "DELETE"
): boolean => {
  const projectPerms = permissions.filter((p) => p.projectId === projectId);
  return projectPerms.some((p) => hasPermission([p], p.environmentId, method));
};

export const getChartsQuery = (projectIds: string[], params?: TGetChartsFilter) => {
  let query: Prisma.ChartFindManyArgs = {
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
    query = buildCommonFilterQuery<Prisma.ChartFindManyArgs>(query, baseFilter);
  }

  return query;
};
