import { redirect } from "next/navigation";
import { logger } from "@formbricks/logger";
import { WEBAPP_URL } from "@/lib/constants";
import { verifyAccountDeletionSsoReauthIntent } from "@/lib/jwt";
import { getValidatedCallbackUrl } from "@/lib/utils/url";

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
    } catch (error) {
      logger.error({ error }, "Failed to resolve account deletion SSO reauth callback");
    }
  }

  redirect(redirectPath);
}
