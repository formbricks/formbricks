import Link from "next/link";
import { SignupForm } from "@/components/auth/SignupForm";
import FormWrapper from "@/components/auth/FormWrapper";
import Testimonial from "@/components/auth/Testimonial";
import {
  EMAIL_VERIFICATION_DISABLED,
  GITHUB_OAUTH_ENABLED,
  GOOGLE_OAUTH_ENABLED,
  INVITE_DISABLED,
  PASSWORD_RESET_DISABLED,
  PRIVACY_URL,
  SIGNUP_ENABLED,
  TERMS_URL,
  WEBAPP_URL,
} from "@formbricks/lib/constants";

export default function SignUpPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const inviteToken = searchParams["inviteToken"] ?? null;

  return (
    <div className="grid min-h-screen w-full bg-gradient-to-tr from-slate-100 to-slate-50 lg:grid-cols-5">
      <div className="col-span-2 hidden lg:flex">
        <Testimonial />
      </div>
      <div className="col-span-3 flex flex-col items-center justify-center">
        <FormWrapper>
          {(inviteToken ? INVITE_DISABLED : !SIGNUP_ENABLED) ? (
            <>
              <h1 className="leading-2 mb-4 text-center font-bold">Sign up disabled</h1>
              <p className="text-center">
                The account creation is disabled in this instance. Please contact the site administrator to
                create an account.
              </p>
              <hr className="my-4" />
              <Link
                href="/"
                className="mt-5 flex w-full justify-center rounded-md border border-slate-400 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
                Login
              </Link>
            </>
          ) : (
            <SignupForm
              webAppUrl={WEBAPP_URL}
              termsUrl={TERMS_URL}
              privacyUrl={PRIVACY_URL}
              passwordResetEnabled={!PASSWORD_RESET_DISABLED}
              emailVerificationDisabled={EMAIL_VERIFICATION_DISABLED}
              googleOAuthEnabled={GOOGLE_OAUTH_ENABLED}
              githubOAuthEnabled={GITHUB_OAUTH_ENABLED}
            />
          )}
        </FormWrapper>
      </div>
    </div>
  );
}
