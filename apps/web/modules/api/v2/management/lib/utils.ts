import { Prisma } from "@prisma/client";
import { TGetFilter } from "@/modules/api/v2/types/api-filter";

export function pickCommonFilter<T extends TGetFilter>(params: T) {
  const { limit, skip, sortBy, order, startDate, endDate, filterDateField } = params;
  return { limit, skip, sortBy, order, startDate, endDate, filterDateField };
}

type HasFindMany =
  | Prisma.WebhookFindManyArgs
  | Prisma.ResponseFindManyArgs
  | Prisma.TeamFindManyArgs
  | Prisma.ProjectTeamFindManyArgs
  | Prisma.UserFindManyArgs
  | Prisma.ContactAttributeKeyFindManyArgs;

export function buildCommonFilterQuery<T extends HasFindMany>(query: T, params: TGetFilter): T {
  const { limit, skip, sortBy, order, startDate, endDate, filterDateField = "createdAt" } = params || {};

  let filteredQuery = {
    ...query,
  };

  const dateField = filterDateField;

  if (startDate) {
    filteredQuery = {
      ...filteredQuery,
      where: {
        ...filteredQuery.where,
        [dateField]: {
          ...(filteredQuery.where?.[dateField] as Prisma.DateTimeFilter),
          gte: startDate,
        },
      },
    };
  }

  if (endDate) {
    filteredQuery = {
      ...filteredQuery,
      where: {
        ...filteredQuery.where,
        [dateField]: {
          ...(filteredQuery.where?.[dateField] as Prisma.DateTimeFilter),
          lte: endDate,
        },
      },
    };
  }

  if (sortBy) {
    filteredQuery = {
      ...filteredQuery,
      orderBy: {
        [sortBy]: order,
      },
    };
  }

  if (limit) {
    filteredQuery = { ...filteredQuery, take: limit };
  }

  if (skip) {
    filteredQuery = { ...filteredQuery, skip };
  }

  return filteredQuery;
}
