import "server-only";
import { logger } from "@formbricks/logger";
import { AuthorizationError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD, WEBAPP_URL } from "@/lib/constants";
import { verifyAccountDeletionSsoReauthIntent } from "@/lib/jwt";
import { getValidatedCallbackUrl } from "@/lib/utils/url";
import {
  ACCOUNT_DELETION_SSO_REAUTH_ERROR_QUERY_PARAM,
  ACCOUNT_DELETION_SSO_REAUTH_FAILED_ERROR_CODE,
  FORMBRICKS_CLOUD_ACCOUNT_DELETION_SURVEY_URL,
} from "@/modules/account/constants";
import { deleteUserWithAccountDeletionAuthorization } from "@/modules/account/lib/account-deletion";
import { queueAccountDeletionAuditEvent } from "@/modules/account/lib/account-deletion-audit";
import { getSession } from "@/modules/auth/lib/session";

type TAccountDeletionSsoCompleteSearchParams = {
  intent?: string | string[];
};

const getIntentToken = (intent: string | string[] | undefined) => {
  if (Array.isArray(intent)) {
    return intent[0];
  }

  return intent;
};

const getSafeFailureRedirectPath = (returnToUrl: string) => {
  const validatedReturnToUrl = getValidatedCallbackUrl(returnToUrl, WEBAPP_URL);

  if (!validatedReturnToUrl) {
    return "/auth/login";
  }

  const parsedReturnToUrl = new URL(validatedReturnToUrl);
  parsedReturnToUrl.searchParams.set(
    ACCOUNT_DELETION_SSO_REAUTH_ERROR_QUERY_PARAM,
    ACCOUNT_DELETION_SSO_REAUTH_FAILED_ERROR_CODE
  );
  return `${parsedReturnToUrl.pathname}${parsedReturnToUrl.search}${parsedReturnToUrl.hash}`;
};

const getPostDeletionRedirectPath = () =>
  IS_FORMBRICKS_CLOUD ? FORMBRICKS_CLOUD_ACCOUNT_DELETION_SURVEY_URL : "/auth/login";

export const completeAccountDeletionSsoIdentityConfirmationAndGetRedirectPath = async ({
  intent,
}: TAccountDeletionSsoCompleteSearchParams): Promise<string> => {
  const intentToken = getIntentToken(intent);
  let deletionSucceeded = false;
  let redirectPath = "/auth/login";
  let targetUserId: string | null = null;

  if (!intentToken) {
    return redirectPath;
  }

  try {
    const verifiedIntent = verifyAccountDeletionSsoReauthIntent(intentToken);
    targetUserId = verifiedIntent.userId;
    redirectPath = getSafeFailureRedirectPath(verifiedIntent.returnToUrl);
    const session = await getSession();

    if (!session?.user?.id || !session.user.email || session.user.id !== verifiedIntent.userId) {
      throw new AuthorizationError("Account deletion SSO identity confirmation session mismatch");
    }

    logger.info({ userId: session.user.id }, "Completing account deletion after SSO identity confirmation");
    const { oldUser } = await deleteUserWithAccountDeletionAuthorization({
      confirmationEmail: verifiedIntent.email,
      userEmail: session.user.email,
      userId: session.user.id,
    });
    deletionSucceeded = true;
    redirectPath = getPostDeletionRedirectPath();
    await queueAccountDeletionAuditEvent({ oldUser, status: "success", targetUserId: session.user.id });
    logger.info({ userId: session.user.id }, "Completed account deletion after SSO identity confirmation");
  } catch (error) {
    if (targetUserId && !deletionSucceeded) {
      await queueAccountDeletionAuditEvent({ status: "failure", targetUserId });
    }

    logger.error({ error }, "Failed to complete account deletion after SSO identity confirmation");
  }

  return redirectPath;
};
