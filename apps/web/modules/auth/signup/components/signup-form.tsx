"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createUserAction } from "@/modules/auth/signup/actions";
import { TermsPrivacyLinks } from "@/modules/auth/signup/components/terms-privacy-links";
import { captureFailedSignup } from "@/modules/auth/signup/lib/utils";
import { SSOOptions } from "@/modules/ee/sso/components/sso-options";
import { Button } from "@/modules/ui/components/button";
import { FormControl, FormError, FormField, FormItem } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { PasswordInput } from "@/modules/ui/components/password-input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@tolgee/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import Turnstile, { useTurnstile } from "react-turnstile";
import { z } from "zod";
import { env } from "@formbricks/lib/env";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TUserLocale, ZUserName, ZUserPassword } from "@formbricks/types/user";
import { createEmailTokenAction } from "../../../auth/actions";
import { PasswordChecks } from "./password-checks";

const ZSignupInput = z.object({
  name: ZUserName,
  email: z.string().email(),
  password: ZUserPassword,
});

const turnstileSiteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

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
  defaultOrganizationId?: string;
  defaultOrganizationRole?: TOrganizationRole;
  defaultTeamId?: string;
  isSsoEnabled: boolean;
  samlSsoEnabled: boolean;
  isTurnstileConfigured: boolean;
  samlTenant: string;
  samlProduct: string;
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
  defaultOrganizationId,
  defaultOrganizationRole,
  defaultTeamId,
  isSsoEnabled,
  samlSsoEnabled,
  isTurnstileConfigured,
  samlTenant,
  samlProduct,
}: SignupFormProps) => {
  const [showLogin, setShowLogin] = useState(false);
  const searchParams = useSearchParams();
  const { t } = useTranslate();
  const inviteToken = searchParams?.get("inviteToken");
  const router = useRouter();
  const [turnstileToken, setTurnstileToken] = useState<string>();

  const turnstile = useTurnstile();

  const callbackUrl = useMemo(() => {
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

  const handleSubmit = async (data: TSignupInput) => {
    try {
      if (isTurnstileConfigured && !turnstileToken) {
        throw new Error(t("auth.signup.please_verify_captcha"));
      }

      const createUserResponse = await createUserAction({
        name: data.name,
        email: data.email,
        password: data.password,
        userLocale,
        inviteToken: inviteToken || "",
        emailVerificationDisabled,
        defaultOrganizationId,
        defaultOrganizationRole,
        defaultTeamId,
        turnstileToken,
      });

      if (createUserResponse?.data) {
        const emailTokenActionResponse = await createEmailTokenAction({ email: data.email });
        if (emailTokenActionResponse?.data) {
          const token = emailTokenActionResponse?.data;
          const url = emailVerificationDisabled
            ? `/auth/signup-without-verification-success`
            : `/auth/verification-requested?token=${token}`;

          router.push(url);
        } else {
          if (isTurnstileConfigured) {
            setTurnstileToken(undefined);
            turnstile.reset();
          }

          const errorMessage = getFormattedErrorMessage(emailTokenActionResponse);
          toast.error(errorMessage);
        }
      } else {
        if (isTurnstileConfigured) {
          setTurnstileToken(undefined);
          turnstile.reset();
        }

        const errorMessage = getFormattedErrorMessage(createUserResponse);
        toast.error(errorMessage);
      }
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
                              value={field.value}
                              name="name"
                              autoFocus
                              onChange={(name) => field.onChange(name)}
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
                              value={field.value}
                              name="email"
                              onChange={(email) => field.onChange(email)}
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
                              id="password"
                              name="password"
                              value={field.value}
                              onChange={(password) => field.onChange(password)}
                              autoComplete="current-password"
                              placeholder="*******"
                              aria-placeholder="password"
                              required
                              className="focus:border-brand-dark focus:ring-brand-dark block w-full rounded-md shadow-sm sm:text-sm"
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
                  captureFailedSignup(form.getValues("email"), form.getValues("name"));
                }}
              />
            )}

            {showLogin && (
              <Button
                type="submit"
                className="h-10 w-full justify-center"
                loading={form.formState.isSubmitting}
                disabled={!form.formState.isValid}>
                {t("auth.continue_with_email")}
              </Button>
            )}

            {!showLogin && (
              <Button
                type="button"
                onClick={() => {
                  setShowLogin(true);
                }}
                className="h-10 w-full justify-center">
                {t("auth.continue_with_email")}
              </Button>
            )}
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
          samlTenant={samlTenant}
          samlProduct={samlProduct}
          callbackUrl={callbackUrl}
        />
      )}
      <TermsPrivacyLinks termsUrl={termsUrl} privacyUrl={privacyUrl} />
      <div className="mt-9 text-center text-xs">
        <span className="leading-5 text-slate-500">{t("auth.signup.have_an_account")}</span>
        <br />
        <Link
          href={inviteToken ? `/auth/login?callbackUrl=${callbackUrl}` : "/auth/login"}
          className="font-semibold text-slate-600 underline hover:text-slate-700">
          {t("auth.signup.log_in")}
        </Link>
      </div>
    </div>
  );
};
