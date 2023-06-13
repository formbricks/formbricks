import { hashApiKey } from "@/lib/api/apiHelper";
import { responses } from "@/lib/api/response";
import { prisma } from "@formbricks/database";
import { headers } from "next/headers";

export async function GET(_: Request, { params }: { params: { webhookId: string } }) {
  const apiKey = headers().get("x-api-key");
  if (!apiKey) {
    return responses.notAuthenticatedResponse();
  }
  const apiKeyData = await prisma.apiKey.findUnique({
    where: {
      hashedKey: hashApiKey(apiKey),
    },
    select: {
      environmentId: true,
    },
  });
  if (!apiKeyData) {
    return responses.notAuthenticatedResponse();
  }

  // add webhook to database
  const webhook = await prisma.webhook.findUnique({
    where: {
      id: params.webhookId,
    },
  });
  if (!webhook) {
    return responses.notFoundResponse("Webhook", params.webhookId);
  }
  return responses.successResponse(webhook);
}

export async function DELETE(_: Request, { params }: { params: { webhookId: string } }) {
  const apiKey = headers().get("x-api-key");
  if (!apiKey) {
    return responses.notAuthenticatedResponse();
  }
  const apiKeyData = await prisma.apiKey.findUnique({
    where: {
      hashedKey: hashApiKey(apiKey),
    },
    select: {
      environmentId: true,
    },
  });
  if (!apiKeyData) {
    return responses.notAuthenticatedResponse();
  }

  // add webhook to database
  const webhook = await prisma.webhook.delete({
    where: {
      id: params.webhookId,
    },
  });
  if (!webhook) {
    return responses.notFoundResponse("Webhook", params.webhookId);
  }
  return responses.successResponse(webhook);
}
