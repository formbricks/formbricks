"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import Turnstile, { useTurnstile } from "react-turnstile";
import { z } from "zod";
import {
  INVITE_TOKEN_INVALID_ERROR_CODE,
  PASSWORD_COMPROMISED_ERROR_CODE,
  SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE,
} from "@formbricks/types/errors";
import { TUserLocale, ZUserName, ZUserPassword } from "@formbricks/types/user";
import { getFormattedErrorMessage } from "@/lib/utils/error-message";
import { AuthDivider } from "@/modules/auth/components/auth-divider";
import { AuthField } from "@/modules/auth/components/auth-field";
import {
  buildSignupWithoutVerificationSuccessPath,
  buildVerificationRequestedPath,
} from "@/modules/auth/lib/verification-links";
import { createUserAction } from "@/modules/auth/signup/actions";
import { TermsPrivacyLinks } from "@/modules/auth/signup/components/terms-privacy-links";
import { SSOOptions } from "@/modules/ee/sso/components/sso-options";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { PasswordInput } from "@/modules/ui/components/password-input";
import { createEmailTokenAction } from "../../../auth/actions";
import { PasswordChecks } from "./password-checks";

const ZSignupInput = z.object({
  name: ZUserName,
  email: z.email(),
  password: ZUserPassword,
});

type TSignupInput = z.infer<typeof ZSignupInput>;

interface SignupFormProps {
  webAppUrl: string;
  privacyUrl: string | undefined;
  termsUrl: string | undefined;
  emailAuthEnabled: boolean;
  googleOAuthEnabled: boolean;
  githubOAuthEnabled: boolean;
  azureOAuthEnabled: boolean;
  oidcOAuthEnabled: boolean;
  oidcDisplayName?: string;
  userLocale: TUserLocale;
  emailFromSearchParams?: string;
  emailVerificationDisabled: boolean;
  isSsoEnabled: boolean;
  samlSsoEnabled: boolean;
  isTurnstileConfigured: boolean;
  turnstileSiteKey?: string;
  isFormbricksCloud: boolean;
  /** Set when the form is embedded in the invite page, where the token is not in the query string. */
  inviteToken?: string | null;
  /** The invited address is fixed: the server rejects a sign-up under any other one. */
  emailLocked?: boolean;
}

export const SignupForm = ({
  webAppUrl,
  privacyUrl,
  termsUrl,
  emailAuthEnabled,
  googleOAuthEnabled,
  githubOAuthEnabled,
  azureOAuthEnabled,
  oidcOAuthEnabled,
  oidcDisplayName,
  userLocale,
  emailFromSearchParams,
  emailVerificationDisabled,
  isSsoEnabled,
  samlSsoEnabled,
  isTurnstileConfigured,
  turnstileSiteKey,
  isFormbricksCloud,
  inviteToken: inviteTokenProp,
  emailLocked = false,
}: Readonly<SignupFormProps>) => {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const inviteToken = inviteTokenProp ?? searchParams?.get("inviteToken");
  const router = useRouter();
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [subscribeToSecurityUpdates, setSubscribeToSecurityUpdates] = useState(false);
  const [subscribeToProductUpdates, setSubscribeToProductUpdates] = useState(false);

  const turnstile = useTurnstile();

  // An SSO sign-up rejected for a personal email domain redirects back here with ?error=<code>.
  // Match the known code exactly (never echo the raw param). Track the last error value we toasted
  // (rather than a permanent boolean) so strict-mode's double effect invocation and locale re-renders
  // are deduped, but a fresh, distinct rejection value would still notify.
  const oauthError = searchParams?.get("error");
  const lastToastedOauthError = useRef<string | null>(null);
  useEffect(() => {
    if (oauthError !== SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE) return;
    if (lastToastedOauthError.current === oauthError) return;
    lastToastedOauthError.current = oauthError;
    toast.error(t("auth.signup.company_email_required"));
  }, [oauthError, t]);

  const returnToUrl = useMemo(() => {
    if (inviteToken) {
      return webAppUrl + "/invite?token=" + inviteToken;
    } else {
      return webAppUrl;
    }
  }, [inviteToken, webAppUrl]);

  const form = useForm<TSignupInput>({
    defaultValues: {
      name: "",
      email: emailFromSearchParams || "",
      password: "",
    },
    resolver: zodResolver(ZSignupInput),
  });

  /**
   * Map a failed `createUserAction` to where the user should see it: the two field-level rejections go
   * under the input that caused them, everything else is a toast. Each stable error code exists so the
   * server can be specific without the message itself being an enumeration signal.
   */
  const surfaceSignupError = (errorMessage: string) => {
    switch (errorMessage) {
      case SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE:
        form.setError("email", { type: "manual", message: t("auth.signup.company_email_required") });
        return;
      case PASSWORD_COMPROMISED_ERROR_CODE:
        form.setError("password", { type: "manual", message: t("auth.password_compromised") });
        return;
      case INVITE_TOKEN_INVALID_ERROR_CODE:
        // Reachable when the invite expires or is revoked between this page rendering and the form being
        // submitted. Reuses the existing invite copy rather than naming the specific reason, matching the
        // server, which returns one code for expired / revoked / wrong-address so it cannot be used to
        // probe which invites exist.
        toast.error(t("auth.invite.invite_not_found_description"));
        return;
      default:
        // SIGNUP_DISABLED_ERROR_CODE lands here (#8681). CodeRabbit is right that a real user can see
        // it — sign-up can be open when this page renders and closed before submit, the same
        // render-then-revoke race that makes the invite branch above user-facing — so it should be
        // translated rather than shown as a raw code. Deferred there because adding an en-US string
        // needs the 14 target locales populated too, and doing it without that reddens
        // `scan-translations`; tracked as a follow-up. (This PR hand-writes such strings with their
        // i18n.lock checksums, so that route is open to whoever picks the follow-up up.)
        toast.error(errorMessage);
    }
  };

  const handleSubmit = async (data: TSignupInput) => {
    try {
      if (isTurnstileConfigured && !turnstileToken) {
        throw new Error(t("auth.signup.please_verify_captcha"));
      }

      const resetTurnstileIfConfigured = () => {
        if (isTurnstileConfigured) {
          setTurnstileToken(undefined);
          turnstile.reset();
        }
      };
      const normalizedEmail = data.email.toLowerCase();

      const createUserResponse = await createUserAction({
        name: data.name,
        email: normalizedEmail,
        password: data.password,
        userLocale,
        inviteToken: inviteToken ?? "",
        turnstileToken,
        subscribeToSecurityUpdates,
        subscribeToProductUpdates,
      });

      if (!createUserResponse?.data) {
        resetTurnstileIfConfigured();
        surfaceSignupError(getFormattedErrorMessage(createUserResponse));
        return;
      }

      const emailTokenActionResponse = await createEmailTokenAction({ email: normalizedEmail });
      const token = emailTokenActionResponse?.data;

      if (!token) {
        resetTurnstileIfConfigured();

        const errorMessage = getFormattedErrorMessage(emailTokenActionResponse);
        toast.error(errorMessage);
        return;
      }

      // Both branches carry the invite callback. The verification-disabled branch is the default for
      // self-hosted, so omitting it there left invited users with an existing account unable to reach
      // the invite from the screen they land on (ENG-2091, raised in review).
      const callbackUrl = inviteToken ? returnToUrl : undefined;
      const url = emailVerificationDisabled
        ? buildSignupWithoutVerificationSuccessPath({ token, callbackUrl })
        : buildVerificationRequestedPath({ token, callbackUrl });

      router.push(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.something_went_wrong"));
    }
  };

  const { errors } = form.formState;
  const password = useWatch({ control: form.control, name: "password" });
  const registerName = form.register("name");
  const registerEmail = form.register("email");
  const registerPassword = form.register("password");

  const updatesCheckbox = isFormbricksCloud
    ? {
        id: "product-updates",
        checked: subscribeToProductUpdates,
        onChange: setSubscribeToProductUpdates,
        title: t("auth.signup.product_updates_title"),
        description: t("auth.signup.product_updates_description"),
      }
    : {
        id: "security-updates",
        checked: subscribeToSecurityUpdates,
        onChange: setSubscribeToSecurityUpdates,
        title: t("auth.signup.security_updates_title"),
        description: t("auth.signup.security_updates_description"),
      };

  return (
    <>
      {emailAuthEnabled && (
        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
          <AuthField id="signup-name" label={t("common.full_name")} error={errors.name?.message}>
            <Input
              id="signup-name"
              data-testid="signup-name"
              autoComplete="name"
              autoFocus={!emailLocked}
              isInvalid={Boolean(errors.name)}
              {...registerName}
            />
          </AuthField>
          <AuthField
            id="signup-email"
            label={t("common.email")}
            hint={emailLocked ? t("shell.auth.invite.email_hint") : undefined}
            error={errors.email?.message}>
            <Input
              id="signup-email"
              data-testid="signup-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              readOnly={emailLocked}
              placeholder="you@company.com"
              className={emailLocked ? "bg-slate-50 text-slate-600" : undefined}
              isInvalid={Boolean(errors.email)}
              aria-describedby={emailLocked ? "signup-email-hint" : undefined}
              {...registerEmail}
            />
          </AuthField>
          <AuthField id="signup-password" label={t("common.password")} error={errors.password?.message}>
            <PasswordInput
              id="signup-password"
              data-testid="signup-password"
              // This form creates the account, so a password manager should be offering to generate
              // and store — not autofill the current one.
              autoComplete="new-password"
              required
              {...registerPassword}
            />
            <PasswordChecks password={password} />
          </AuthField>

          {isTurnstileConfigured && turnstileSiteKey && (
            // The widget is a fixed 300px-wide iframe, wider than the card's content box on a
            // small phone. "flexible" lets it use the container where there is room; below xs
            // it is scaled to fit, and the clipping wrapper keeps its 300px layout box from
            // widening the page (the scaled content is narrower than the wrapper, so nothing
            // is actually cut off).
            <div data-testid="turnstile-fit" className="w-full overflow-hidden">
              <div className="origin-top-left scale-80 xs:origin-top xs:scale-100">
                <Turnstile
                  sitekey={turnstileSiteKey}
                  size="flexible"
                  onSuccess={(token) => {
                    setTurnstileToken(token);
                  }}
                  onError={() => {
                    setTurnstileToken(undefined);
                    toast.error(t("auth.signup.captcha_failed"));
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5">
            <Checkbox
              id={updatesCheckbox.id}
              checked={updatesCheckbox.checked}
              onCheckedChange={(checked) => updatesCheckbox.onChange(checked === true)}
              className="mt-0.5"
            />
            <Label htmlFor={updatesCheckbox.id} className="flex cursor-pointer flex-col gap-1 leading-5">
              <span>{updatesCheckbox.title}</span>
              <span className="text-[13px] leading-[18px] font-normal text-slate-500">
                {updatesCheckbox.description}
              </span>
            </Label>
          </div>

          <Button
            data-testid="signup-submit"
            type="submit"
            disabled={!form.formState.isValid}
            className="h-11 w-full justify-center sm:h-9"
            loading={form.formState.isSubmitting}>
            {t("shell.auth.signup.submit")}
          </Button>
        </form>
      )}
      {isSsoEnabled && (
        <>
          {emailAuthEnabled && <AuthDivider label={t("common.or")} />}
          <SSOOptions
            googleOAuthEnabled={googleOAuthEnabled}
            githubOAuthEnabled={githubOAuthEnabled}
            azureOAuthEnabled={azureOAuthEnabled}
            oidcOAuthEnabled={oidcOAuthEnabled}
            oidcDisplayName={oidcDisplayName}
            samlSsoEnabled={samlSsoEnabled}
            returnToUrl={returnToUrl}
            source="signup"
          />
        </>
      )}
      <TermsPrivacyLinks termsUrl={termsUrl} privacyUrl={privacyUrl} />
    </>
  );
};
