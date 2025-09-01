import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { TGetResponsesFilter } from "@/modules/api/v2/management/responses/types/responses";
import { Prisma } from "@prisma/client";

export const getResponsesQuery = (environmentIds: string[], params?: TGetResponsesFilter) => {
  let query: Prisma.ResponseFindManyArgs = {
    where: {
      survey: {
        environmentId: { in: environmentIds },
      },
    },
  };

  if (!params) return query;

  const { surveyId, contactId } = params || {};

  if (surveyId) {
    query = {
      ...query,
      where: {
        ...query.where,
        surveyId,
      },
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

  const baseFilter = pickCommonFilter(params);

  if (baseFilter) {
    query = buildCommonFilterQuery<Prisma.ResponseFindManyArgs>(query, baseFilter);
  }

  return query;
};
