import "server-only";
import { prisma } from "@formbricks/database";
import type { IdentityProvider } from "@formbricks/database/prisma";
import { type TSsoIdentityProvider, normalizeSsoProvider } from "./provider-normalization";
import { getSsoAvailability } from "./sso-availability";

/** What the SSO provider lookups need of a user. */
export type TSsoLinkedUser = {
  id: string;
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
export const getLinkedSsoProviders = async (user: TSsoLinkedUser): Promise<TSsoIdentityProvider[]> => {
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
 * The user's linked SSO providers that this instance offers right now: licensed and configured, the same
 * test that decides which buttons the login page shows (`getSsoAvailability`).
 *
 * Empty for a password user, and for an SSO user whose every provider is unavailable — a lapsed licence,
 * SAML without its licence, or a provider the operator unconfigured. Callers read empty as "this user can
 * not sign in with SSO here", which is what lets password sign-in and the reset link come back for them
 * (ENG-2590). Throws when the lookup fails; a caller that gates on it must fail closed.
 */
export const getOfferedSsoProviders = async (user: TSsoLinkedUser): Promise<TSsoIdentityProvider[]> => {
  if (user.identityProvider === "email") return [];

  const [linked, { providers: offered }] = await Promise.all([
    getLinkedSsoProviders(user),
    getSsoAvailability(),
  ]);
  return linked.filter((provider) => offered[provider]);
};
