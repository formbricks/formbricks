import "server-only";
import { prisma } from "@formbricks/database";
import type { IdentityProvider } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import type { TUserLocale } from "@formbricks/types/user";
import { getSsoProviderDisplayName } from "@/modules/ee/sso/lib/provider-display-name";
import { type TSsoIdentityProvider, normalizeSsoProvider } from "@/modules/ee/sso/lib/provider-normalization";
import { getSsoAvailability } from "@/modules/ee/sso/lib/sso-availability";
import { sendSsoSignInHintEmail } from "@/modules/email";

type TSsoSignInHintUser = {
  id: string;
  email: string;
  locale: string;
  isActive: boolean;
  identityProvider: IdentityProvider;
};

/**
 * The SSO providers linked to this user, the one the account was created with first.
 *
 * Read from the linked `Account` rows rather than `identityProvider` alone: that column records only the
 * provider the account was created with, while a user can have linked more since. It is still folded in
 * as a fallback, because it is what every SSO-created account carries even if its row is somehow gone.
 * Unknown provider strings are dropped rather than shown raw.
 */
export const getLinkedSsoProviders = async (user: {
  id: string;
  identityProvider: IdentityProvider;
}): Promise<TSsoIdentityProvider[]> => {
  const accounts = await prisma.account.findMany({
    where: { userId: user.id, provider: { not: "credential" } },
    select: { provider: true },
  });

  const providers = new Set<TSsoIdentityProvider>();
  for (const candidate of [user.identityProvider, ...accounts.map((account) => account.provider)]) {
    const provider = normalizeSsoProvider(candidate);
    if (provider) {
      providers.add(provider);
    }
  }
  return [...providers];
};

/**
 * Mail a user who asked for a password reset but has no password, telling them which identity provider
 * to sign in with instead (ENG-3262). Without it they wait for a reset link that is never sent, since the
 * forgot-password page cannot say why without revealing which addresses are registered.
 *
 * Only providers the login page currently offers are named: one the operator has unconfigured or whose
 * licence lapsed would send the user looking for a button that is not there. When none of theirs is
 * offered, the mail says so and points at their administrator instead.
 *
 * Never throws: it runs after the response is sent, where nothing would catch it, so every failure is
 * logged and swallowed.
 */
export const sendSsoSignInHint = async (user: TSsoSignInHintUser): Promise<void> => {
  try {
    // A deactivated user cannot sign in by any route, so "sign in with Microsoft" would be false.
    if (!user.isActive) {
      return;
    }

    const linkedProviders = await getLinkedSsoProviders(user);
    if (linkedProviders.length === 0) {
      // Unreachable for an account the caller routes here — that needs a non-email identity provider,
      // which always resolves to one. Logged rather than sent: there is nothing true to tell them.
      logger.warn({ userId: user.id }, "No SSO provider found for a user without a password");
      return;
    }

    const { providers: offered } = await getSsoAvailability();
    // De-duplicated by name too: an operator can call their OIDC provider "Microsoft" alongside Azure AD.
    const providerNames = [
      ...new Set(linkedProviders.filter((provider) => offered[provider]).map(getSsoProviderDisplayName)),
    ];

    const sent = await sendSsoSignInHintEmail({
      email: user.email,
      // Same cast as `getUserLocale` in auth.ts: the column is a plain string holding a `ZUserLocale` value.
      locale: user.locale as TUserLocale,
      providerNames,
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
