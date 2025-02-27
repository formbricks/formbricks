import { TGetResponsesFilter } from "@/modules/api/v2/management/responses/types/responses";
import { Prisma } from "@prisma/client";

export const getResponsesQuery = (environmentId: string, params?: TGetResponsesFilter) => {
  const { surveyId, limit, skip, sortBy, order, startDate, endDate, contactId } = params || {};

  let query: Prisma.ResponseFindManyArgs = {
    where: {
      survey: {
        environmentId,
      },
    },
  };

  if (surveyId) {
    query = {
      ...query,
      where: {
        ...query.where,
        surveyId,
      },
    };
  }

  if (startDate) {
    query = {
      ...query,
      where: {
        ...query.where,
        createdAt: {
          ...(query.where?.createdAt as Prisma.DateTimeFilter<"Response">),
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
          ...(query.where?.createdAt as Prisma.DateTimeFilter<"Response">),
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
      skip: skip,
    };
  }

  if (contactId) {
    query = {
      ...query,
      where: {
        ...query.where,
        contactId,
      },
    };
  }

  return query;
};
