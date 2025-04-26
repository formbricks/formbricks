import { BackToLoginButton } from "@/modules/auth/components/back-to-login-button";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { getTranslate } from "@/tolgee/server";

export const EmailChangeWithoutVerificationSuccessPage = async () => {
  const t = await getTranslate();
  return (
    <FormWrapper>
      <h1 className="mb-4 text-center leading-2 font-bold">
        {t("auth.email_change_success", "Email has been successfully changed.")}
      </h1>
      <p className="text-center text-sm">
        {t("auth.email_change_success_description", "You can now log in using your new email address.")}
      </p>
      <hr className="my-4" />
      <BackToLoginButton />
    </FormWrapper>
  );
};
