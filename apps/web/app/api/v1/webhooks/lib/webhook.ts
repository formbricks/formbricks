import { prisma } from "@formbricks/database";
import { Prisma, Webhook } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import { TWebhookInput, ZWebhookInput } from "@/app/api/v1/webhooks/types/webhooks";
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
  limit: number,
  offset: number
): Promise<Omit<Webhook, "secret">[]> => {
  validateInputs([workspaceIds, ZId.array()]);

  try {
    const webhooks = await prisma.webhook.findMany({
      where: {
        workspaceId: { in: workspaceIds },
      },
      omit: {
        secret: true,
      },
      orderBy: { id: "asc" },
      take: limit,
      skip: offset,
    });
    return webhooks;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
