import { getTranslate } from "@/lingodotdev/server";
import { AuthHeading } from "@/modules/auth/components/auth-heading";
import { BackToLoginButton } from "@/modules/auth/components/back-to-login-button";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";

export const ResetPasswordSuccessPage = async () => {
  const t = await getTranslate();
  return (
    <FormWrapper>
      <AuthHeading
        title={t("auth.forgot-password.reset.success.heading")}
        description={t("auth.forgot-password.reset.success.text")}
      />
      <BackToLoginButton />
    </FormWrapper>
  );
};
