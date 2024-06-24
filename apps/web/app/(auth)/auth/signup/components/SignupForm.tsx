"use client";

import { XCircleIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { SignupOptions } from "@formbricks/ui/SignupOptions";

interface SignupFormProps {
  webAppUrl: string;
  privacyUrl: string | undefined;
  termsUrl: string | undefined;
  passwordResetEnabled: boolean;
  emailVerificationDisabled: boolean;
  emailAuthEnabled: boolean;
  googleOAuthEnabled: boolean;
  githubOAuthEnabled: boolean;
  azureOAuthEnabled: boolean;
  oidcOAuthEnabled: boolean;
  oidcDisplayName?: string;
}

export const SignupForm = ({
  webAppUrl,
  privacyUrl,
  termsUrl,
  passwordResetEnabled,
  emailVerificationDisabled,
  emailAuthEnabled,
  googleOAuthEnabled,
  githubOAuthEnabled,
  azureOAuthEnabled,
  oidcOAuthEnabled,
  oidcDisplayName,
}: SignupFormProps) => {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string>("");

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
              <h3 className="text-sm font-medium text-red-800">An error occurred when signing you up</h3>
              <div className="mt-2 text-sm text-red-700">
                <p className="space-y-1 whitespace-pre-wrap">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="text-center">
        <h1 className="mb-4 text-slate-700">Create your Formbricks account</h1>
        <SignupOptions
          emailAuthEnabled={emailAuthEnabled}
          emailFromSearchParams={searchParams?.get("email") || ""}
          setError={setError}
          emailVerificationDisabled={emailVerificationDisabled}
          passwordResetEnabled={passwordResetEnabled}
          googleOAuthEnabled={googleOAuthEnabled}
          githubOAuthEnabled={githubOAuthEnabled}
          azureOAuthEnabled={azureOAuthEnabled}
          oidcOAuthEnabled={oidcOAuthEnabled}
          inviteToken={inviteToken}
          callbackUrl={callbackUrl}
          oidcDisplayName={oidcDisplayName}
        />
        {(termsUrl || privacyUrl) && (
          <div className="mt-3 text-center text-xs text-slate-500">
            By signing up, you agree to our
            <br />
            {termsUrl && (
              <Link className="font-semibold" href={termsUrl} rel="noreferrer" target="_blank">
                Terms of Service
              </Link>
            )}
            {termsUrl && privacyUrl && <span> and </span>}
            {privacyUrl && (
              <Link className="font-semibold" href={privacyUrl} rel="noreferrer" target="_blank">
                Privacy Policy.
              </Link>
            )}
            {/*           <br />
          We&apos;ll occasionally send you account related emails. */}
            <hr className="mx-6 mt-3"></hr>
          </div>
        )}

        <div className="mt-9 text-center text-xs">
          <span className="leading-5 text-slate-500">Have an account?</span>
          <br />
          <Link
            href={inviteToken ? `/auth/login?callbackUrl=${callbackUrl}` : "/auth/login"}
            className="font-semibold text-slate-600 underline hover:text-slate-700">
            Log in.
          </Link>
        </div>
      </div>
    </>
  );
};
