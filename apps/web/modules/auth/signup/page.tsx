import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { Testimonial } from "@/modules/auth/components/testimonial";
import {
  getIsMultiOrgEnabled,
  getIsSAMLSSOEnabled,
  getIsSSOEnabled,
} from "@/modules/ee/license-check/lib/utils";
import { notFound } from "next/navigation";
import {
  AZURE_OAUTH_ENABLED,
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_ORGANIZATION_ROLE,
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
  WEBAPP_URL,
} from "@formbricks/lib/constants";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { SignupForm } from "./components/signup-form";

export const SignupPage = async ({ searchParams: searchParamsProps }) => {
  const searchParams = await searchParamsProps;
  const inviteToken = searchParams["inviteToken"] ?? null;
  const [isMultOrgEnabled, isSSOEnabled, isSAMLSSOEnabled] = await Promise.all([
    getIsMultiOrgEnabled(),
    getIsSSOEnabled(),
    getIsSAMLSSOEnabled(),
  ]);

  const SAMLSSOEnabled = isSAMLSSOEnabled && SAML_OAUTH_ENABLED;

  const locale = await findMatchingLocale();
  if (!inviteToken && (!SIGNUP_ENABLED || !isMultOrgEnabled)) {
    notFound();
  }
  const emailFromSearchParams = searchParams["email"];

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
            emailVerificationDisabled={EMAIL_VERIFICATION_DISABLED}
            emailAuthEnabled={EMAIL_AUTH_ENABLED}
            googleOAuthEnabled={GOOGLE_OAUTH_ENABLED}
            githubOAuthEnabled={GITHUB_OAUTH_ENABLED}
            azureOAuthEnabled={AZURE_OAUTH_ENABLED}
            oidcOAuthEnabled={OIDC_OAUTH_ENABLED}
            oidcDisplayName={OIDC_DISPLAY_NAME}
            userLocale={locale}
            emailFromSearchParams={emailFromSearchParams}
            defaultOrganizationId={DEFAULT_ORGANIZATION_ID}
            defaultOrganizationRole={DEFAULT_ORGANIZATION_ROLE}
            isSSOEnabled={isSSOEnabled}
            SAMLSSOEnabled={SAMLSSOEnabled}
            isTurnstileConfigured={IS_TURNSTILE_CONFIGURED}
            samlTenant={SAML_TENANT}
            samlProduct={SAML_PRODUCT}
          />
        </FormWrapper>
      </div>
    </div>
  );
};
