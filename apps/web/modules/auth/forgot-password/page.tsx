import { getTranslate } from "@/lingodotdev/server";
import { AuthHeading } from "@/modules/auth/components/auth-heading";
import { AuthLink } from "@/modules/auth/components/auth-link";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { ForgotPasswordForm } from "@/modules/auth/forgot-password/components/forgot-password-form";

export const ForgotPasswordPage = async () => {
  const t = await getTranslate();

  return (
    <FormWrapper footer={<AuthLink href="/auth/login">{t("auth.forgot-password.back_to_login")}</AuthLink>}>
      <AuthHeading
        title={t("shell.auth.forgot_password.title")}
        description={t("shell.auth.forgot_password.description")}
      />
      <ForgotPasswordForm />
    </FormWrapper>
  );
};
