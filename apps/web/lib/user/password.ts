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
