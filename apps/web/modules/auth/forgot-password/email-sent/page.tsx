import { getTranslate } from "@/lingodotdev/server";
import { AuthHeading } from "@/modules/auth/components/auth-heading";
import { BackToLoginButton } from "@/modules/auth/components/back-to-login-button";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";

export const EmailSentPage = async () => {
  const t = await getTranslate();
  return (
    <FormWrapper>
      <AuthHeading
        title={t("auth.forgot-password.email-sent.heading")}
        description={t("auth.forgot-password.email-sent.text")}
      />
      {/* Shown for every address, known or not, so it reveals nothing about which ones are registered
          (ENG-3262). The matching SSO user also gets a mail naming their provider. */}
      <p className="text-[13px] leading-[18px] text-slate-500">
        {t("auth.forgot-password.email-sent.sso_hint")}
      </p>
      <BackToLoginButton />
    </FormWrapper>
  );
};
