import "server-only";
import { logger } from "@formbricks/logger";
import type { TUserLocale } from "@formbricks/types/user";
import { getSsoProviderDisplayNames } from "@/modules/ee/sso/lib/provider-display-name";
import type { TSsoIdentityProvider } from "@/modules/ee/sso/lib/provider-normalization";
import { sendSsoSignInHintEmail } from "@/modules/email";

type TSsoSignInHintUser = {
  id: string;
  email: string;
  locale: string;
};

/**
 * Mail a user who asked for a password reset but signs in with SSO, telling them which identity provider
 * to use instead (ENG-3262). Without it they wait for a reset link that is never sent, since the
 * forgot-password page cannot say why without revealing which addresses are registered.
 *
 * `providers` are the user's providers the login page currently offers (`getOfferedSsoProviders`): one the
 * operator has unconfigured or whose licence lapsed would send the user looking for a button that is not
 * there. When it is empty, the mail says so and points at their administrator instead.
 *
 * Never throws: it runs after the response is sent, where nothing would catch it, so every failure is
 * logged and swallowed.
 */
export const sendSsoSignInHint = async (
  user: TSsoSignInHintUser,
  providers: readonly TSsoIdentityProvider[]
): Promise<void> => {
  try {
    const sent = await sendSsoSignInHintEmail({
      email: user.email,
      // Same cast as `getUserLocale` in auth.ts: the column is a plain string holding a `ZUserLocale` value.
      locale: user.locale as TUserLocale,
      providerNames: getSsoProviderDisplayNames(providers),
    });
    if (!sent) {
      // `sendEmail` reports an unconfigured mailer by returning false, not by throwing (ENG-2091).
      logger.error({ userId: user.id }, "SSO sign-in hint email was not sent (mailer reported no delivery)");
    }
  } catch (error) {
    // `err`, not `error`: pino serializes an Error's message and stack only under `err`, and after the
    // response this line is the only trace a failure leaves.
    logger.error({ err: error, userId: user.id }, "Failed to send SSO sign-in hint email");
  }
};
