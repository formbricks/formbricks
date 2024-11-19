"use client";

import { SignupOptions } from "@/modules/auth/components/SignupOptions";
import { XCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

interface SignupFormProps {
  webAppUrl: string;
  privacyUrl: string | undefined;
  termsUrl: string | undefined;
  emailVerificationDisabled: boolean;
  emailAuthEnabled: boolean;
  googleOAuthEnabled: boolean;
  githubOAuthEnabled: boolean;
  azureOAuthEnabled: boolean;
  oidcOAuthEnabled: boolean;
  oidcDisplayName?: string;
  userLocale: string;
}

export const SignupForm = ({
  webAppUrl,
  privacyUrl,
  termsUrl,
  emailVerificationDisabled,
  emailAuthEnabled,
  googleOAuthEnabled,
  githubOAuthEnabled,
  azureOAuthEnabled,
  oidcOAuthEnabled,
  oidcDisplayName,
  userLocale,
}: SignupFormProps) => {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string>("");
  const t = useTranslations();
  const inviteToken = searchParams?.get("inviteToken");
  const callbackUrl = useMemo(() => {
    if (inviteToken) {
      return webAppUrl + "/invite?token=" + inviteToken;
    } else {
      return webAppUrl;
    }
  }, [inviteToken, webAppUrl]);

  return (
    <>
      {error && (
        <div className="absolute top-10 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{t("auth.signup.error")}</h3>
              <div className="mt-2 text-sm text-red-700">
                <p className="space-y-1 whitespace-pre-wrap">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="text-center">
        <h1 className="mb-4 text-slate-700">{t("auth.signup.title")}</h1>
        <SignupOptions
          emailAuthEnabled={emailAuthEnabled}
          emailFromSearchParams={searchParams?.get("email") || ""}
          setError={setError}
          emailVerificationDisabled={emailVerificationDisabled}
          googleOAuthEnabled={googleOAuthEnabled}
          githubOAuthEnabled={githubOAuthEnabled}
          azureOAuthEnabled={azureOAuthEnabled}
          oidcOAuthEnabled={oidcOAuthEnabled}
          inviteToken={inviteToken}
          callbackUrl={callbackUrl}
          oidcDisplayName={oidcDisplayName}
          userLocale={userLocale}
        />
        {(termsUrl || privacyUrl) && (
          <div className="mt-3 text-center text-xs text-slate-500">
            {t("auth.signup.terms_of_service")}
            <br />
            {termsUrl && (
              <Link className="font-semibold" href={termsUrl} rel="noreferrer" target="_blank">
                {t("auth.signup.terms_of_service")}
              </Link>
            )}
            {termsUrl && privacyUrl && <span> {t("common.and")} </span>}
            {privacyUrl && (
              <Link className="font-semibold" href={privacyUrl} rel="noreferrer" target="_blank">
                {t("auth.signup.privacy_policy")}
              </Link>
            )}
            {/*           <br />
          We&apos;ll occasionally send you account related emails. */}
            <hr className="mx-6 mt-3"></hr>
          </div>
        )}

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
    </>
  );
};
