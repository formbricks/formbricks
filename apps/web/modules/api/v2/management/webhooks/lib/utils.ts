import { Prisma, Webhook } from "@formbricks/database/prisma";
import { buildCommonFilterQuery, pickCommonFilter } from "@/modules/api/v2/management/lib/utils";
import { TGetWebhooksFilter } from "@/modules/api/v2/management/webhooks/types/webhooks";

// The signing secret must never leave the API except in the create response (shown once).
export const removeSecretFromWebhook = (webhook: Webhook): Omit<Webhook, "secret"> => {
  const { secret: _secret, ...webhookWithoutSecret } = webhook;
  return webhookWithoutSecret;
};

export const getWebhooksQuery = (workspaceIds: string[], params?: TGetWebhooksFilter) => {
  let query: Prisma.WebhookFindManyArgs = {
    where: {
      workspaceId: { in: workspaceIds },
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
