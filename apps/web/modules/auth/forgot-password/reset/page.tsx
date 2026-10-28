import { getTranslate } from "@/lingodotdev/server";
import { AuthHeading } from "@/modules/auth/components/auth-heading";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { ResetPasswordForm } from "@/modules/auth/forgot-password/reset/components/reset-password-form";

export const ResetPasswordPage = async () => {
  const t = await getTranslate();

  return (
    <FormWrapper>
      <AuthHeading
        title={t("shell.auth.reset_password.title")}
        description={t("shell.auth.reset_password.description")}
      />
      <ResetPasswordForm />
    </FormWrapper>
  );
};
