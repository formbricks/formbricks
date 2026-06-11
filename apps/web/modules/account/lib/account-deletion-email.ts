import "server-only";
import { logger } from "@formbricks/logger";
import { TUserLocale } from "@formbricks/types/user";
import { sendAccountDeletionEmail } from "@/modules/email";

/**
 * Sends the account deletion confirmation email in the background.
 * Runs after the response is sent and never throws, so email delivery
 * failures cannot block or roll back the account deletion itself.
 */
export const queueAccountDeletionEmailBackground = ({
  email,
  locale,
  userId,
}: {
  email: string;
  locale: TUserLocale;
  userId: string;
}) => {
  setImmediate(async () => {
    try {
      await sendAccountDeletionEmail({ email, locale });
    } catch (error) {
      logger.error({ error, userId }, "Failed to send account deletion confirmation email");
    }
  });
};
