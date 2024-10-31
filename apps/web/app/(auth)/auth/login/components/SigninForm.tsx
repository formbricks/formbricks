"use client";

import { TwoFactor } from "@/app/(auth)/auth/login/components/TwoFactor";
import { TwoFactorBackup } from "@/app/(auth)/auth/login/components/TwoFactorBackup";
import { XCircleIcon } from "lucide-react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import Link from "next/dist/client/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, FormProvider, SubmitHandler, useForm } from "react-hook-form";
import { cn } from "@formbricks/lib/cn";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@formbricks/lib/localStorage";
import { Button } from "@formbricks/ui/components/Button";
import { PasswordInput } from "@formbricks/ui/components/PasswordInput";
import { AzureButton } from "@formbricks/ui/components/SignupOptions/components/AzureButton";
import { GithubButton } from "@formbricks/ui/components/SignupOptions/components/GithubButton";
import { GoogleButton } from "@formbricks/ui/components/SignupOptions/components/GoogleButton";
import { OpenIdButton } from "@formbricks/ui/components/SignupOptions/components/OpenIdButton";

interface TSigninFormState {
  email: string;
  password: string;
  totpCode: string;
  backupCode: string;
}

interface SignInFormProps {
  emailAuthEnabled: boolean;
  publicSignUpEnabled: boolean;
  passwordResetEnabled: boolean;
  googleOAuthEnabled: boolean;
  githubOAuthEnabled: boolean;
  azureOAuthEnabled: boolean;
  oidcOAuthEnabled: boolean;
  oidcDisplayName?: string;
  isMultiOrgEnabled: boolean;
}

export const SigninForm = ({
  emailAuthEnabled,
  publicSignUpEnabled,
  passwordResetEnabled,
  googleOAuthEnabled,
  githubOAuthEnabled,
  azureOAuthEnabled,
  oidcOAuthEnabled,
  oidcDisplayName,
  isMultiOrgEnabled,
}: SignInFormProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailRef = useRef<HTMLInputElement>(null);
  const formMethods = useForm<TSigninFormState>();
  const callbackUrl = searchParams?.get("callbackUrl");
  const t = useTranslations();
  const onSubmit: SubmitHandler<TSigninFormState> = async (data) => {
    setLoggingIn(true);
    if (typeof window !== "undefined") {
      localStorage.setItem(FORMBRICKS_LOGGED_IN_WITH_LS, "Email");
    }
    try {
      const signInResponse = await signIn("credentials", {
        callbackUrl: callbackUrl ?? "/",
        email: data.email.toLowerCase(),
        password: data.password,
        ...(totpLogin && { totpCode: data.totpCode }),
        ...(totpBackup && { backupCode: data.backupCode }),
        redirect: false,
      });

      if (signInResponse?.error === "second factor required") {
        setTotpLogin(true);
        setLoggingIn(false);
        return;
      }

      if (signInResponse?.error === "Email Verification is Pending") {
        router.push(`/auth/verification-requested?email=${data.email}`);
        return;
      }

      if (signInResponse?.error) {
        setLoggingIn(false);
        setSignInError(signInResponse.error);
        return;
      }

      if (!signInResponse?.error) {
        router.push(searchParams?.get("callbackUrl") || "/");
      }
    } catch (error) {
      const errorMessage = error.toString();
      const errorFeedback = errorMessage.includes("Invalid URL")
        ? t("auth.login.too_many_requests_please_try_again_after_some_time")
        : error.message;
      setSignInError(errorFeedback);
    } finally {
      setLoggingIn(false);
    }
  };

  const [loggingIn, setLoggingIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [totpLogin, setTotpLogin] = useState(false);
  const [totpBackup, setTotpBackup] = useState(false);
  const [signInError, setSignInError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const error = searchParams?.get("error");
  const inviteToken = callbackUrl ? new URL(callbackUrl).searchParams.get("token") : null;
  const [lastLoggedInWith, setLastLoginWith] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLastLoginWith(localStorage.getItem(FORMBRICKS_LOGGED_IN_WITH_LS) || "");
    }
  }, []);

  useEffect(() => {
    if (error) {
      setSignInError(error);
    }
  }, [error]);

  const formLabel = useMemo(() => {
    if (totpBackup) {
      return t("auth.login.enter_your_backup_code");
    }

    if (totpLogin) {
      return t("auth.login.enter_your_two_factor_authentication_code");
    }

    return t("auth.login.login_to_your_account");
  }, [totpBackup, totpLogin]);

  const TwoFactorComponent = useMemo(() => {
    if (totpBackup) {
      return <TwoFactorBackup />;
    }

    if (totpLogin) {
      return <TwoFactor />;
    }

    return null;
  }, [totpBackup, totpLogin]);

  return (
    <FormProvider {...formMethods}>
      <div className="text-center">
        <h1 className="mb-4 text-slate-700">{formLabel}</h1>

        <div className="space-y-2">
          <form onSubmit={formMethods.handleSubmit(onSubmit)} className="space-y-2">
            {TwoFactorComponent}

            {showLogin && (
              <div className={cn(totpLogin && "hidden")}>
                <div className="mb-2 transition-all duration-500 ease-in-out">
                  <label htmlFor="email" className="sr-only">
                    {t("common.email")}
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="work@email.com"
                    defaultValue={searchParams?.get("email") || ""}
                    className="focus:border-brand-dark focus:ring-brand-dark block w-full rounded-md border-slate-300 shadow-sm sm:text-sm"
                    {...formMethods.register("email", {
                      required: true,
                      pattern: /\S+@\S+\.\S+/,
                    })}
                  />
                </div>
                <div className="transition-all duration-500 ease-in-out">
                  <label htmlFor="password" className="sr-only">
                    {t("common.password")}
                  </label>
                  <Controller
                    name="password"
                    control={formMethods.control}
                    render={({ field }) => (
                      <PasswordInput
                        id="password"
                        autoComplete="current-password"
                        placeholder="*******"
                        aria-placeholder="password"
                        onFocus={() => setIsPasswordFocused(true)}
                        required
                        className="focus:border-brand-dark focus:ring-brand-dark block w-full rounded-md border-slate-300 shadow-sm sm:text-sm"
                        {...field}
                      />
                    )}
                    rules={{
                      required: true,
                    }}
                  />
                </div>
                {passwordResetEnabled && isPasswordFocused && (
                  <div className="ml-1 text-right transition-all duration-500 ease-in-out">
                    <Link
                      href="/auth/forgot-password"
                      className="hover:text-brand-dark text-xs text-slate-500">
                      {t("auth.login.forgot_your_password")}
                    </Link>
                  </div>
                )}
              </div>
            )}
            {emailAuthEnabled && (
              <Button
                size="base"
                onClick={() => {
                  if (!showLogin) {
                    setShowLogin(true);
                    // Add a slight delay before focusing the input field to ensure it's visible
                    setTimeout(() => emailRef.current?.focus(), 100);
                  } else if (formRef.current) {
                    formRef.current.requestSubmit();
                  }
                }}
                className="relative w-full justify-center"
                loading={loggingIn}>
                {totpLogin ? t("common.submit") : t("auth.login.login_with_email")}
                {lastLoggedInWith && lastLoggedInWith === "Email" ? (
                  <span className="absolute right-3 text-xs opacity-50">{t("auth.last_used")}</span>
                ) : null}
              </Button>
            )}
          </form>

          {googleOAuthEnabled && !totpLogin && (
            <>
              <GoogleButton
                inviteUrl={callbackUrl}
                lastUsed={lastLoggedInWith === "Google"}
                text={t("auth.continue_with_google")}
              />
            </>
          )}

          {githubOAuthEnabled && !totpLogin && (
            <>
              <GithubButton
                inviteUrl={callbackUrl}
                lastUsed={lastLoggedInWith === "Github"}
                text={t("auth.continue_with_github")}
              />
            </>
          )}

          {azureOAuthEnabled && !totpLogin && (
            <>
              <AzureButton
                inviteUrl={callbackUrl}
                lastUsed={lastLoggedInWith === "Azure"}
                text={t("auth.continue_with_azure")}
              />
            </>
          )}

          {oidcOAuthEnabled && !totpLogin && (
            <>
              <OpenIdButton
                inviteUrl={callbackUrl}
                text={t("auth.continue_with_oidc", { oidcDisplayName })}
                lastUsed={lastLoggedInWith === "OpenID"}
              />
            </>
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

      {signInError && (
        <div className="absolute top-10 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                {t("auth.login.an_error_occurred_when_logging_you_in")}
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p className="space-y-1 whitespace-pre-wrap">{signInError}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </FormProvider>
  );
};
