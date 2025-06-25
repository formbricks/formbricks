import { BackToLoginButton } from "@/modules/auth/components/back-to-login-button";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { getTranslate } from "@/tolgee/server";

export const ResetPasswordSuccessPage = async () => {
  const t = await getTranslate();
  return (
    <FormWrapper>
      <div>
        <h1 className="leading-2 mb-4 text-center font-bold">
          {t("auth.forgot-password.reset.success.heading")}
        </h1>
        <p className="text-center">{t("auth.forgot-password.reset.success.text")}</p>
        <div className="mt-3 text-center">
          <BackToLoginButton />
        </div>
      </div>
    </FormWrapper>
  );
};
