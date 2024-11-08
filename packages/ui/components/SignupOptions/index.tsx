"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createUser } from "@formbricks/lib/utils/users";
import { Button } from "../Button";
import { PasswordInput } from "../PasswordInput";
import { AzureButton } from "./components/AzureButton";
import { GithubButton } from "./components/GithubButton";
import { GoogleButton } from "./components/GoogleButton";
import { IsPasswordValid } from "./components/IsPasswordValid";
import { OpenIdButton } from "./components/OpenIdButton";

interface SignupOptionsProps {
  emailAuthEnabled: boolean;
  emailFromSearchParams: string;
  setError?: (error: string) => void;
  emailVerificationDisabled: boolean;
  googleOAuthEnabled: boolean;
  githubOAuthEnabled: boolean;
  azureOAuthEnabled: boolean;
  oidcOAuthEnabled: boolean;
  inviteToken: string | null;
  callbackUrl: string;
  oidcDisplayName?: string;
  userLocale: string;
}

export const SignupOptions = ({
  emailAuthEnabled,
  emailFromSearchParams,
  setError,
  emailVerificationDisabled,
  googleOAuthEnabled,
  githubOAuthEnabled,
  azureOAuthEnabled,
  oidcOAuthEnabled,
  inviteToken,
  callbackUrl,
  oidcDisplayName,
  userLocale,
}: SignupOptionsProps) => {
  const t = useTranslations();
  const [password, setPassword] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [signingUp, setSigningUp] = useState(false);
  const [isButtonEnabled, setButtonEnabled] = useState(true);

  const router = useRouter();

  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const checkFormValidity = () => {
    // If all fields are filled, enable the button
    if (formRef.current) {
      setButtonEnabled(formRef.current.checkValidity());
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (!isValid) {
      return;
    }

    setSigningUp(true);

    try {
      await createUser(
        e.target.elements.name.value,
        e.target.elements.email.value,
        e.target.elements.password.value,
        userLocale,
        inviteToken || ""
      );
      const url = emailVerificationDisabled
        ? `/auth/signup-without-verification-success`
        : `/auth/verification-requested?email=${encodeURIComponent(e.target.elements.email.value)}`;

      router.push(url);
    } catch (e: any) {
      if (setError) {
        setError(e.message);
      }
      setSigningUp(false);
    }
  };

  return (
    <div className="space-y-2">
      {emailAuthEnabled && (
        <form onSubmit={handleSubmit} ref={formRef} className="space-y-2" onChange={checkFormValidity}>
          {showLogin && (
            <div>
              <div className="mb-2 transition-all duration-500 ease-in-out">
                <label htmlFor="name" className="sr-only">
                  {t("common.full_name")}
                </label>
                <div className="mt-1">
                  <input
                    ref={nameRef}
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="given-name"
                    placeholder={t("common.full_name")}
                    aria-placeholder={"Full name"}
                    required
                    className="focus:border-brand-dark focus:ring-brand-dark block w-full rounded-md border-slate-300 shadow-sm sm:text-sm"
                  />
                </div>
              </div>
              <div className="mb-2 transition-all duration-500 ease-in-out">
                <label htmlFor="email" className="sr-only">
                  {t("common.email")}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="work@email.com"
                  defaultValue={emailFromSearchParams}
                  className="focus:border-brand-dark focus:ring-brand-dark block w-full rounded-md border-slate-300 shadow-sm sm:text-sm"
                />
              </div>
              <div className="transition-all duration-500 ease-in-out">
                <label htmlFor="password" className="sr-only">
                  {t("common.password")}
                </label>
                <PasswordInput
                  id="password"
                  name="password"
                  value={password ? password : ""}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="*******"
                  aria-placeholder="password"
                  required
                  className="focus:border-brand-dark focus:ring-brand-dark block w-full rounded-md shadow-sm sm:text-sm"
                />
              </div>
              <IsPasswordValid password={password} setIsValid={setIsValid} />
            </div>
          )}
          {showLogin && (
            <Button
              size="base"
              type="submit"
              className="w-full justify-center"
              loading={signingUp}
              disabled={formRef.current ? !isButtonEnabled || !isValid : !isButtonEnabled}>
              {t("auth.continue_with_email")}
            </Button>
          )}

          {!showLogin && (
            <Button
              size="base"
              type="button"
              onClick={() => {
                setShowLogin(true);
                setButtonEnabled(false);
                // Add a slight delay before focusing the input field to ensure it's visible
                setTimeout(() => nameRef.current?.focus(), 100);
              }}
              className="w-full justify-center">
              {t("auth.continue_with_email")}
            </Button>
          )}
        </form>
      )}
      {googleOAuthEnabled && (
        <>
          <GoogleButton inviteUrl={callbackUrl} text={t("auth.continue_with_google")} />
        </>
      )}
      {githubOAuthEnabled && (
        <>
          <GithubButton inviteUrl={callbackUrl} text={t("auth.continue_with_github")} />
        </>
      )}
      {azureOAuthEnabled && (
        <>
          <AzureButton inviteUrl={callbackUrl} text={t("auth.continue_with_azure")} />
        </>
      )}
      {oidcOAuthEnabled && (
        <>
          <OpenIdButton inviteUrl={callbackUrl} text={t("auth.continue_with_oidc", { oidcDisplayName })} />
        </>
      )}
    </div>
  );
};
