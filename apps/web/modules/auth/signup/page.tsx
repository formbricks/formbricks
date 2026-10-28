import { notFound } from "next/navigation";
import { SIGNUP_ENABLED, WEBAPP_URL } from "@/lib/constants";
import { verifyInviteToken } from "@/lib/jwt";
import { getTranslate } from "@/lingodotdev/server";
import { AuthHeading } from "@/modules/auth/components/auth-heading";
import { AuthCard, AuthPage } from "@/modules/auth/components/form-wrapper";
import { SignupFooter } from "@/modules/auth/signup/components/signup-footer";
import { SignupFormLoader } from "@/modules/auth/signup/components/signup-form-loader";
import { getIsValidInviteToken } from "@/modules/auth/signup/lib/invite";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";

export const SignupPage = async ({
  searchParams: searchParamsProps,
}: {
  searchParams: Promise<Record<string, string>>;
}) => {
  const searchParams = await searchParamsProps;
  const inviteToken = searchParams["inviteToken"] ?? null;
  const [isMultOrgEnabled, t] = await Promise.all([getIsMultiOrgEnabled(), getTranslate()]);
  if (!SIGNUP_ENABLED || !isMultOrgEnabled) {
    if (!inviteToken) notFound();

    try {
      const { inviteId } = verifyInviteToken(inviteToken);
      const isValidInviteToken = await getIsValidInviteToken(inviteId);

      if (!isValidInviteToken) notFound();
    } catch {
      notFound();
    }
  }

  return (
    <AuthPage>
      <AuthCard>
        <AuthHeading title={t("shell.auth.signup.title")} description={t("shell.auth.signup.description")} />
        <SignupFormLoader emailFromSearchParams={searchParams["email"]} />
      </AuthCard>
      <SignupFooter webAppUrl={WEBAPP_URL} />
    </AuthPage>
  );
};
