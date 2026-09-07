"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { cn } from "@/lib/cn";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@/lib/localStorage";
import { buildAttributionQuerySuffix } from "@/modules/auth/lib/attribution";
import { authClient } from "@/modules/auth/lib/auth-client";
import { SSOOptions } from "@/modules/ee/sso/components/sso-options";
import { TwoFactor } from "@/modules/ee/two-factor-auth/components/two-factor";
import { TwoFactorBackup } from "@/modules/ee/two-factor-auth/components/two-factor-backup";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { FormControl, FormError, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { PasswordInput } from "@/modules/ui/components/password-input";

const ZLoginForm = z.object({
  email: z.email(),
  password: z
    .string()
    .min(8, {
      error: "Password must be at least 8 characters long",
    })
    .max(128, {
      error: "Password must be 128 characters or less",
    }),
  totpCode: z.string().optional(),
  backupCode: z.string().optional(),
});

type TLoginForm = z.infer<typeof ZLoginForm>;

interface LoginFormProps {
  emailAuthEnabled: boolean;
  publicSignUpEnabled: boolean;
  passwordResetEnabled: boolean;
  googleOAuthEnabled: boolean;
  githubOAuthEnabled: boolean;
  azureOAuthEnabled: boolean;
  oidcOAuthEnabled: boolean;
  oidcDisplayName?: string;
  isMultiOrgEnabled: boolean;
  isSsoEnabled: boolean;
  samlSsoEnabled: boolean;
  oauthError?: string;
  emailJustVerified?: boolean;
  prefilledEmail?: string;
  inviteToken?: string | null;
  resolvedCallbackPath: string;
  resolvedCallbackUrl: string;
}

export const LoginForm = ({
  emailAuthEnabled,
  publicSignUpEnabled,
  passwordResetEnabled,
  googleOAuthEnabled,
  githubOAuthEnabled,
  azureOAuthEnabled,
  oidcOAuthEnabled,
  oidcDisplayName,
  isMultiOrgEnabled,
  isSsoEnabled,
  samlSsoEnabled,
  oauthError,
  emailJustVerified,
  prefilledEmail,
  inviteToken,
  resolvedCallbackPath,
  resolvedCallbackUrl,
}: Readonly<LoginFormProps>) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailRef = useRef<HTMLInputElement>(null);
  // Better Auth surfaces the collision as `account_not_linked`; NextAuth used `OAuthAccountNotLinked`.
  // Accept both so the "not linked" alert survives the cutover.
  const oauthAccountNotLinked = oauthError === "OAuthAccountNotLinked" || oauthError === "account_not_linked";
  const { t } = useTranslation();

  const signupHref = useMemo(() => {
    const base = inviteToken ? `/auth/signup?inviteToken=${inviteToken}` : "/auth/signup";
    const attributionSuffix = buildAttributionQuerySuffix(searchParams);
    if (!attributionSuffix) return base;
    return `${base}${base.includes("?") ? "&" : "?"}${attributionSuffix}`;
  }, [inviteToken, searchParams]);

  const form = useForm<TLoginForm>({
    defaultValues: {
      email: prefilledEmail ?? "",
      password: "",
      totpCode: "",
      backupCode: "",
    },
    resolver: zodResolver(ZLoginForm),
  });

  const onSubmit: SubmitHandler<TLoginForm> = async (data) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(FORMBRICKS_LOGGED_IN_WITH_LS, "Email");
    }
    try {
      // Step 2 — the user is answering a two-factor challenge. Better Auth issued a partial
      // session on the first step; verifying the TOTP or backup code promotes it to a full session.
      if (totpLogin || totpBackup) {
        const { error } = totpBackup
          ? await authClient.twoFactor.verifyBackupCode({ code: data.backupCode ?? "" })
          : await authClient.twoFactor.verifyTotp({ code: data.totpCode ?? "" });

        if (error) {
          toast.error(error.message ?? t("common.something_went_wrong"));
          return;
        }

        router.push(resolvedCallbackPath || "/");
        return;
      }

      // Step 1 — email + password.
      const { data: signInData, error } = await authClient.signIn.email({
        email: data.email.toLowerCase(),
        password: data.password,
        // For an unverified address Better Auth (sendOnSignIn) resends the verification email and builds
        // its link around this callbackURL; without it the post-verify redirect falls back to "/", so an
        // unverified user signing in from an invite/deep-link would lose the original destination.
        callbackURL: resolvedCallbackUrl,
      });

      if (error) {
        // Better Auth (re)sends its own verification email for an unverified address, so we only
        // point the user at their inbox instead of minting a verification token ourselves.
        if (error.code === "EMAIL_NOT_VERIFIED") {
          toast.error(t("auth.login.please_verify_your_email_to_continue"));
          return;
        }
        toast.error(error.message ?? t("common.something_went_wrong"));
        return;
      }

      // Two-factor is enabled: Better Auth returns `twoFactorRedirect` instead of a session. No
      // client `twoFactorPage` is configured, so surface the inline TOTP/backup challenge here.
      if (signInData && "twoFactorRedirect" in signInData && signInData.twoFactorRedirect) {
        setTotpLogin(true);
        return;
      }

      router.push(resolvedCallbackPath || "/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const [showLogin, setShowLogin] = useState(false);
  const [totpLogin, setTotpLogin] = useState(false);
  const [totpBackup, setTotpBackup] = useState(false);
  const [lastLoggedInWith, setLastLoggedInWith] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLastLoggedInWith(localStorage.getItem(FORMBRICKS_LOGGED_IN_WITH_LS) || "");
    }
  }, []);

  const formLabel = useMemo(() => {
    if (totpBackup) {
      return t("auth.login.enter_your_backup_code");
    }

    if (totpLogin) {
      return t("auth.login.enter_your_two_factor_authentication_code");
    }

    return t("auth.login.login_to_your_account");
  }, [t, totpBackup, totpLogin]);

  const TwoFactorComponent = useMemo(() => {
    if (totpBackup) {
      return <TwoFactorBackup form={form} />;
    }

    if (totpLogin) {
      return <TwoFactor form={form} />;
    }

    return null;
  }, [form, totpBackup, totpLogin]);

  return (
    <FormProvider {...form}>
      <div className="text-center">
        <h1 className="mb-4 text-xl font-semibold text-balance text-slate-800">{formLabel}</h1>
        {emailJustVerified && (
          <Alert variant="success" className="mb-4 text-left" role="status">
            <AlertTitle>{t("auth.login.email_verified_sign_in_title")}</AlertTitle>
            <AlertDescription>
              <p>{t("auth.login.email_verified_sign_in_description")}</p>
            </AlertDescription>
          </Alert>
        )}
        {oauthAccountNotLinked && (
          <Alert variant="error" className="mb-4 text-left" role="status">
            <AlertTitle>{t("auth.login.oauth_account_not_linked_title")}</AlertTitle>
            <AlertDescription>
              <p>{t("auth.login.oauth_account_not_linked_description")}</p>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
            {TwoFactorComponent}
            {showLogin && (
              <div className={cn(totpLogin && "hidden", "space-y-2")}>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="w-full text-left">
                      <FormLabel>{t("common.email")}</FormLabel>
                      <FormControl>
                        <Input
                          ref={emailRef}
                          type="email"
                          autoComplete="email"
                          inputMode="email"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          required
                          name={field.name}
                          value={field.value}
                          onBlur={field.onBlur}
                          onChange={(email) => field.onChange(email)}
                          placeholder="work@email.com"
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
                          autoComplete="current-password"
                          placeholder="*******"
                          required
                          name={field.name}
                          value={field.value}
                          onBlur={field.onBlur}
                          onChange={(password) => field.onChange(password)}
                        />
                      </FormControl>
                      <FormError role="alert" />
                    </FormItem>
                  )}
                />
                {passwordResetEnabled && (
                  <div className="text-right transition-all duration-500 ease-in-out">
                    <Link
                      href="/auth/forgot-password"
                      className="inline-flex min-h-6 items-center rounded-sm py-1 text-sm text-slate-500 hover:text-brand-dark focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:outline-hidden">
                      {t("auth.login.forgot_your_password")}
                    </Link>
                  </div>
                )}
              </div>
            )}
            {emailAuthEnabled && (
              <Button
                type={showLogin ? "submit" : "button"}
                onClick={
                  showLogin
                    ? undefined
                    : () => {
                        setShowLogin(true);
                        // Add a slight delay before focusing the input field to ensure it's visible
                        setTimeout(() => emailRef.current?.focus(), 100);
                      }
                }
                className="h-11 w-full min-w-0 justify-center sm:h-9"
                loading={form.formState.isSubmitting}>
                <span className="truncate">
                  {totpLogin ? t("common.submit") : t("auth.login.login_with_email")}
                </span>
                {lastLoggedInWith && lastLoggedInWith === "Email" ? (
                  <span className="shrink-0 text-xs opacity-50">{t("auth.last_used")}</span>
                ) : null}
              </Button>
            )}
          </form>
          {isSsoEnabled && (
            <SSOOptions
              googleOAuthEnabled={googleOAuthEnabled}
              githubOAuthEnabled={githubOAuthEnabled}
              azureOAuthEnabled={azureOAuthEnabled}
              oidcOAuthEnabled={oidcOAuthEnabled}
              oidcDisplayName={oidcDisplayName}
              samlSsoEnabled={samlSsoEnabled}
              returnToUrl={resolvedCallbackUrl}
              source="signin"
            />
          )}
        </div>

        {publicSignUpEnabled && !totpLogin && isMultiOrgEnabled && (
          <div className="mt-9 text-center text-xs">
            <span className="leading-5 text-slate-500">{t("auth.login.new_to_formbricks")}</span>
            <br />
            <Link
              href={signupHref}
              className="inline-flex min-h-6 items-center justify-center rounded-sm py-1 font-semibold text-slate-600 underline hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:outline-hidden">
              {t("auth.login.create_an_account")}
            </Link>
          </div>
        )}
      </div>

      {totpLogin && !totpBackup && (
        <div className="mt-9 text-center text-xs">
          <span className="leading-5 text-slate-500">{t("auth.login.lost_access")}</span>
          <br />
          <div className="flex flex-col">
            <button
              type="button"
              className="inline-flex min-h-6 items-center justify-center rounded-sm py-1 font-semibold text-slate-600 underline hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:outline-hidden"
              onClick={() => {
                setTotpBackup(true);
              }}>
              {t("auth.login.use_a_backup_code")}
            </button>

            <button
              type="button"
              className="mt-4 inline-flex min-h-6 items-center justify-center rounded-sm py-1 font-semibold text-slate-600 underline hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:outline-hidden"
              onClick={() => {
                setTotpLogin(false);
              }}>
              {t("common.go_back")}
            </button>
          </div>
        </div>
      )}

      {totpBackup && (
        <div className="mt-9 text-center text-xs">
          <button
            type="button"
            className="inline-flex min-h-6 items-center justify-center rounded-sm py-1 font-semibold text-slate-600 underline hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:outline-hidden"
            onClick={() => {
              setTotpBackup(false);
            }}>
            {t("common.go_back")}
          </button>
        </div>
      )}
    </FormProvider>
  );
};
