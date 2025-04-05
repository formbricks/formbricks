import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { TGetUsersFilter } from "@/modules/api/v2/organizations/[organizationId]/users/types/users";
import { Prisma } from "@prisma/client";

export const getUsersQuery = (organizationId: string, params?: TGetUsersFilter) => {
  let query: Prisma.UserFindManyArgs = {
    where: {
      memberships: {
        some: {
          organizationId,
        },
      },
    },
  };

  if (!params) return query;

  if (params.email) {
    query.where = {
      ...query.where,
      email: {
        contains: params.email,
        mode: "insensitive",
      },
    };
  }

  if (params.id) {
    query.where = {
      ...query.where,
      id: params.id,
    };
  }

  const baseFilter = pickCommonFilter(params);

  if (baseFilter) {
    query = buildCommonFilterQuery<Prisma.UserFindManyArgs>(query, baseFilter);
  }

  return query;
};
