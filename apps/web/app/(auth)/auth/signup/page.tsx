import { FormWrapper } from "@/app/(auth)/auth/components/FormWrapper";
import { Testimonial } from "@/app/(auth)/auth/components/Testimonial";
import { SignupForm } from "@/app/(auth)/auth/signup/components/SignupForm";
import { notFound } from "next/navigation";
import { getIsMultiOrgEnabled } from "@formbricks/ee/lib/service";
import {
  AZURE_OAUTH_ENABLED,
  EMAIL_AUTH_ENABLED,
  EMAIL_VERIFICATION_DISABLED,
  GITHUB_OAUTH_ENABLED,
  GOOGLE_OAUTH_ENABLED,
  OIDC_DISPLAY_NAME,
  OIDC_OAUTH_ENABLED,
  PASSWORD_RESET_DISABLED,
  PRIVACY_URL,
  SIGNUP_ENABLED,
  TERMS_URL,
  WEBAPP_URL,
} from "@formbricks/lib/constants";

const Page = async ({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) => {
  const inviteToken = searchParams["inviteToken"] ?? null;
  const isMultOrgEnabled = await getIsMultiOrgEnabled();

  if (!inviteToken && (!SIGNUP_ENABLED || !isMultOrgEnabled)) {
    notFound();
  }

  return (
    <div className="grid min-h-screen w-full bg-gradient-to-tr from-slate-100 to-slate-50 lg:grid-cols-5">
      <div className="col-span-2 hidden lg:flex">
        <Testimonial />
      </div>
      <div className="col-span-3 flex flex-col items-center justify-center">
        <FormWrapper>
          <SignupForm
            webAppUrl={WEBAPP_URL}
            termsUrl={TERMS_URL}
            privacyUrl={PRIVACY_URL}
            passwordResetEnabled={!PASSWORD_RESET_DISABLED}
            emailVerificationDisabled={EMAIL_VERIFICATION_DISABLED}
            emailAuthEnabled={EMAIL_AUTH_ENABLED}
            googleOAuthEnabled={GOOGLE_OAUTH_ENABLED}
            githubOAuthEnabled={GITHUB_OAUTH_ENABLED}
            azureOAuthEnabled={AZURE_OAUTH_ENABLED}
            oidcOAuthEnabled={OIDC_OAUTH_ENABLED}
            oidcDisplayName={OIDC_DISPLAY_NAME}
          />
        </FormWrapper>
      </div>
    </div>
  );
};

export default Page;
