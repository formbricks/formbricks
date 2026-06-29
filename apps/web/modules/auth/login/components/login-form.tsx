"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { cn } from "@/lib/cn";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@/lib/localStorage";
import { authClient } from "@/modules/auth/lib/auth-client";
import { SSOOptions } from "@/modules/ee/sso/components/sso-options";
import { TwoFactor } from "@/modules/ee/two-factor-auth/components/two-factor";
import { TwoFactorBackup } from "@/modules/ee/two-factor-auth/components/two-factor-backup";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { FormControl, FormError, FormField, FormItem } from "@/modules/ui/components/form";
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
  prefilledEmail,
  inviteToken,
  resolvedCallbackPath,
  resolvedCallbackUrl,
}: LoginFormProps) => {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  // Better Auth surfaces the collision as `account_not_linked`; NextAuth used `OAuthAccountNotLinked`.
  // Accept both so the "not linked" alert survives the cutover.
  const oauthAccountNotLinked = oauthError === "OAuthAccountNotLinked" || oauthError === "account_not_linked";
  const { t } = useTranslation();

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
        <h1 className="mb-4 text-slate-700">{formLabel}</h1>
        {oauthAccountNotLinked && (
          <Alert variant="error" className="mb-4 text-left">
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
                  render={({ field, fieldState: { error } }) => (
                    <FormItem className="w-full">
                      <FormControl>
                        <div>
                          <input
                            id="email"
                            ref={emailRef}
                            type="email"
                            autoComplete="email"
                            required
                            value={field.value}
                            onChange={(email) => field.onChange(email)}
                            placeholder="work@email.com"
                            className="block w-full rounded-md border-slate-300 shadow-sm focus:border-brand-dark focus:ring-brand-dark sm:text-sm"
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
                            id="password"
                            autoComplete="current-password"
                            placeholder="*******"
                            aria-placeholder="password"
                            aria-label="password"
                            aria-required="true"
                            required
                            className="block w-full rounded-md border-slate-300 pr-8 shadow-sm focus:border-brand-dark focus:ring-brand-dark sm:text-sm"
                            value={field.value}
                            onChange={(password) => field.onChange(password)}
                          />
                          {error?.message && <FormError className="text-left">{error.message}</FormError>}
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
                {passwordResetEnabled && (
                  <div className="ml-1 text-right transition-all duration-500 ease-in-out">
                    <Link
                      href="/auth/forgot-password"
                      className="text-xs text-slate-500 hover:text-brand-dark">
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
                className="relative w-full justify-center"
                loading={form.formState.isSubmitting}>
                {totpLogin ? t("common.submit") : t("auth.login.login_with_email")}
                {lastLoggedInWith && lastLoggedInWith === "Email" ? (
                  <span className="absolute right-3 text-xs opacity-50">{t("auth.last_used")}</span>
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
              href={inviteToken ? `/auth/signup?inviteToken=${inviteToken}` : "/auth/signup"}
              className="font-semibold text-slate-600 underline hover:text-slate-700">
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
              className="font-semibold text-slate-600 underline hover:text-slate-700"
              onClick={() => {
                setTotpBackup(true);
              }}>
              {t("auth.login.use_a_backup_code")}
            </button>

            <button
              type="button"
              className="mt-4 font-semibold text-slate-600 underline hover:text-slate-700"
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
            className="font-semibold text-slate-600 underline hover:text-slate-700"
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
