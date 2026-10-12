import { getTranslate } from "@/lingodotdev/server";
import { BackToLoginButton } from "@/modules/auth/components/back-to-login-button";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";

export const EmailSentPage = async () => {
  const t = await getTranslate();
  return (
    <FormWrapper>
      <div>
        <h1 className="mb-4 text-center leading-2 font-bold">
          {t("auth.forgot-password.email-sent.heading")}
        </h1>
        <p className="text-center">{t("auth.forgot-password.email-sent.text")}</p>
        {/* Shown for every address, known or not, so it reveals nothing about which ones are registered
            (ENG-3262). The matching SSO user also gets a mail naming their provider. */}
        <p className="mt-4 text-center text-sm text-slate-500">
          {t("auth.forgot-password.email-sent.sso_hint")}
        </p>
        <div className="mt-5 text-center">
          <BackToLoginButton />
        </div>
      </div>
    </FormWrapper>
  );
};
