import "server-only";
import type { IdentityProvider } from "@prisma/client";
import { logger } from "@formbricks/logger";
import { AuthorizationError, InvalidInputError, OperationNotAllowedError } from "@formbricks/types/errors";
import { DISABLE_ACCOUNT_DELETION_SSO_REAUTH } from "@/lib/constants";
import { getOrganizationsWhereUserIsSingleOwner } from "@/lib/organization/service";
import { getUserAuthenticationData, verifyUserPassword } from "@/lib/user/password";
import { deleteUser, getUser } from "@/lib/user/service";
import {
  DELETE_ACCOUNT_EMAIL_CONFIRMATION_MISMATCH_ERROR,
  DELETE_ACCOUNT_WRONG_PASSWORD_ERROR,
  DELETE_USER_CONFIRMATION_REQUIRED_ERROR,
} from "@/modules/account/constants";
import { requiresPasswordConfirmationForAccountDeletion } from "@/modules/account/lib/account-deletion-auth";
import { consumeAccountDeletionSsoReauthentication } from "@/modules/account/lib/account-deletion-sso-reauth";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";

const getPasswordOrThrow = (password?: string) => {
  if (!password) {
    throw new InvalidInputError(DELETE_USER_CONFIRMATION_REQUIRED_ERROR);
  }

  return password;
};

const assertConfirmationEmailMatches = (confirmationEmail: string, expectedEmail: string) => {
  if (confirmationEmail.toLowerCase() !== expectedEmail.toLowerCase()) {
    throw new AuthorizationError(DELETE_ACCOUNT_EMAIL_CONFIRMATION_MISMATCH_ERROR);
  }
};

const canBypassSsoReauthentication = (identityProvider: IdentityProvider) =>
  DISABLE_ACCOUNT_DELETION_SSO_REAUTH && identityProvider !== "email";

export const deleteUserWithAccountDeletionAuthorization = async ({
  confirmationEmail,
  password,
  userEmail,
  userId,
}: {
  confirmationEmail: string;
  password?: string;
  userEmail: string;
  userId: string;
}) => {
  assertConfirmationEmailMatches(confirmationEmail, userEmail);

  const userAuthenticationData = await getUserAuthenticationData(userId);
  assertConfirmationEmailMatches(confirmationEmail, userAuthenticationData.email);

  if (requiresPasswordConfirmationForAccountDeletion(userAuthenticationData)) {
    const isCorrectPassword = await verifyUserPassword(userId, getPasswordOrThrow(password));
    if (!isCorrectPassword) {
      throw new AuthorizationError(DELETE_ACCOUNT_WRONG_PASSWORD_ERROR);
    }
  } else if (canBypassSsoReauthentication(userAuthenticationData.identityProvider)) {
    logger.warn(
      { identityProvider: userAuthenticationData.identityProvider, userId },
      "Account deletion SSO reauthentication bypassed by environment configuration"
    );
  } else {
    await consumeAccountDeletionSsoReauthentication({
      identityProvider: userAuthenticationData.identityProvider,
      providerAccountId: userAuthenticationData.identityProviderAccountId,
      userId,
    });
  }

  const isMultiOrgEnabled = await getIsMultiOrgEnabled();
  if (!isMultiOrgEnabled) {
    const organizationsWithSingleOwner = await getOrganizationsWhereUserIsSingleOwner(userId);
    if (organizationsWithSingleOwner.length > 0) {
      throw new OperationNotAllowedError(
        "You are the only owner of this organization. Please transfer ownership to another member first."
      );
    }
  }

  const oldUser = await getUser(userId);
  if (!oldUser) {
    throw new AuthorizationError("User not found");
  }

  await deleteUser(userId);

  return { oldUser };
};
