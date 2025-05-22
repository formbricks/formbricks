import { BackToLoginButton } from "@/modules/auth/components/back-to-login-button";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";

export const EmailChangeWithoutVerificationSuccessPage = async () => {
  const t = await getTranslate();
  const session: Session | null = await getServerSession(authOptions);

  if (session) {
    redirect("/");
  }

  return (
    <div className="bg-gradient-radial flex min-h-screen from-slate-200 to-slate-50">
      <FormWrapper>
        <h1 className="leading-2 mb-4 text-center font-bold">
          {t("auth.email-change.email_change_success")}
        </h1>
        <p className="text-center text-sm">{t("auth.email-change.email_change_success_description")}</p>
        <hr className="my-4" />
        <BackToLoginButton />
      </FormWrapper>
    </div>
  );
};
