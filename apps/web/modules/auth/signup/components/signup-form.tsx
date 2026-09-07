"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
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
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { buildAttributionQuerySuffix } from "@/modules/auth/lib/attribution";
import {
  buildSignupWithoutVerificationSuccessPath,
  buildVerificationRequestedPath,
} from "@/modules/auth/lib/verification-links";
import { createUserAction } from "@/modules/auth/signup/actions";
import { TermsPrivacyLinks } from "@/modules/auth/signup/components/terms-privacy-links";
import { SSOOptions } from "@/modules/ee/sso/components/sso-options";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { FormControl, FormError, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
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
}: Readonly<SignupFormProps>) => {
  const [showLogin, setShowLogin] = useState(false);
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
    } catch (e: any) {
      toast.error(e.message);
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
                            autoFocus
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
                      setShowLogin(true);
                    }
              }
              disabled={showLogin && !form.formState.isValid}
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
