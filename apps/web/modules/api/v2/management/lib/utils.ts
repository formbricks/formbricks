import { TGetFilter } from "@/modules/api/v2/types/api-filter";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";

export const hashApiKey = (key: string): string => createHash("sha256").update(key).digest("hex");

export function pickCommonFilter<T extends TGetFilter>(params: T) {
  const { limit, skip, sortBy, order, startDate, endDate } = params;
  return { limit, skip, sortBy, order, startDate, endDate };
}

type HasFindMany = Prisma.WebhookFindManyArgs | Prisma.ResponseFindManyArgs;

export function buildCommonFilterQuery<T extends HasFindMany>(query: T, params: TGetFilter): T {
  const { limit, skip, sortBy, order, startDate, endDate } = params || {};

  if (startDate) {
    query = {
      ...query,
      where: {
        ...query.where,
        createdAt: {
          ...((query.where?.createdAt as Prisma.DateTimeFilter<"Webhook">) ?? {}),
          gte: startDate,
        },
      },
    };
  }

  if (endDate) {
    query = {
      ...query,
      where: {
        ...query.where,
        createdAt: {
          ...((query.where?.createdAt as Prisma.DateTimeFilter<"Webhook">) ?? {}),
          lte: endDate,
        },
      },
    };
  }

  if (sortBy) {
    query = {
      ...query,
      orderBy: {
        [sortBy]: order,
      },
    };
  }

  if (limit) {
    query = { ...query, take: limit };
  }

  if (skip) {
    query = { ...query, skip };
  }

  return query;
}
