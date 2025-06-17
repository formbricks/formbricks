import { getEmailFromEmailToken } from "@/lib/jwt";
import { BackToLoginButton } from "@/modules/auth/components/back-to-login-button";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { T, getTranslate } from "@/tolgee/server";

export const SignupWithoutVerificationSuccessPage = async ({ searchParams }) => {
  const t = await getTranslate();
  const { token } = await searchParams;
  const email = getEmailFromEmailToken(token);

  return (
    <FormWrapper>
      <h1 className="leading-2 mb-4 text-center font-bold">
        {t("auth.signup_without_verification_success.user_successfully_created")}
      </h1>
      <p className="text-center text-sm">
        <T
          keyName="auth.signup_without_verification_success.user_successfully_created_info"
          params={{ email, span: <span /> }}
        />
      </p>
      <hr className="my-4" />
      <BackToLoginButton />
    </FormWrapper>
  );
};
