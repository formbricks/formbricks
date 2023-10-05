"use server";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { createWebhook, deleteWebhook, updateWebhook } from "@formbricks/lib/webhook/service";
import { TWebhook, TWebhookInput } from "@formbricks/types/v1/webhooks";
import { getServerSession } from "next-auth";
import { AuthorizationError } from "@formbricks/types/v1/errors";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { canUserAccessWebhook } from "@formbricks/lib/webhook/auth";

export const createWebhookAction = async (
  environmentId: string,
  webhookInput: TWebhookInput
): Promise<TWebhook> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await createWebhook(environmentId, webhookInput);
};

export const deleteWebhookAction = async (id: string): Promise<TWebhook> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessWebhook(session.user.id, id);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await deleteWebhook(id);
};

export const updateWebhookAction = async (
  environmentId: string,
  webhookId: string,
  webhookInput: Partial<TWebhookInput>
): Promise<TWebhook> => {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthorizationError("Not authorized");

  const isAuthorized = await canUserAccessWebhook(session.user.id, webhookId);
  if (!isAuthorized) throw new AuthorizationError("Not authorized");

  return await updateWebhook(environmentId, webhookId, webhookInput);
};
