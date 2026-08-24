import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { InvalidInputError } from "@formbricks/types/errors";
import { verifyPassword } from "@/modules/auth/lib/utils";

/**
 * Returns the bcrypt password hash on the user's Better Auth `credential` Account
 * (provider = "credential", providerAccountId = userId), or null when the user has no credential
 * account (e.g. SSO-only users). Post-ENG-1054 the password lives here, NOT on `User.password`
 * (which is null for accounts created after the cutover). Scoped strictly to the given user id.
 */
export const getCredentialPasswordHash = reactCache(async (userId: string): Promise<string | null> => {
  const account = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: { provider: "credential", providerAccountId: userId },
    },
    select: { password: true },
  });

  return account?.password ?? null;
});

export const verifyUserPassword = async (userId: string, password: string): Promise<boolean> => {
  const passwordHash = await getCredentialPasswordHash(userId);

  // Fail closed: no credential account (e.g. SSO-only user) means there is no password to verify
  // against, so the operation must be rejected — never treated as a successful verification.
  if (!passwordHash) {
    throw new InvalidInputError("Password is not set for this user");
  }

  return await verifyPassword(password, passwordHash);
};

/**
 * Whether the user has a Better Auth `credential` Account row at all — i.e. whether they are (or once
 * were) a password user, independently of whether a password is currently set on it.
 *
 * Scoped by `userId` rather than the `(provider, providerAccountId)` key that `getCredentialPasswordHash`
 * uses: `providerAccountId` and `issuer` are account-KEY columns, and a drifted key is a real failure mode
 * in this schema (ENG-2555). Owner-scoping still cannot reach another user's row, and it does not go blind
 * when a key column is wrong.
 *
 * One consequence of erring broad, since this answers a "may they?" question rather than "is there a live
 * hash?": Better Auth's `resetPassword` locates the row via `findCredentialAccount`, which filters on
 * `issuer` and `accountId` too. For a row whose key has drifted this returns true, the reset then takes
 * its create-a-row branch and can collide with `@@unique([provider, providerAccountId])` — a 500 on the
 * reset rather than a security problem, and louder than silently refusing the user a password.
 */
export const hasCredentialAccount = reactCache(async (userId: string): Promise<boolean> => {
  const count = await prisma.account.count({
    where: { userId, provider: "credential" },
  });

  return count > 0;
});
