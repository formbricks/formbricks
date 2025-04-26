import { BackToLoginButton } from "@/modules/auth/components/back-to-login-button";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { getTranslate } from "@/tolgee/server";

export const EmailChangeWithoutVerificationSuccessPage = async () => {
  const t = await getTranslate();
  return (
    <FormWrapper>
      <h1 className="mb-4 text-center leading-2 font-bold">{t("auth.email-change.email_change_success")}</h1>
      <p className="text-center text-sm">{t("auth.email-change.email_change_success_description")}</p>
      <hr className="my-4" />
      <BackToLoginButton />
    </FormWrapper>
  );
};
