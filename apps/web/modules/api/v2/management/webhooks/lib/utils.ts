import { TGetWebhooksFilter } from "@/modules/api/v2/management/webhooks/types/webhooks";
import { Prisma } from "@prisma/client";

export const getWebhooksQuery = (environmentId: string, params?: TGetWebhooksFilter) => {
  const { limit, skip, sortBy, order, startDate, endDate, surveyIds } = params || {};

  let query: Prisma.WebhookFindManyArgs = {
    where: {
      environmentId,
    },
  };

  if (surveyIds) {
    query = {
      ...query,
      where: {
        ...query.where,
        surveyIds: {
          hasSome: surveyIds,
        },
      },
    };
  }

  if (startDate) {
    query = {
      ...query,
      where: {
        ...query.where,
        createdAt: {
          ...(query.where?.createdAt as Prisma.DateTimeFilter<"Webhook">),
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
          ...(query.where?.createdAt as Prisma.DateTimeFilter<"Webhook">),
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
    query = {
      ...query,
      take: limit,
    };
  }

  if (skip) {
    query = {
      ...query,
      skip,
    };
  }

  return query;
};
