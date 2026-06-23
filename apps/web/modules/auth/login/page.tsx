import { Metadata } from "next";
import {
  AZURE_OAUTH_ENABLED,
  EMAIL_AUTH_ENABLED,
  GITHUB_OAUTH_ENABLED,
  GOOGLE_OAUTH_ENABLED,
  OIDC_DISPLAY_NAME,
  OIDC_OAUTH_ENABLED,
  PASSWORD_RESET_DISABLED,
  SAML_OAUTH_ENABLED,
  SIGNUP_ENABLED,
  WEBAPP_URL,
} from "@/lib/constants";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import {
  getInviteTokenFromCallbackUrl,
  getRelativeCallbackUrl,
  getSearchParamString,
  resolveAuthCallbackUrl,
} from "@/modules/auth/lib/callback-url";
import {
  getIsMultiOrgEnabled,
  getIsSamlSsoEnabled,
  getIsSsoEnabled,
} from "@/modules/ee/license-check/lib/utils";
import { LoginForm } from "./components/login-form";

export const metadata: Metadata = {
  title: "Login",
  description: "Open-source Experience Management. Free & open source.",
};

export const LoginPage = async ({
  searchParams: searchParamsProps,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const [isMultiOrgEnabled, isSsoEnabled, isSamlSsoEnabled, searchParams] = await Promise.all([
    getIsMultiOrgEnabled(),
    getIsSsoEnabled(),
    getIsSamlSsoEnabled(),
    searchParamsProps,
  ]);
  const oauthError = getSearchParamString(searchParams.error);

  const resolvedCallbackUrl =
    resolveAuthCallbackUrl({
      searchParamCallbackUrl: searchParams.callbackUrl,
      webAppUrl: WEBAPP_URL,
    }) ?? WEBAPP_URL;
  const resolvedCallbackPath = getRelativeCallbackUrl(resolvedCallbackUrl, WEBAPP_URL);
  const inviteToken = getInviteTokenFromCallbackUrl(resolvedCallbackUrl, WEBAPP_URL);
  const samlSsoEnabled = isSamlSsoEnabled && SAML_OAUTH_ENABLED;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#D9F6F4]">
      <FormWrapper>
        <LoginForm
          emailAuthEnabled={EMAIL_AUTH_ENABLED}
          publicSignUpEnabled={SIGNUP_ENABLED}
          passwordResetEnabled={!PASSWORD_RESET_DISABLED}
          googleOAuthEnabled={GOOGLE_OAUTH_ENABLED}
          githubOAuthEnabled={GITHUB_OAUTH_ENABLED}
          azureOAuthEnabled={AZURE_OAUTH_ENABLED}
          oidcOAuthEnabled={OIDC_OAUTH_ENABLED}
          oidcDisplayName={OIDC_DISPLAY_NAME}
          isMultiOrgEnabled={isMultiOrgEnabled}
          isSsoEnabled={isSsoEnabled}
          samlSsoEnabled={samlSsoEnabled}
          oauthError={oauthError}
          prefilledEmail={getSearchParamString(searchParams.email)}
          inviteToken={inviteToken}
          resolvedCallbackPath={resolvedCallbackPath}
          resolvedCallbackUrl={resolvedCallbackUrl}
        />
      </FormWrapper>
    </div>
  );
};
