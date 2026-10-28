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
import { findMatchingLocale } from "@/lib/utils/locale";
import { getSsoAvailability, toSsoFormProps } from "@/modules/ee/sso/lib/sso-availability";
import { SignupForm } from "./signup-form";

interface SignupFormLoaderProps {
  emailFromSearchParams?: string;
  inviteToken?: string | null;
  emailLocked?: boolean;
}

/**
 * The sign-up form with everything the instance decides filled in: which providers are on, whether
 * Turnstile guards it, where the terms live. The sign-up page, the first-admin page and the invite page
 * all render the same form, so they all go through here.
 */
export const SignupFormLoader = async ({
  emailFromSearchParams,
  inviteToken,
  emailLocked,
}: Readonly<SignupFormLoaderProps>) => {
  const [locale, ssoAvailability] = await Promise.all([findMatchingLocale(), getSsoAvailability()]);

  return (
    <SignupForm
      webAppUrl={WEBAPP_URL}
      termsUrl={TERMS_URL}
      privacyUrl={PRIVACY_URL}
      emailVerificationDisabled={EMAIL_VERIFICATION_DISABLED}
      emailAuthEnabled={EMAIL_AUTH_ENABLED}
      {...toSsoFormProps(ssoAvailability)}
      oidcDisplayName={OIDC_DISPLAY_NAME}
      userLocale={locale}
      emailFromSearchParams={emailFromSearchParams}
      isTurnstileConfigured={IS_TURNSTILE_CONFIGURED}
      turnstileSiteKey={TURNSTILE_SITE_KEY}
      isFormbricksCloud={IS_FORMBRICKS_CLOUD}
      inviteToken={inviteToken}
      emailLocked={emailLocked}
    />
  );
};
