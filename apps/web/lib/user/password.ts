import "server-only";
import { createLocalAccountIssuer } from "@better-auth/core/db";
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
 * Deliberately the SAME predicate Better Auth's own `findCredentialAccount` uses — `userId`, provider
 * `credential`, the `local:credential` issuer, and `accountId` equal to the user id
 * (`better-auth/dist/db/internal-adapter.mjs`). That match matters because this answers "may this user
 * reset a password?", and the only consumer of the answer is `resetPassword`, which locates the row with
 * that exact predicate: erring broader would return true for a row whose key has drifted, the reset
 * would then take its create-a-row branch, and that can collide with `@@unique([provider,
 * providerAccountId])` — a 500 instead of a reset.
 *
 * Note this is the opposite trade-off from the SSO-recovery strip, which scopes by `userId` alone on
 * purpose: a strip must never miss a live hash, so over-matching is the safe direction there. Here
 * over-matching promises something the next call cannot deliver, so under-matching is. Same schema, two
 * different questions.
 *
 * `createLocalAccountIssuer` rather than the `"local:credential"` literal so this tracks upstream if the
 * namespace ever changes — the same reason the Playwright user fixture uses it.
 */
export const hasCredentialAccount = reactCache(async (userId: string): Promise<boolean> => {
  const count = await prisma.account.count({
    where: {
      userId,
      provider: "credential",
      issuer: createLocalAccountIssuer("credential"),
      providerAccountId: userId,
    },
  });

  return count > 0;
});
