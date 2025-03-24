import { authenticateRequest, hasPermission } from "@/app/api/v1/auth";
import { deleteWebhook, getWebhook } from "@/app/api/v1/webhooks/[webhookId]/lib/webhook";
import { responses } from "@/app/lib/api/response";
import { headers } from "next/headers";

export const GET = async (request: Request, props: { params: Promise<{ webhookId: string }> }) => {
  const params = await props.params;
  const headersList = await headers();
  const apiKey = headersList.get("x-api-key");
  if (!apiKey) {
    return responses.notAuthenticatedResponse();
  }
  const authentication = await authenticateRequest(request);
  if (!authentication) {
    return responses.notAuthenticatedResponse();
  }

  // add webhook to database
  const webhook = await getWebhook(params.webhookId);
  if (!webhook) {
    return responses.notFoundResponse("Webhook", params.webhookId);
  }
  if (!hasPermission(authentication.environmentPermissions, webhook.environmentId, "GET")) {
    return responses.unauthorizedResponse();
  }
  return responses.successResponse(webhook);
};

export const DELETE = async (request: Request, props: { params: Promise<{ webhookId: string }> }) => {
  const params = await props.params;
  const headersList = await headers();
  const apiKey = headersList.get("x-api-key");
  if (!apiKey) {
    return responses.notAuthenticatedResponse();
  }
  const authentication = await authenticateRequest(request);
  if (!authentication) {
    return responses.notAuthenticatedResponse();
  }

  // check if webhook exists
  const webhook = await getWebhook(params.webhookId);
  if (!webhook) {
    return responses.notFoundResponse("Webhook", params.webhookId);
  }
  if (!hasPermission(authentication.environmentPermissions, webhook.environmentId, "DELETE")) {
    return responses.unauthorizedResponse();
  }

  // delete webhook from database
  try {
    const webhook = await deleteWebhook(params.webhookId);
    return responses.successResponse(webhook);
  } catch (e) {
    console.error(e.message);
    return responses.notFoundResponse("Webhook", params.webhookId);
  }
};
