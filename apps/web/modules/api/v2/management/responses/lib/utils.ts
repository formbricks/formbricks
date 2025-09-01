import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { getOrganizationIdFromEnvironmentId } from "@/modules/api/v2/management/responses/lib/organization";
import { TGetResponsesFilter } from "@/modules/api/v2/management/responses/types/responses";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationBilling } from "@/modules/survey/lib/survey";
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

export const checkQuotasEnabled = async (environmentId: string): Promise<boolean> => {
  try {
    const organizationIdResult = await getOrganizationIdFromEnvironmentId(environmentId);
    if (!organizationIdResult.ok) {
      return false;
    }

    const billing = await getOrganizationBilling(organizationIdResult.data);
    if (!billing.ok) {
      return false;
    }

    const isQuotasEnabled = await getIsQuotasEnabled(billing.data.plan);
    return isQuotasEnabled;
  } catch (error) {
    return false;
  }
};
