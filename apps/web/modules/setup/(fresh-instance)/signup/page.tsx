import { SignupForm } from "@/modules/auth/signup/components/signup-form";
import { getIsSSOEnabled } from "@/modules/ee/license-check/lib/utils";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
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
  TERMS_URL,
  WEBAPP_URL,
} from "@formbricks/lib/constants";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Open-source Experience Management. Free & open source.",
};

export const SignupPage = async () => {
  const locale = await findMatchingLocale();
  const isSSOEnabled = await getIsSSOEnabled();
  const t = await getTranslations();
  return (
    <div className="flex flex-col items-center">
      <h2 className="mb-6 text-xl font-medium">{t("setup.signup.create_administrator")}</h2>
      <p className="text-sm text-slate-800">{t("setup.signup.this_user_has_all_the_power")}</p>
      <hr className="my-6 w-full border-slate-200" />
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
        defaultOrganizationId={DEFAULT_ORGANIZATION_ID}
        defaultOrganizationRole={DEFAULT_ORGANIZATION_ROLE}
        isSSOEnabled={isSSOEnabled}
        isTurnstileConfigured={IS_TURNSTILE_CONFIGURED}
      />
    </div>
  );
};
