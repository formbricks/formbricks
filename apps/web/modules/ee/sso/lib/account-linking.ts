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

const ACCOUNT_TOKEN_FIELDS = [
  "access_token",
  "refresh_token",
  "expires_at",
  "scope",
  "token_type",
  "id_token",
] as const;

type TAccountTokenField = (typeof ACCOUNT_TOKEN_FIELDS)[number];
type TAccountTokenUpdate = Partial<Pick<TSsoAccountLinkInput, TAccountTokenField>>;

const setAccountTokenField = <TField extends TAccountTokenField>(
  accountTokenUpdate: TAccountTokenUpdate,
  account: TSsoAccountLinkInput,
  field: TField
) => {
  const value = account[field];

  if (value !== undefined) {
    accountTokenUpdate[field] = value;
  }
};

const getAccountTokenUpdate = (account: TSsoAccountLinkInput): TAccountTokenUpdate => {
  const accountTokenUpdate: TAccountTokenUpdate = {};

  for (const field of ACCOUNT_TOKEN_FIELDS) {
    setAccountTokenField(accountTokenUpdate, account, field);
  }

  return accountTokenUpdate;
};

const syncSsoIdentityForUserWithTx = async ({
  userId,
  provider,
  account,
  tx,
  legacyAccountIdToNormalize,
}: {
  userId: string;
  provider: IdentityProvider;
  account: TSsoAccountLinkInput;
  tx: Prisma.TransactionClient;
  legacyAccountIdToNormalize?: string;
}) => {
  const existingCanonicalAccount = await tx.account.findUnique({
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
      await tx.account.delete({
        where: {
          id: legacyAccountIdToNormalize,
        },
      });
      await tx.account.update({
        where: {
          id: existingCanonicalAccount.id,
        },
        data: getAccountTokenUpdate(account),
      });
    } else {
      await tx.account.update({
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
    await tx.account.update({
      where: {
        id: existingCanonicalAccount.id,
      },
      data: getAccountTokenUpdate(account),
    });
  } else {
    await tx.account.create({
      data: {
        userId,
        type: account.type,
        provider,
        providerAccountId: account.providerAccountId,
        ...getAccountTokenUpdate(account),
      },
    });
  }

  await tx.user.update({
    where: {
      id: userId,
    },
    data: {
      identityProvider: provider,
      identityProviderAccountId: account.providerAccountId,
    },
  });
};

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
  if (tx) {
    await syncSsoIdentityForUserWithTx({
      userId,
      provider,
      account,
      tx,
      legacyAccountIdToNormalize,
    });
    return;
  }

  await prisma.$transaction(async (transactionTx) => {
    await syncSsoIdentityForUserWithTx({
      userId,
      provider,
      account,
      tx: transactionTx,
      legacyAccountIdToNormalize,
    });
  });
};
