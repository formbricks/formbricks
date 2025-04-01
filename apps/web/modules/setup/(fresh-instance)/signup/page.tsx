import { SignupForm } from "@/modules/auth/signup/components/signup-form";
import { getTranslate } from "@/tolgee/server";
import { Metadata } from "next";
import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_ORGANIZATION_ROLE,
  EMAIL_AUTH_ENABLED,
  EMAIL_VERIFICATION_DISABLED,
  IS_TURNSTILE_CONFIGURED,
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

  const t = await getTranslate();
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
        userLocale={locale}
        defaultOrganizationId={DEFAULT_ORGANIZATION_ID}
        defaultOrganizationRole={DEFAULT_ORGANIZATION_ROLE}
        isTurnstileConfigured={IS_TURNSTILE_CONFIGURED}
      />
    </div>
  );
};
