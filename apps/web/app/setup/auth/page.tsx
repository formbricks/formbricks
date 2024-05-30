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
import { FormbricksLogo } from "@formbricks/ui/FormbricksLogo";
import { SignupOptions } from "@formbricks/ui/SignupOptions";

export const metadata: Metadata = {
  title: "Login",
  description: "Open-source Experience Management. Free & open source.",
};

const Page = () => {
  return (
    <div className="flex w-[40rem] flex-col items-center space-y-4 rounded-lg border bg-white p-20 text-center shadow">
      <FormbricksLogo className="h-20 w-20 rounded-lg bg-black p-2" />
      <h2 className="text-2xl font-medium">Create Administrator</h2>
      <p>This user has all the power.</p>
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
      <p className="text-slate-400">Privacy-first Experience Management</p>
    </div>
  );
};

export default Page;
