import { prisma } from "@formbricks/database";
import { Prisma, Webhook } from "@formbricks/database/prisma";
import { ZId, ZOptionalNumber } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import { TWebhookInput, ZWebhookInput } from "@/app/api/v1/webhooks/types/webhooks";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { generateWebhookSecret } from "@/lib/crypto";
import { validateInputs } from "@/lib/utils/validate";
import { validateWebhookUrl } from "@/lib/utils/validate-webhook-url";

export const createWebhook = async (webhookInput: TWebhookInput): Promise<Webhook> => {
  validateInputs([webhookInput, ZWebhookInput]);
  await validateWebhookUrl(webhookInput.url);

  try {
    const secret = generateWebhookSecret();

    const createdWebhook = await prisma.webhook.create({
      data: {
        url: webhookInput.url,
        name: webhookInput.name,
        source: webhookInput.source,
        surveyIds: webhookInput.surveyIds || [],
        triggers: webhookInput.triggers || [],
        secret,
        workspaceId: webhookInput.workspaceId,
      },
    });

    return createdWebhook;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    if (!(error instanceof InvalidInputError)) {
      throw new DatabaseError(
        `Database error when creating webhook for workspace ${webhookInput.workspaceId}`
      );
    }

    throw error;
  }
};

export const getWebhooks = async (
  workspaceIds: string[],
  page?: number
): Promise<Omit<Webhook, "secret">[]> => {
  validateInputs([workspaceIds, ZId.array()], [page, ZOptionalNumber]);

  try {
    const webhooks = await prisma.webhook.findMany({
      where: {
        workspaceId: { in: workspaceIds },
      },
      omit: {
        secret: true,
      },
      take: page ? ITEMS_PER_PAGE : undefined,
      skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
    });
    return webhooks;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
