import { webhookCache } from "@/lib/cache/webhook";
import { getWebhooksQuery } from "@/modules/api/v2/management/webhooks/lib/utils";
import { TGetWebhooksFilter, TWebhookInput } from "@/modules/api/v2/management/webhooks/types/webhooks";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { ApiResponseWithMeta } from "@/modules/api/v2/types/api-success";
import { Prisma, Webhook } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { captureTelemetry } from "@formbricks/lib/telemetry";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getWebhooks = async (
  environmentId: string,
  params: TGetWebhooksFilter
): Promise<Result<ApiResponseWithMeta<Webhook[]>, ApiErrorResponseV2>> => {
  try {
    const [webhooks, count] = await prisma.$transaction([
      prisma.webhook.findMany({
        ...getWebhooksQuery(environmentId, params),
      }),
      prisma.webhook.count({
        where: getWebhooksQuery(environmentId, params).where,
      }),
    ]);

    if (!webhooks) {
      return err({
        type: "not_found",
        details: [{ field: "webhooks", issue: "not_found" }],
      });
    }

    return ok({
      data: webhooks,
      meta: {
        total: count,
        limit: params?.limit,
        offset: params?.skip,
      },
    });
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [{ field: "webhooks", issue: error.message }],
    });
  }
};

export const createWebhook = async (webhook: TWebhookInput): Promise<Result<Webhook, ApiErrorResponseV2>> => {
  captureTelemetry("webhook_created");

  const { environmentId, name, url, source, triggers, surveyIds } = webhook;

  try {
    const prismaData: Prisma.WebhookCreateInput = {
      environment: {
        connect: {
          id: environmentId,
        },
      },
      name,
      url,
      source,
      triggers,
      surveyIds,
    };

    const createdWebhook = await prisma.webhook.create({
      data: prismaData,
    });

    webhookCache.revalidate({
      environmentId: createdWebhook.environmentId,
      source: createdWebhook.source,
    });

    return ok(createdWebhook);
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [{ field: "webhook", issue: error.message }],
    });
  }
};
