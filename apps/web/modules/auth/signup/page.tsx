import { notFound } from "next/navigation";
import {
  EMAIL_AUTH_ENABLED,
  EMAIL_VERIFICATION_DISABLED,
  IS_FORMBRICKS_CLOUD,
  IS_TURNSTILE_CONFIGURED,
  OIDC_DISPLAY_NAME,
  PRIVACY_URL,
  SIGNUP_ENABLED,
  TERMS_URL,
  TURNSTILE_SITE_KEY,
  WEBAPP_URL,
} from "@/lib/constants";
import { verifyInviteToken } from "@/lib/jwt";
import { findMatchingLocale } from "@/lib/utils/locale";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { getIsValidInviteToken } from "@/modules/auth/signup/lib/invite";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { getSsoAvailability, toSsoFormProps } from "@/modules/ee/sso/lib/sso-availability";
import { SignupForm } from "./components/signup-form";

export const SignupPage = async ({
  searchParams: searchParamsProps,
}: {
  searchParams: Promise<Record<string, string>>;
}) => {
  const searchParams = await searchParamsProps;
  const inviteToken = searchParams["inviteToken"] ?? null;
  const [isMultOrgEnabled, ssoAvailability] = await Promise.all([
    getIsMultiOrgEnabled(),
    getSsoAvailability(),
  ]);
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
    <FormWrapper>
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
      />
    </FormWrapper>
  );
};
