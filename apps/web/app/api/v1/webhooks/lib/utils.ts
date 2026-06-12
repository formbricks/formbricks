import { Webhook } from "@formbricks/database/prisma";

// The signing secret must never leave the API except in the create response (shown once).
export const removeSecretFromWebhook = (webhook: Webhook): Omit<Webhook, "secret"> => {
  const { secret: _secret, ...webhookWithoutSecret } = webhook;
  return webhookWithoutSecret;
};
