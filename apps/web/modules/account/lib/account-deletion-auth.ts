import "server-only";
import type { User } from "@prisma/client";
import { getUserAuthenticationData } from "@/lib/user/password";

type TAccountDeletionPasswordAuthData = Pick<User, "password">;

export type TAccountDeletionAuthRequirements = {
  requiresPasswordConfirmation: boolean;
};

export const requiresPasswordConfirmationForAccountDeletion = ({
  password,
}: TAccountDeletionPasswordAuthData): boolean => Boolean(password);

export const getAccountDeletionAuthRequirements = async (
  userId: string
): Promise<TAccountDeletionAuthRequirements> => {
  const userAuthenticationData = await getUserAuthenticationData(userId);

  return {
    requiresPasswordConfirmation: requiresPasswordConfirmationForAccountDeletion(userAuthenticationData),
  };
};
