import { Metadata } from "next";
import {
  EMAIL_AUTH_ENABLED,
  EMAIL_VERIFICATION_DISABLED,
  IS_FORMBRICKS_CLOUD,
  IS_TURNSTILE_CONFIGURED,
  OIDC_DISPLAY_NAME,
  PRIVACY_URL,
  TERMS_URL,
  TURNSTILE_SITE_KEY,
  WEBAPP_URL,
} from "@/lib/constants";
import { isSetupTokenConfigured } from "@/lib/instance/setup-token";
import { findMatchingLocale } from "@/lib/utils/locale";
import { getTranslate } from "@/lingodotdev/server";
import { SignupForm } from "@/modules/auth/signup/components/signup-form";
import { getSamlConnectionExists } from "@/modules/ee/sso/lib/saml-connection";
import { getSsoAvailability, toSsoFormProps } from "@/modules/ee/sso/lib/sso-availability";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Open-source Experience Management. Free & open source.",
};

export const SignupPage = async () => {
  const locale = await findMatchingLocale();
  const isSetupTokenRequired = isSetupTokenConfigured();

  const t = await getTranslate();
  // ENG-7313: only the email form carries the setup token and SSO is refused while one is set, so with
  // email sign-up off nothing here could succeed. Say why instead of showing a form with no way in.
  const isSetupBlockedByEmailAuth = isSetupTokenRequired && !EMAIL_AUTH_ENABLED;

  const ssoAvailability = isSetupBlockedByEmailAuth ? null : await getSsoAvailability();
  const samlConnectionExists = ssoAvailability ? await getSamlConnectionExists(ssoAvailability) : false;

  return (
    <div className="flex flex-col items-center">
      <h2 className="mb-6 text-xl font-medium">{t("setup.signup.create_administrator")}</h2>
      <p className="text-sm text-slate-800">{t("setup.signup.this_user_has_all_the_power")}</p>
      <hr className="my-6 w-full border-slate-200" />
      {isSetupBlockedByEmailAuth || !ssoAvailability ? (
        <p className="max-w-sm text-center text-sm text-slate-800">
          {t("setup.signup.setup_token_needs_email_sign_up")}
        </p>
      ) : (
        <SignupForm
          webAppUrl={WEBAPP_URL}
          termsUrl={TERMS_URL}
          privacyUrl={PRIVACY_URL}
          emailVerificationDisabled={EMAIL_VERIFICATION_DISABLED}
          emailAuthEnabled={EMAIL_AUTH_ENABLED}
          {...toSsoFormProps(ssoAvailability)}
          // SSO has no way to present the setup token, so it is not offered while one is required.
          isSsoEnabled={ssoAvailability.isSsoEnabled && !isSetupTokenRequired}
          isSetupTokenRequired={isSetupTokenRequired}
          samlConnectionExists={samlConnectionExists}
          oidcDisplayName={OIDC_DISPLAY_NAME}
          userLocale={locale}
          isTurnstileConfigured={IS_TURNSTILE_CONFIGURED}
          turnstileSiteKey={TURNSTILE_SITE_KEY}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
        />
      )}
    </div>
  );
};
