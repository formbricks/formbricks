"use server";

import { logger } from "@formbricks/logger";
import { TUserEmail, ZUserEmail } from "@formbricks/types/user";
import { validateInputs } from "@/lib/utils/validate";

const EE_SERVER_CONFIG = {
  // TODO: Update endpoint URL for production
  BASE_URL: process.env.NODE_ENV === "development" ? "http://localhost:8080" : "https://ee.formbricks.com",
  TIMEOUT_MS: 5000,
} as const;

export type TMailingListId = "security" | "product-updates";

interface TSubscribeToMailingListParams {
  email: TUserEmail;
  listId: TMailingListId;
}

/**
 * Subscribe a user to a mailing list via the EE server
 * @param email - The user's email address
 * @param listId - The mailing list ID ("security" or "product-updates")
 */
export const subscribeToMailingList = async ({
  email,
  listId,
}: TSubscribeToMailingListParams): Promise<{ success: boolean; error?: string }> => {
  validateInputs([email, ZUserEmail]);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EE_SERVER_CONFIG.TIMEOUT_MS);

    const response = await fetch(
      `${EE_SERVER_CONFIG.BASE_URL}/api/v1/public/mailing/${listId}/subscriptions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { status: response.status, error: errorText },
        `Failed to subscribe to ${listId} mailing list`
      );
      return { success: false, error: `Failed to subscribe: ${response.status}` };
    }

    logger.info({ email, listId }, `Successfully subscribed to ${listId} mailing list`);
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logger.error({ email, listId }, "Mailing subscription request timed out");
      return { success: false, error: "Request timed out" };
    }

    logger.error(error, `Error subscribing to ${listId} mailing list`);
    return { success: false, error: "Failed to subscribe to mailing list" };
  }
};

export const subscribeUserToMailingList = async ({
  email,
  isFormbricksCloud,
  subscribeToSecurityUpdates,
  subscribeToProductUpdates,
}: {
  email: TUserEmail;
  isFormbricksCloud: boolean;
  subscribeToSecurityUpdates?: boolean;
  subscribeToProductUpdates?: boolean;
}): Promise<void> => {
  if (isFormbricksCloud && subscribeToProductUpdates) {
    await subscribeToMailingList({ email, listId: "product-updates" });
  } else if (!isFormbricksCloud && subscribeToSecurityUpdates) {
    await subscribeToMailingList({ email, listId: "security" });
  }
};
