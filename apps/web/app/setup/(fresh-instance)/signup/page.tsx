import { Metadata } from "next";
import {
  AZURE_OAUTH_ENABLED,
  EMAIL_AUTH_ENABLED,
  EMAIL_VERIFICATION_DISABLED,
  GITHUB_OAUTH_ENABLED,
  GOOGLE_OAUTH_ENABLED,
  OIDC_DISPLAY_NAME,
  OIDC_OAUTH_ENABLED,
  PASSWORD_RESET_DISABLED,
} from "@formbricks/lib/constants";
import { SignupOptions } from "@formbricks/ui/SignupOptions";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Open-source Experience Management. Free & open source.",
};

const Page = () => {
  return (
    <div className="flex flex-col items-center">
      <h2 className="mb-6 text-xl font-medium">Create Administrator</h2>
      <p className="text-sm text-slate-800">This user has all the power.</p>
      <hr className="my-6 w-full border-slate-200" />
      <SignupOptions
        emailAuthEnabled={EMAIL_AUTH_ENABLED}
        emailFromSearchParams={""}
        emailVerificationDisabled={EMAIL_VERIFICATION_DISABLED}
        passwordResetEnabled={!PASSWORD_RESET_DISABLED}
        googleOAuthEnabled={GOOGLE_OAUTH_ENABLED}
        githubOAuthEnabled={GITHUB_OAUTH_ENABLED}
        azureOAuthEnabled={AZURE_OAUTH_ENABLED}
        oidcOAuthEnabled={OIDC_OAUTH_ENABLED}
        inviteToken={""}
        callbackUrl={""}
        oidcDisplayName={OIDC_DISPLAY_NAME}
      />
    </div>
  );
};

export default Page;
