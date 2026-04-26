import "server-only";
import type { Account } from "next-auth";
import { prisma } from "@formbricks/database";
import type { TUser } from "@formbricks/types/user";
import { createMembership } from "@/lib/membership/service";
import { findMatchingLocale } from "@/lib/utils/locale";
import { createUser, getUserByEmail, updateUser } from "@/modules/auth/lib/user";

export const handleMicrosoftCallback = async ({
  user,
  account,
}: {
  user: TUser;
  account: Account;
}): Promise<boolean> => {
  if (!user.email || account.provider !== "azure-ad") {
    return false;
  }

  const existingUserByProvider = await prisma.user.findFirst({
    where: {
      identityProvider: "azuread",
      identityProviderAccountId: account.providerAccountId,
    },
  });

  if (existingUserByProvider) {
    if (existingUserByProvider.email === user.email) {
      return true;
    }

    const conflict = await getUserByEmail(user.email);
    if (!conflict) {
      await updateUser(existingUserByProvider.id, { email: user.email });
      return true;
    }

    throw new Error("Email conflict: another account already uses this email.");
  }

  const existingByEmail = await getUserByEmail(user.email);
  if (existingByEmail) {
    return true;
  }

  const newUser = await createUser({
    name: user.name || user.email.split("@")[0],
    email: user.email,
    emailVerified: new Date(),
    identityProvider: "azuread",
    identityProviderAccountId: account.providerAccountId,
    locale: await findMatchingLocale(),
  });

  const firstOrg = await prisma.organization.findFirst();
  if (firstOrg) {
    await createMembership(firstOrg.id, newUser.id, { role: "member", accepted: true });
  }

  return true;
};
