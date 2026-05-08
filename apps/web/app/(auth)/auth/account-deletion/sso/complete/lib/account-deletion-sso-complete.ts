import "server-only";
import { getServerSession } from "next-auth";
import { logger } from "@formbricks/logger";
import { AuthorizationError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD, WEBAPP_URL } from "@/lib/constants";
import { verifyAccountDeletionSsoReauthIntent } from "@/lib/jwt";
import { getValidatedCallbackUrl } from "@/lib/utils/url";
import { FORMBRICKS_CLOUD_ACCOUNT_DELETION_SURVEY_URL } from "@/modules/account/constants";
import { deleteUserWithAccountDeletionAuthorization } from "@/modules/account/lib/account-deletion";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";

type TAccountDeletionSsoCompleteSearchParams = {
  intent?: string | string[];
};

const getIntentToken = (intent: string | string[] | undefined) => {
  if (Array.isArray(intent)) {
    return intent[0];
  }

  return intent;
};

const getSafeRedirectPath = (returnToUrl: string) => {
  const validatedReturnToUrl = getValidatedCallbackUrl(returnToUrl, WEBAPP_URL);

  if (!validatedReturnToUrl) {
    return "/auth/login";
  }

  const parsedReturnToUrl = new URL(validatedReturnToUrl);
  return `${parsedReturnToUrl.pathname}${parsedReturnToUrl.search}${parsedReturnToUrl.hash}`;
};

const getPostDeletionRedirectPath = () =>
  IS_FORMBRICKS_CLOUD ? FORMBRICKS_CLOUD_ACCOUNT_DELETION_SURVEY_URL : "/auth/login";

export const completeAccountDeletionSsoReauthenticationAndGetRedirectPath = async ({
  intent,
}: TAccountDeletionSsoCompleteSearchParams): Promise<string> => {
  const intentToken = getIntentToken(intent);
  let redirectPath = "/auth/login";

  if (!intentToken) {
    return redirectPath;
  }

  try {
    const verifiedIntent = verifyAccountDeletionSsoReauthIntent(intentToken);
    redirectPath = getSafeRedirectPath(verifiedIntent.returnToUrl);
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session.user.email || session.user.id !== verifiedIntent.userId) {
      throw new AuthorizationError("Account deletion SSO reauthentication session mismatch");
    }

    logger.info({ userId: session.user.id }, "Completing account deletion after SSO reauth");
    const { oldUser } = await deleteUserWithAccountDeletionAuthorization({
      confirmationEmail: verifiedIntent.email,
      userEmail: session.user.email,
      userId: session.user.id,
    });
    redirectPath = getPostDeletionRedirectPath();
    await queueAuditEventBackground({
      action: "deleted",
      targetType: "user",
      userId: session.user.id,
      userType: "user",
      targetId: session.user.id,
      organizationId: UNKNOWN_DATA,
      oldObject: oldUser,
      status: "success",
    });
    logger.info({ userId: session.user.id }, "Completed account deletion after SSO reauth");
  } catch (error) {
    logger.error({ error }, "Failed to complete account deletion after SSO reauth");
  }

  return redirectPath;
};
