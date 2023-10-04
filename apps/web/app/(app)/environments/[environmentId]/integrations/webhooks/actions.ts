"use server";

import { createWebhook, deleteWebhook, updateWebhook } from "@formbricks/lib/webhook/service";
import { TWebhook, TWebhookInput } from "@formbricks/types/v1/webhooks";

export const createWebhookAction = async (
  environmentId: string,
  webhookInput: TWebhookInput
): Promise<TWebhook> => {
  return await createWebhook(environmentId, webhookInput);
};

export const deleteWebhookAction = async (id: string): Promise<TWebhook> => {
  return await deleteWebhook(id);
};

export const updateWebhookAction = async (
  environmentId: string,
  webhookId: string,
  webhookInput: Partial<TWebhookInput>
): Promise<TWebhook> => {
  return await updateWebhook(environmentId, webhookId, webhookInput);
};
