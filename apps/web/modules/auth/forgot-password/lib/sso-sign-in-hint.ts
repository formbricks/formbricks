import "server-only";
import { prisma } from "@formbricks/database";
import type { IdentityProvider } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import type { TUserLocale } from "@formbricks/types/user";
import { getSsoProviderDisplayName } from "@/modules/ee/sso/lib/provider-display-name";
import { type TSsoIdentityProvider, normalizeSsoProvider } from "@/modules/ee/sso/lib/provider-normalization";
import { sendSsoSignInHintEmail } from "@/modules/email";

type TSsoSignInHintUser = {
  id: string;
  email: string;
  locale: string;
  identityProvider: IdentityProvider;
};

/**
 * The identity providers this user can sign in with, as the login page names them.
 *
 * Read from the linked `Account` rows rather than `identityProvider` alone: that column records only the
 * provider the account was created with, while a user can have linked more since. It is still folded in
 * as a fallback, because it is what every SSO-created account carries even if its row is somehow gone.
 * Unknown provider strings are dropped rather than shown raw.
 */
export const getSsoSignInProviderNames = async (user: {
  id: string;
  identityProvider: IdentityProvider;
}): Promise<string[]> => {
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

  return [...providers].map(getSsoProviderDisplayName);
};

/**
 * Mail a user who asked for a password reset but has no password, telling them which identity provider
 * to sign in with instead (ENG-3262). Without it they wait for a reset link that is never sent, since the
 * forgot-password page cannot say why without revealing which addresses are registered.
 *
 * Never throws: the caller answers `{ success: true }` regardless, so a failure here is logged and
 * swallowed exactly like a failed reset send.
 */
export const sendSsoSignInHint = async (user: TSsoSignInHintUser): Promise<void> => {
  try {
    const providerNames = await getSsoSignInProviderNames(user);
    if (providerNames.length === 0) {
      // Unreachable for an account the caller routes here — that needs a non-email identity provider,
      // which always resolves to a name. Logged rather than sent: an empty list would read as nonsense.
      logger.warn({ userId: user.id }, "No SSO provider found for a user without a password");
      return;
    }

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
    logger.error({ error, userId: user.id }, "Failed to send SSO sign-in hint email");
  }
};
