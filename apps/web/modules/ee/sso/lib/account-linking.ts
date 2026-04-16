import type { IdentityProvider, Prisma } from "@prisma/client";
import type { Account } from "next-auth";
import { prisma } from "@formbricks/database";
import { OAUTH_ACCOUNT_NOT_LINKED_ERROR } from "@/modules/ee/sso/lib/constants";

export const LINKED_SSO_LOOKUP_SELECT = {
  id: true,
  email: true,
  locale: true,
  emailVerified: true,
  isActive: true,
  identityProvider: true,
  identityProviderAccountId: true,
} as const;

export type TSsoLookupUser = Prisma.UserGetPayload<{
  select: typeof LINKED_SSO_LOOKUP_SELECT;
}>;

export type TSsoAccountLinkInput = Pick<Account, "type" | "provider" | "providerAccountId"> &
  Partial<
    Pick<Account, "access_token" | "refresh_token" | "expires_at" | "scope" | "token_type" | "id_token">
  >;

const getDbClient = (tx?: Prisma.TransactionClient) => tx ?? prisma;

const getAccountTokenUpdate = (account: TSsoAccountLinkInput) => ({
  ...(account.access_token !== undefined ? { access_token: account.access_token } : {}),
  ...(account.refresh_token !== undefined ? { refresh_token: account.refresh_token } : {}),
  ...(account.expires_at !== undefined ? { expires_at: account.expires_at } : {}),
  ...(account.scope !== undefined ? { scope: account.scope } : {}),
  ...(account.token_type !== undefined ? { token_type: account.token_type } : {}),
  ...(account.id_token !== undefined ? { id_token: account.id_token } : {}),
});

export const syncSsoIdentityForUser = async ({
  userId,
  provider,
  account,
  tx,
  legacyAccountIdToNormalize,
}: {
  userId: string;
  provider: IdentityProvider;
  account: TSsoAccountLinkInput;
  tx?: Prisma.TransactionClient;
  legacyAccountIdToNormalize?: string;
}) => {
  const db = getDbClient(tx);
  const existingCanonicalAccount = await db.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId: account.providerAccountId,
      },
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (existingCanonicalAccount && existingCanonicalAccount.userId !== userId) {
    throw new Error(OAUTH_ACCOUNT_NOT_LINKED_ERROR);
  }

  if (legacyAccountIdToNormalize) {
    if (existingCanonicalAccount) {
      await db.account.delete({
        where: {
          id: legacyAccountIdToNormalize,
        },
      });
      await db.account.update({
        where: {
          id: existingCanonicalAccount.id,
        },
        data: getAccountTokenUpdate(account),
      });
    } else {
      await db.account.update({
        where: {
          id: legacyAccountIdToNormalize,
        },
        data: {
          userId,
          type: account.type,
          provider,
          providerAccountId: account.providerAccountId,
          ...getAccountTokenUpdate(account),
        },
      });
    }
  } else if (existingCanonicalAccount) {
    await db.account.update({
      where: {
        id: existingCanonicalAccount.id,
      },
      data: getAccountTokenUpdate(account),
    });
  } else {
    await db.account.create({
      data: {
        userId,
        type: account.type,
        provider,
        providerAccountId: account.providerAccountId,
        ...getAccountTokenUpdate(account),
      },
    });
  }

  await db.user.update({
    where: {
      id: userId,
    },
    data: {
      identityProvider: provider,
      identityProviderAccountId: account.providerAccountId,
    },
  });
};
