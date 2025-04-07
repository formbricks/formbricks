import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { TGetWebhooksFilter } from "@/modules/api/v2/management/webhooks/types/webhooks";
import { Prisma } from "@prisma/client";

export const getWebhooksQuery = (environmentIds: string[], params?: TGetWebhooksFilter) => {
  let query: Prisma.WebhookFindManyArgs = {
    where: {
      environmentId: { in: environmentIds },
    },
  };

  if (!params) return query;

  const { surveyIds } = params || {};

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

  const baseFilter = pickCommonFilter(params);

  if (baseFilter) {
    query = buildCommonFilterQuery<Prisma.WebhookFindManyArgs>(query, baseFilter);
  }

  return query;
};
