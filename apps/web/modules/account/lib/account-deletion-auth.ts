import "server-only";
import type { User } from "@prisma/client";

type TAccountDeletionPasswordAuthData = Pick<User, "identityProvider">;

export const requiresPasswordConfirmationForAccountDeletion = ({
  identityProvider,
}: TAccountDeletionPasswordAuthData): boolean => identityProvider === "email";
