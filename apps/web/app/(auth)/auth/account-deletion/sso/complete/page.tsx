import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
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

export default async function AccountDeletionSsoReauthCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string | string[] }>;
}) {
  const intentToken = getIntentToken((await searchParams).intent);
  let redirectPath = "/auth/login";

  if (intentToken) {
    try {
      const intent = verifyAccountDeletionSsoReauthIntent(intentToken);
      redirectPath = getSafeRedirectPath(intent.returnToUrl);
      const session = await getServerSession(authOptions);

      if (!session?.user?.id || !session.user.email || session.user.id !== intent.userId) {
        throw new AuthorizationError("Account deletion SSO reauthentication session mismatch");
      }

      logger.info({ userId: session.user.id }, "Completing account deletion after SSO reauth");
      const { oldUser } = await deleteUserWithAccountDeletionAuthorization({
        confirmationEmail: intent.email,
        userEmail: session.user.email,
        userId: session.user.id,
      });
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
      redirectPath = getPostDeletionRedirectPath();
    } catch (error) {
      logger.error({ error }, "Failed to complete account deletion after SSO reauth");
    }
  }

  redirect(redirectPath);
}
