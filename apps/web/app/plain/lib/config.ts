import "server-only";
import { logger } from "@formbricks/logger";
import { env } from "@/lib/env";
import { isPlainChatMissingVerification } from "@/lib/plain-chat-config";

/**
 * Tell the operator why the chat they configured is not showing. Called once at server start
 * from `instrumentation.ts`. Never logs the app id or the secret.
 */
export const warnOnPlainChatMisconfiguration = (): void => {
  if (isPlainChatMissingVerification({ appId: env.PLAIN_APP_ID, hmacSecret: env.PLAIN_CHAT_HMAC_SECRET })) {
    logger.warn(
      "PLAIN_APP_ID is set but PLAIN_CHAT_HMAC_SECRET is not, so the Plain support chat is disabled. " +
        "Without the secret Plain cannot verify a customer's identity. Copy the chat secret from Plain's " +
        "Chat settings into PLAIN_CHAT_HMAC_SECRET and restart to enable it."
    );
  }
};
