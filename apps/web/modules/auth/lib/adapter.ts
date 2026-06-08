import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { Awaitable } from "next-auth";
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import type { PrismaClient } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { resolveAccountProvider } from "@/modules/ee/sso/lib/provider-normalization";

type TProviderAccountKey = Pick<AdapterAccount, "provider" | "providerAccountId">;

const normalizeProviderKey = <T extends { provider: string }>(value: T): T => ({
  ...value,
  provider: resolveAccountProvider(value.provider),
});

/**
 * Wraps an adapter method so any failure is logged with context before being re-thrown.
 * NextAuth turns the re-thrown error into the relevant auth error page, so we keep the
 * original behaviour while making adapter-level failures observable.
 */
const withAdapterErrorLogging =
  <TArgs extends unknown[], TResult>(method: string, handler: (...args: TArgs) => Awaitable<TResult>) =>
  async (...args: TArgs): Promise<TResult> => {
    try {
      return await handler(...args);
    } catch (error) {
      logger.error(error, `NextAuth Prisma adapter "${method}" failed`);
      throw error;
    }
  };

/**
 * NextAuth resolves accounts by each provider's NextAuth `id` — Microsoft's is "azure-ad" — but
 * Formbricks persists the canonical `IdentityProvider` value ("azuread") in `Account.provider`.
 * Left unreconciled, the adapter's native lookup misses the stored row, falls back to matching by
 * email, and rejects the sign-in with `OAuthAccountNotLinked`.
 *
 * Normalizing the provider at the adapter boundary keeps the native lookup/link/unlink aligned with
 * both the stored rows and the custom SSO sign-in handler for every provider, without leaking
 * provider-specific naming into the call sites.
 */
export const getNextAuthAdapter = (prismaClient: PrismaClient): Adapter => {
  const baseAdapter = PrismaAdapter(prismaClient as unknown as Parameters<typeof PrismaAdapter>[0]);
  const { getUserByAccount, linkAccount, unlinkAccount } = baseAdapter;

  if (!getUserByAccount || !linkAccount || !unlinkAccount) {
    throw new Error("PrismaAdapter is missing the account methods required for SSO sign-in");
  }

  return {
    ...baseAdapter,
    getUserByAccount: withAdapterErrorLogging("getUserByAccount", (providerAccount: TProviderAccountKey) =>
      getUserByAccount(normalizeProviderKey(providerAccount))
    ),
    linkAccount: withAdapterErrorLogging("linkAccount", (account: AdapterAccount) =>
      linkAccount(normalizeProviderKey(account))
    ),
    unlinkAccount: withAdapterErrorLogging("unlinkAccount", (providerAccount: TProviderAccountKey) =>
      unlinkAccount(normalizeProviderKey(providerAccount))
    ),
  };
};
