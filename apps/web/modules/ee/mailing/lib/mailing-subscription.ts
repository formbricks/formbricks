"use server";

import { logger } from "@formbricks/logger";
import { TUserEmail, ZUserEmail } from "@formbricks/types/user";
import { validateInputs } from "@/lib/utils/validate";

export type TMailingListId = "security" | "product-updates";

const MAILING_LIST_ENDPOINTS: Record<TMailingListId, string> = {
  security: "https://ee.formbricks.com/api/v1/public/mailing/security/subscriptions",
  "product-updates": "https://ee.formbricks.com/api/v1/public/mailing/product-updates/subscriptions",
} as const;

const EE_SERVER_TIMEOUT_MS = 5000;

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
  validateInputs([email, ZUserEmail.toLowerCase()]);

  const endpoint = MAILING_LIST_ENDPOINTS[listId];
  if (!endpoint) {
    logger.error({ listId }, "Invalid mailing list ID");
    return { success: false, error: "Invalid mailing list ID" };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EE_SERVER_TIMEOUT_MS);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { status: response.status, error: errorText },
        `Failed to subscribe to ${listId} mailing list`
      );
      return { success: false, error: `Failed to subscribe: ${response.status}` };
    }

    logger.info({ listId }, `Successfully subscribed to ${listId} mailing list`);
    return { success: true };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logger.error({ listId }, "Mailing subscription request timed out");
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
