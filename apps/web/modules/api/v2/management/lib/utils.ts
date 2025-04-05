import { TGetFilter } from "@/modules/api/v2/types/api-filter";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";

export const hashApiKey = (key: string): string => createHash("sha256").update(key).digest("hex");

export function pickCommonFilter<T extends TGetFilter>(params: T) {
  const { limit, skip, sortBy, order, startDate, endDate } = params;
  return { limit, skip, sortBy, order, startDate, endDate };
}

type HasFindMany =
  | Prisma.WebhookFindManyArgs
  | Prisma.ResponseFindManyArgs
  | Prisma.TeamFindManyArgs
  | Prisma.ProjectTeamFindManyArgs;

export function buildCommonFilterQuery<T extends HasFindMany>(query: T, params: TGetFilter): T {
  const { limit, skip, sortBy, order, startDate, endDate } = params || {};

  let filteredQuery = {
    ...query,
  };

  if (startDate) {
    filteredQuery = {
      ...filteredQuery,
      where: {
        ...filteredQuery.where,
        createdAt: {
          ...((filteredQuery.where?.createdAt as Prisma.DateTimeFilter) ?? {}),
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
        createdAt: {
          ...((filteredQuery.where?.createdAt as Prisma.DateTimeFilter) ?? {}),
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
