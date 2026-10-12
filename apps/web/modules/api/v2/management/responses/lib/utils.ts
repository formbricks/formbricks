import { Prisma } from "@formbricks/database/prisma";
import { andVisibleSurveys } from "@/lib/survey/visibility/predicate";
import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { TGetResponsesFilter } from "@/modules/api/v2/management/responses/types/responses";

export const getResponsesQuery = (
  workspaceIds: string[],
  params?: TGetResponsesFilter,
  visibleSurveyWhere: Prisma.SurveyWhereInput = {}
) => {
  let query: Prisma.ResponseFindManyArgs = {
    where: {
      survey: {
        workspaceId: { in: workspaceIds },
        ...andVisibleSurveys(visibleSurveyWhere),
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
