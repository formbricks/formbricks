"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { FormProvider, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import Turnstile, { useTurnstile } from "react-turnstile";
import { z } from "zod";
import { SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE } from "@formbricks/types/errors";
import { SETUP_TOKEN_MAX_LENGTH } from "@formbricks/types/instance";
import { TUserLocale, ZUserName, ZUserPassword } from "@formbricks/types/user";
import { getV3ApiErrorMessage, getV3ApiErrorReason } from "@/modules/api/lib/v3-client";
import { buildAttributionQuerySuffix } from "@/modules/auth/lib/attribution";
import { createSignup } from "@/modules/auth/lib/pre-login-api-client";
import {
  buildSignupWithoutVerificationSuccessPath,
  buildVerificationRequestedPath,
} from "@/modules/auth/lib/verification-links";
import { TermsPrivacyLinks } from "@/modules/auth/signup/components/terms-privacy-links";
import { getSignupErrorPlacement } from "@/modules/auth/signup/lib/signup-error";
import { SSOOptions } from "@/modules/ee/sso/components/sso-options";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { FormControl, FormError, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { PasswordInput } from "@/modules/ui/components/password-input";
import { PasswordChecks } from "./password-checks";

const ZSignupInput = z.object({
  name: ZUserName,
  email: z.email(),
  password: ZUserPassword,
  setupToken: z.string().max(SETUP_TOKEN_MAX_LENGTH).optional(),
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
  /** Whether the instance's one SAML connection exists, looked up where the page renders. */
  samlConnectionExists: boolean;
  isTurnstileConfigured: boolean;
  turnstileSiteKey?: string;
  isFormbricksCloud: boolean;
  /** The instance requires `SETUP_TOKEN` to create the first administrator (ENG-7313). */
  isSetupTokenRequired?: boolean;
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
  samlConnectionExists,
  isTurnstileConfigured,
  turnstileSiteKey,
  isFormbricksCloud,
  isSetupTokenRequired = false,
}: Readonly<SignupFormProps>) => {
  const [showLogin, setShowLogin] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const inviteToken = searchParams?.get("inviteToken");
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

  const loginHref = useMemo(() => {
    const base = inviteToken ? `/auth/login?callbackUrl=${returnToUrl}` : "/auth/login";
    const attributionSuffix = buildAttributionQuerySuffix(searchParams);
    if (!attributionSuffix) return base;
    return `${base}${base.includes("?") ? "&" : "?"}${attributionSuffix}`;
  }, [inviteToken, returnToUrl, searchParams]);

  const form = useForm<TSignupInput>({
    defaultValues: {
      name: "",
      email: emailFromSearchParams || "",
      password: "",
      setupToken: "",
    },
    resolver: zodResolver(ZSignupInput),
  });

  /**
   * Show a failed sign-up under the field that caused it, or as a toast. The placement keys on the
   * problem's stable error code (`details.reason`); a code it doesn't place toasts the problem's message.
   */
  const surfaceSignupError = (error: unknown) => {
    const errorMessage = getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"));
    const placement = getSignupErrorPlacement(getV3ApiErrorReason(error, errorMessage), t, errorMessage);
    // The setup-token field is on the page only when the instance asked for it as the page rendered;
    // if that changed since, an error under a missing field would show nothing.
    if (!("field" in placement)) {
      toast.error(placement.toast);
      return;
    }
    if (placement.field === "setupToken" && !isSetupTokenRequired) {
      toast.error(placement.message);
      return;
    }
    form.setError(placement.field, { type: "manual", message: placement.message });
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

      let token: string;
      try {
        ({ emailToken: token } = await createSignup({
          name: data.name,
          email: normalizedEmail,
          password: data.password,
          userLocale,
          inviteToken: inviteToken ?? "",
          setupToken: isSetupTokenRequired ? data.setupToken : undefined,
          turnstileToken,
          subscribeToSecurityUpdates,
          subscribeToProductUpdates,
        }));
      } catch (error) {
        resetTurnstileIfConfigured();
        surfaceSignupError(error);
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="text-center">
      <h1 className="mb-4 text-xl font-semibold text-balance text-slate-800">{t("auth.signup.title")}</h1>
      {emailAuthEnabled && (
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="mb-2">
            {showLogin && (
              <div>
                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="w-full text-left">
                        <FormLabel>{t("common.full_name")}</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="signup-name"
                            value={field.value}
                            name="name"
                            autoComplete="name"
                            ref={nameInputRef}
                            onBlur={field.onBlur}
                            onChange={(e) => field.onChange(e.target.value)}
                            placeholder="Full name"
                            className="bg-white"
                          />
                        </FormControl>
                        <FormError role="alert" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="w-full text-left">
                        <FormLabel>{t("common.email")}</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="signup-email"
                            type="email"
                            value={field.value}
                            name="email"
                            autoComplete="email"
                            inputMode="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            onBlur={field.onBlur}
                            onChange={(e) => field.onChange(e.target.value)}
                            placeholder="work@email.com"
                            className="bg-white"
                          />
                        </FormControl>
                        <FormError role="alert" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="w-full text-left">
                        <FormLabel>{t("common.password")}</FormLabel>
                        <FormControl>
                          <PasswordInput
                            data-testid="signup-password"
                            name="password"
                            value={field.value}
                            onBlur={field.onBlur}
                            onChange={(e) => field.onChange(e.target.value)}
                            // This form creates the account, so a password manager should be
                            // offering to generate and store — not autofill the current one.
                            autoComplete="new-password"
                            placeholder="*******"
                            required
                            className="bg-white"
                          />
                        </FormControl>
                        <FormError role="alert" />
                      </FormItem>
                    )}
                  />
                  {isSetupTokenRequired && (
                    <FormField
                      control={form.control}
                      name="setupToken"
                      render={({ field }) => (
                        <FormItem className="w-full text-left">
                          <FormLabel>{t("setup.signup.setup_token")}</FormLabel>
                          <FormControl>
                            <PasswordInput
                              data-testid="signup-setup-token"
                              name="setupToken"
                              value={field.value ?? ""}
                              onBlur={field.onBlur}
                              onChange={(e) => field.onChange(e.target.value)}
                              autoComplete="off"
                              maxLength={SETUP_TOKEN_MAX_LENGTH}
                              required
                              className="bg-white"
                            />
                          </FormControl>
                          <FormError role="alert" />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
                <PasswordChecks password={form.watch("password")} />
              </div>
            )}
            {isTurnstileConfigured && showLogin && turnstileSiteKey && (
              // The widget is a fixed 300px-wide iframe, wider than the card's content box on a
              // small phone. "flexible" lets it use the container where there is room; below xs
              // it is scaled to fit, and the clipping wrapper keeps its 300px layout box from
              // widening the page (the scaled content is narrower than the wrapper, so nothing
              // is actually cut off).
              <div data-testid="turnstile-fit" className="mt-4 w-full overflow-hidden">
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

            {showLogin &&
              (isFormbricksCloud ? (
                <label
                  htmlFor="product-updates"
                  className="my-4 flex cursor-pointer items-start gap-x-3 rounded-md border border-slate-200 bg-slate-100 p-3 text-left">
                  <Checkbox
                    id="product-updates"
                    checked={subscribeToProductUpdates}
                    onCheckedChange={(checked) => setSubscribeToProductUpdates(checked === true)}
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700">
                      {t("auth.signup.product_updates_title")}
                    </span>
                    <p className="text-xs text-slate-600">{t("auth.signup.product_updates_description")}</p>
                  </div>
                </label>
              ) : (
                <label
                  htmlFor="security-updates"
                  className="my-4 flex cursor-pointer items-start gap-x-3 rounded-md border border-slate-200 bg-slate-100 p-3 text-left">
                  <Checkbox
                    id="security-updates"
                    checked={subscribeToSecurityUpdates}
                    onCheckedChange={(checked) => setSubscribeToSecurityUpdates(checked === true)}
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700">
                      {t("auth.signup.security_updates_title")}
                    </span>
                    <p className="text-xs text-slate-600">{t("auth.signup.security_updates_description")}</p>
                  </div>
                </label>
              ))}

            <Button
              data-testid={showLogin ? "signup-submit" : "signup-show-login"}
              type={showLogin ? "submit" : "button"}
              onClick={
                showLogin
                  ? undefined
                  : () => {
                      // The button the user pressed turns into the (disabled) submit, so focus moves on
                      // to the first field it just revealed.
                      flushSync(() => setShowLogin(true));
                      nameInputRef.current?.focus();
                    }
              }
              disabled={
                showLogin && (!form.formState.isValid || (isSetupTokenRequired && !form.watch("setupToken")))
              }
              className="h-11 w-full justify-center sm:h-10"
              loading={showLogin && form.formState.isSubmitting}>
              {t("auth.continue_with_email")}
            </Button>
          </form>
        </FormProvider>
      )}
      {isSsoEnabled && (
        <SSOOptions
          googleOAuthEnabled={googleOAuthEnabled}
          githubOAuthEnabled={githubOAuthEnabled}
          azureOAuthEnabled={azureOAuthEnabled}
          oidcOAuthEnabled={oidcOAuthEnabled}
          oidcDisplayName={oidcDisplayName}
          samlSsoEnabled={samlSsoEnabled}
          samlConnectionExists={samlConnectionExists}
          returnToUrl={returnToUrl}
          source="signup"
        />
      )}
      <TermsPrivacyLinks termsUrl={termsUrl} privacyUrl={privacyUrl} />
      <div className="mt-9 text-center text-xs">
        <span className="leading-5 text-slate-500">{t("auth.signup.have_an_account")}</span>
        <br />
        <Link
          href={loginHref}
          className="inline-flex min-h-6 items-center justify-center rounded-sm py-1 font-semibold text-slate-600 underline hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:outline-hidden">
          {t("auth.signup.log_in")}
        </Link>
      </div>
    </div>
  );
};
