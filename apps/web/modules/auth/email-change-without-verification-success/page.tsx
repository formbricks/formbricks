import { redirect } from "next/navigation";
import type { Session } from "@formbricks/types/auth";
import { getTranslate } from "@/lingodotdev/server";
import { AuthHeading } from "@/modules/auth/components/auth-heading";
import { BackToLoginButton } from "@/modules/auth/components/back-to-login-button";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { getSession } from "@/modules/auth/lib/session";

export const EmailChangeWithoutVerificationSuccessPage = async () => {
  const t = await getTranslate();
  const session: Session | null = await getSession();

  if (session) {
    redirect("/");
  }

  return (
    <FormWrapper>
      <AuthHeading
        title={t("auth.email-change.email_change_success")}
        description={t("auth.email-change.email_change_success_description")}
      />
      <BackToLoginButton />
    </FormWrapper>
  );
};
