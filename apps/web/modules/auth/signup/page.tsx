import { notFound } from "next/navigation";
import {
  AZURE_OAUTH_ENABLED,
  EMAIL_AUTH_ENABLED,
  EMAIL_VERIFICATION_DISABLED,
  GITHUB_OAUTH_ENABLED,
  GOOGLE_OAUTH_ENABLED,
  IS_TURNSTILE_CONFIGURED,
  OIDC_DISPLAY_NAME,
  OIDC_OAUTH_ENABLED,
  PRIVACY_URL,
  SAML_OAUTH_ENABLED,
  SAML_PRODUCT,
  SAML_TENANT,
  SIGNUP_ENABLED,
  TERMS_URL,
  TURNSTILE_SITE_KEY,
  WEBAPP_URL,
} from "@/lib/constants";
import { verifyInviteToken } from "@/lib/jwt";
import { findMatchingLocale } from "@/lib/utils/locale";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { getIsValidInviteToken } from "@/modules/auth/signup/lib/invite";
import {
  getIsMultiOrgEnabled,
  getIsSamlSsoEnabled,
  getIsSsoEnabled,
} from "@/modules/ee/license-check/lib/utils";
import { SignupForm } from "./components/signup-form";

export const SignupPage = async ({ searchParams: searchParamsProps }) => {
  const searchParams = await searchParamsProps;
  const inviteToken = searchParams["inviteToken"] ?? null;
  const [isMultOrgEnabled, isSsoEnabled, isSamlSsoEnabled] = await Promise.all([
    getIsMultiOrgEnabled(),
    getIsSsoEnabled(),
    getIsSamlSsoEnabled(),
  ]);

  const samlSsoEnabled = isSamlSsoEnabled && SAML_OAUTH_ENABLED;
  const locale = await findMatchingLocale();
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

  const emailFromSearchParams = searchParams["email"];

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#00C4B8]">
      <FormWrapper>
        <SignupForm
          webAppUrl={WEBAPP_URL}
          termsUrl={TERMS_URL}
          privacyUrl={PRIVACY_URL}
          emailVerificationDisabled={EMAIL_VERIFICATION_DISABLED}
          emailAuthEnabled={EMAIL_AUTH_ENABLED}
          googleOAuthEnabled={GOOGLE_OAUTH_ENABLED}
          githubOAuthEnabled={GITHUB_OAUTH_ENABLED}
          azureOAuthEnabled={AZURE_OAUTH_ENABLED}
          oidcOAuthEnabled={OIDC_OAUTH_ENABLED}
          oidcDisplayName={OIDC_DISPLAY_NAME}
          userLocale={locale}
          emailFromSearchParams={emailFromSearchParams}
          isSsoEnabled={isSsoEnabled}
          samlSsoEnabled={samlSsoEnabled}
          isTurnstileConfigured={IS_TURNSTILE_CONFIGURED}
          samlTenant={SAML_TENANT}
          samlProduct={SAML_PRODUCT}
          turnstileSiteKey={TURNSTILE_SITE_KEY}
        />
      </FormWrapper>
    </div>
  );
};
