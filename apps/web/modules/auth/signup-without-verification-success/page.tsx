import { logger } from "@formbricks/logger";
import { getEmailFromEmailToken } from "@/lib/jwt";
import { getTranslate } from "@/lingodotdev/server";
import { BackToLoginButton } from "@/modules/auth/components/back-to-login-button";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";

export const SignupWithoutVerificationSuccessPage = async ({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ token?: string | string[] }>;
}>) => {
  const t = await getTranslate();
  const { token } = await searchParams;
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
        <BackToLoginButton />
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
      <BackToLoginButton />
    </FormWrapper>
  );
};
