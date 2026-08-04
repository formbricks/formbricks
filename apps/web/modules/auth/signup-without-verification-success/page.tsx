import { logger } from "@formbricks/logger";
import { WEBAPP_URL } from "@/lib/constants";
import { getEmailFromEmailToken } from "@/lib/jwt";
import { getTranslate } from "@/lingodotdev/server";
import { BackToLoginButton } from "@/modules/auth/components/back-to-login-button";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { resolveAuthCallbackUrl } from "@/modules/auth/lib/callback-url";

export const SignupWithoutVerificationSuccessPage = async ({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ token?: string | string[]; callbackUrl?: string | string[] }>;
}>) => {
  const t = await getTranslate();
  const { token, callbackUrl } = await searchParams;
  // For an invite sign-up this is `/invite?token=…`, so the log-in button below returns the visitor to
  // the invite instead of the app root. It matters most for an invited address that already has an
  // account: nothing was created and no email is coming, so that button is their only way forward
  // (ENG-2091). Validated against WEBAPP_URL — it comes from a search param.
  const resolvedCallbackUrl = resolveAuthCallbackUrl({
    searchParamCallbackUrl: callbackUrl,
    webAppUrl: WEBAPP_URL,
  });
  let email: string;

  try {
    if (!token || Array.isArray(token)) {
      throw new Error("Missing or invalid signup success token");
    }

    email = getEmailFromEmailToken(token);
  } catch (error) {
    logger.error(error, "Invalid signup success token");
    return (
      <FormWrapper>
        <p className="text-center">{t("auth.verification-requested.invalid_token")}</p>
        <hr className="my-4" />
        <BackToLoginButton callbackUrl={resolvedCallbackUrl} />
      </FormWrapper>
    );
  }

  return (
    <FormWrapper>
      <h1 className="mb-4 text-center leading-2 font-bold">
        {t("auth.signup_without_verification_success.user_successfully_created")}
      </h1>
      <p className="text-center text-sm">
        <span>{t("auth.signup_without_verification_success.user_successfully_created_info", { email })}</span>
      </p>
      <hr className="my-4" />
      <BackToLoginButton callbackUrl={resolvedCallbackUrl} />
    </FormWrapper>
  );
};
