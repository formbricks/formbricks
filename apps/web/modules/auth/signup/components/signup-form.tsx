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
import { SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE } from "@formbricks/types/errors";
import { TUserLocale, ZUserName, ZUserPassword } from "@formbricks/types/user";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { buildAttributionQuerySuffix } from "@/modules/auth/lib/attribution";
import { buildVerificationRequestedPath } from "@/modules/auth/lib/verification-links";
import { createUserAction } from "@/modules/auth/signup/actions";
import { TermsPrivacyLinks } from "@/modules/auth/signup/components/terms-privacy-links";
import { SSOOptions } from "@/modules/ee/sso/components/sso-options";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { FormControl, FormError, FormField, FormItem } from "@/modules/ui/components/form";
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
}: SignupFormProps) => {
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
  // Match the known code exactly (never echo the raw param) and show it at most once — the ref guards
  // against a re-toast on locale change and React strict mode's double effect invocation in dev.
  const oauthError = searchParams?.get("error");
  const hasShownDomainErrorToast = useRef(false);
  useEffect(() => {
    if (hasShownDomainErrorToast.current) return;
    if (oauthError === SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE) {
      hasShownDomainErrorToast.current = true;
      toast.error(t("auth.signup.company_email_required"));
    }
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

        const errorMessage = getFormattedErrorMessage(createUserResponse);
        // Personal-email block: surface under the email field rather than as a toast.
        if (errorMessage === SIGNUP_EMAIL_DOMAIN_BLOCKED_ERROR_CODE) {
          form.setError("email", { type: "manual", message: t("auth.signup.company_email_required") });
        } else {
          toast.error(errorMessage);
        }
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

      const url = emailVerificationDisabled
        ? `/auth/signup-without-verification-success?token=${token}`
        : buildVerificationRequestedPath({
            token,
            callbackUrl: inviteToken ? returnToUrl : undefined,
          });

      router.push(url);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="text-center">
      <h1 className="mb-4 text-slate-700">{t("auth.signup.title")}</h1>
      {emailAuthEnabled && (
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="mb-2">
            {showLogin && (
              <div>
                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field, fieldState: { error } }) => (
                      <FormItem className="w-full">
                        <FormControl>
                          <div>
                            <Input
                              data-testid="signup-name"
                              value={field.value}
                              name="name"
                              autoFocus
                              onChange={(e) => field.onChange(e.target.value)}
                              placeholder="Full name"
                              className="bg-white"
                            />
                            {error?.message && <FormError className="text-left">{error.message}</FormError>}
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field, fieldState: { error } }) => (
                      <FormItem className="w-full">
                        <FormControl>
                          <div>
                            <Input
                              data-testid="signup-email"
                              value={field.value}
                              name="email"
                              onChange={(e) => field.onChange(e.target.value)}
                              placeholder="work@email.com"
                              className="bg-white"
                            />
                            {error?.message && <FormError className="text-left">{error.message}</FormError>}
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field, fieldState: { error } }) => (
                      <FormItem className="w-full">
                        <FormControl>
                          <div>
                            <PasswordInput
                              data-testid="signup-password"
                              id="password"
                              name="password"
                              value={field.value}
                              onChange={(e) => field.onChange(e.target.value)}
                              autoComplete="current-password"
                              placeholder="*******"
                              aria-placeholder="password"
                              required
                              className="block w-full rounded-md shadow-xs focus:border-brand-dark focus:ring-brand-dark sm:text-sm"
                            />
                            {error?.message && <FormError className="text-left">{error.message}</FormError>}
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <PasswordChecks password={form.watch("password")} />
              </div>
            )}
            {isTurnstileConfigured && showLogin && turnstileSiteKey && (
              <Turnstile
                sitekey={turnstileSiteKey}
                onSuccess={(token) => {
                  setTurnstileToken(token);
                }}
                onError={() => {
                  setTurnstileToken(undefined);
                  toast.error(t("auth.signup.captcha_failed"));
                }}
              />
            )}

            {showLogin &&
              (isFormbricksCloud ? (
                <label
                  htmlFor="product-updates"
                  className="my-4 flex cursor-pointer gap-x-2 rounded-md border border-slate-200 bg-slate-100 p-2 text-left">
                  <Checkbox
                    id="product-updates"
                    checked={subscribeToProductUpdates}
                    onCheckedChange={(checked) => setSubscribeToProductUpdates(checked === true)}
                    className="mt-0.5 size-4"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700">
                      {t("auth.signup.product_updates_title")}
                    </span>
                    <p className="text-xs text-slate-500">{t("auth.signup.product_updates_description")}</p>
                  </div>
                </label>
              ) : (
                <label
                  htmlFor="security-updates"
                  className="my-4 flex cursor-pointer gap-x-2 rounded-md border border-slate-200 bg-slate-100 p-2 text-left">
                  <Checkbox
                    id="security-updates"
                    checked={subscribeToSecurityUpdates}
                    onCheckedChange={(checked) => setSubscribeToSecurityUpdates(checked === true)}
                    className="mt-0.5 size-4"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700">
                      {t("auth.signup.security_updates_title")}
                    </span>
                    <p className="text-xs text-slate-500">{t("auth.signup.security_updates_description")}</p>
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
              className="h-10 w-full justify-center"
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
        <Link href={loginHref} className="font-semibold text-slate-600 underline hover:text-slate-700">
          {t("auth.signup.log_in")}
        </Link>
      </div>
    </div>
  );
};
