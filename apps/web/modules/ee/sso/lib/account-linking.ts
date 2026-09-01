import { prisma } from "@formbricks/database";
import type { IdentityProvider, Prisma } from "@formbricks/database/prisma";
import type { Account } from "@formbricks/types/auth";
import { OAUTH_ACCOUNT_NOT_LINKED_ERROR, canonicalAccountIssuer } from "@/modules/ee/sso/lib/constants";

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
        // `issuer` too, and the CANONICAL value (ENG-2555): the row may predate the ENG-2343 backfill
        // window (NULL) or carry the synthetic form where the provider declares its own — either way
        // 1.7's account lookup cannot see it until this write corrects it.
        data: { issuer: canonicalAccountIssuer(provider), ...getAccountTokenUpdate(account) },
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
          // Same reason as the create branch below: normalising a legacy row without setting `issuer`
          // leaves it unmatched by 1.7's account lookup (ENG-2343).
          issuer: canonicalAccountIssuer(provider),
          ...getAccountTokenUpdate(account),
        },
      });
    }
  } else if (existingCanonicalAccount) {
    await tx.account.update({
      where: {
        id: existingCanonicalAccount.id,
      },
      // `issuer` here too, and this branch is the one that matters most (ENG-2555). It is the branch
      // every attempt after the first takes, so while it wrote only tokens a row created with a wrong
      // or NULL issuer could never heal: sign-in could not see it, recovery ran again, and this update
      // left the bad value untouched. Writing the canonical value makes the next sign-in repair it.
      // The row's ownership is already asserted above, and the value derives from `provider`, so this
      // cannot rebind the row to another identity.
      data: { issuer: canonicalAccountIssuer(provider), ...getAccountTokenUpdate(account) },
    });
  } else {
    await tx.account.create({
      data: {
        userId,
        type: account.type,
        provider,
        providerAccountId: account.providerAccountId,
        // 1.7 keys the account on `(issuer, accountId)` and `findAccountByKey` filters on `issuer`, so a
        // row written with a missing OR non-canonical issuer is invisible to every later sign-in: the
        // user completes verify-before-link, gets a session, and is pushed back through recovery on the
        // NEXT sign-in, forever. The migration cannot save them either — it runs once, before this row
        // exists. NOT the same helper the provider config pins (`ssoAccountIssuer`): google's canonical
        // issuer is the one upstream declares, not the synthetic form, which is exactly the bug that
        // shipped here (ENG-2555). `canonicalAccountIssuer` mirrors the backfill's CASE and is pinned
        // against both the SQL and upstream in constants.test.ts, so the sites cannot drift.
        issuer: canonicalAccountIssuer(provider),
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
