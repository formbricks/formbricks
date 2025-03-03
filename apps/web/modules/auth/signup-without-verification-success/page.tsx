import { BackToLoginButton } from "@/modules/auth/components/back-to-login-button";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { getTranslate } from "@/tolgee/server";

export const SignupWithoutVerificationSuccessPage = async () => {
  const t = await getTranslate();
  return (
    <FormWrapper>
      <h1 className="leading-2 mb-4 text-center font-bold">
        {t("auth.signup_without_verification_success.user_successfully_created")}
      </h1>
      <p className="text-center text-sm">
        {t("auth.signup_without_verification_success.user_successfully_created_description")}
      </p>
      <hr className="my-4" />
      <BackToLoginButton />
    </FormWrapper>
  );
};
