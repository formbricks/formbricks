"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { cn } from "@/lib/cn";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@/lib/localStorage";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createEmailTokenAction } from "@/modules/auth/actions";
import {
  type AuthMethodId,
  getAuthMethodButtonVariant,
  sortAuthMethodsByLastUsed,
} from "@/modules/auth/lib/sort-auth-methods";
import { buildVerificationRequestedPath } from "@/modules/auth/lib/verification-links";
import { AzureButton } from "@/modules/ee/sso/components/azure-button";
import { GithubButton } from "@/modules/ee/sso/components/github-button";
import { GoogleButton } from "@/modules/ee/sso/components/google-button";
import { OpenIdButton } from "@/modules/ee/sso/components/open-id-button";
import { SamlButton } from "@/modules/ee/sso/components/saml-button";
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
  samlTenant: string;
  samlProduct: string;
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
  samlTenant,
  samlProduct,
  oauthError,
  prefilledEmail,
  inviteToken,
  resolvedCallbackPath,
  resolvedCallbackUrl,
}: LoginFormProps) => {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const oauthAccountNotLinked = oauthError === "OAuthAccountNotLinked";
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
      const signInResponse = await signIn("credentials", {
        callbackUrl: resolvedCallbackUrl || "/",
        email: data.email.toLowerCase(),
        password: data.password,
        ...(totpLogin && { totpCode: data.totpCode }),
        ...(totpBackup && { backupCode: data.backupCode }),
        redirect: false,
      });

      if (signInResponse?.error === "second factor required") {
        setTotpLogin(true);
        return;
      }

      if (signInResponse?.error === "Email Verification is Pending") {
        const emailTokenActionResponse = await createEmailTokenAction({ email: data.email });
        if (emailTokenActionResponse?.data) {
          router.push(
            buildVerificationRequestedPath({
              token: emailTokenActionResponse.data,
              callbackUrl: resolvedCallbackUrl,
            })
          );
        } else {
          const errorMessage = getFormattedErrorMessage(emailTokenActionResponse);
          toast.error(errorMessage);
        }
        return;
      }

      if (signInResponse?.error) {
        toast.error(signInResponse.error);
        return;
      }

      if (!signInResponse?.error) {
        router.push(resolvedCallbackPath || "/");
      }
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

  const enabledAuthMethods = useMemo(() => {
    const methods: AuthMethodId[] = [];

    if (emailAuthEnabled) {
      methods.push("Email");
    }

    if (isSsoEnabled) {
      if (googleOAuthEnabled) {
        methods.push("Google");
      }
      if (githubOAuthEnabled) {
        methods.push("Github");
      }
      if (azureOAuthEnabled) {
        methods.push("Azure");
      }
      if (oidcOAuthEnabled) {
        methods.push("OpenID");
      }
      if (samlSsoEnabled) {
        methods.push("Saml");
      }
    }

    return sortAuthMethodsByLastUsed(methods, lastLoggedInWith);
  }, [
    emailAuthEnabled,
    isSsoEnabled,
    googleOAuthEnabled,
    githubOAuthEnabled,
    azureOAuthEnabled,
    oidcOAuthEnabled,
    samlSsoEnabled,
    lastLoggedInWith,
  ]);

  const renderAuthMethodButton = (method: AuthMethodId) => {
    const isLastUsed = lastLoggedInWith === method;
    const variant = getAuthMethodButtonVariant(method, lastLoggedInWith);

    switch (method) {
      case "Email":
        return (
          <Button
            key="Email"
            type={showLogin ? "submit" : "button"}
            onClick={
              showLogin
                ? undefined
                : () => {
                    setShowLogin(true);
                    setTimeout(() => emailRef.current?.focus(), 100);
                  }
            }
            variant={variant}
            className="relative w-full justify-center"
            loading={form.formState.isSubmitting}>
            {totpLogin ? t("common.submit") : t("auth.login.login_with_email")}
            {isLastUsed ? (
              <span className="absolute right-3 text-xs opacity-50">{t("auth.last_used")}</span>
            ) : null}
          </Button>
        );
      case "Google":
        return (
          <GoogleButton
            key="Google"
            returnToUrl={resolvedCallbackUrl}
            lastUsed={isLastUsed}
            variant={variant}
            source="signin"
          />
        );
      case "Github":
        return (
          <GithubButton
            key="Github"
            returnToUrl={resolvedCallbackUrl}
            lastUsed={isLastUsed}
            variant={variant}
            source="signin"
          />
        );
      case "Azure":
        return (
          <AzureButton
            key="Azure"
            returnToUrl={resolvedCallbackUrl}
            lastUsed={isLastUsed}
            variant={variant}
            source="signin"
          />
        );
      case "OpenID":
        return (
          <OpenIdButton
            key="OpenID"
            returnToUrl={resolvedCallbackUrl}
            lastUsed={isLastUsed}
            variant={variant}
            text={t("auth.continue_with_oidc", { oidcDisplayName })}
            source="signin"
          />
        );
      case "Saml":
        return (
          <SamlButton
            key="Saml"
            returnToUrl={resolvedCallbackUrl}
            lastUsed={isLastUsed}
            variant={variant}
            samlTenant={samlTenant}
            samlProduct={samlProduct}
            source="signin"
          />
        );
      default:
        return null;
    }
  };

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
            {enabledAuthMethods.map(renderAuthMethodButton)}
          </form>
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
