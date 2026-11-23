"use client";

import { LockIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { startSsoSignIn } from "@/modules/ee/sso/lib/start-sso-sign-in";
import { getSsoReturnToUrl } from "@/modules/ee/sso/lib/utils";
import { Button } from "@/modules/ui/components/button";

interface SamlButtonProps {
  returnToUrl?: string;
  lastUsed?: boolean;
  source: "signin" | "signup";
  /** Whether the instance's one SAML connection exists, looked up where the page rendered. */
  connectionExists: boolean;
}

export const SamlButton = ({
  returnToUrl,
  lastUsed,
  source,
  connectionExists,
}: Readonly<SamlButtonProps>) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!connectionExists) {
      toast.error(t("auth.saml_connection_error"));
      return;
    }
    setIsLoading(true);

    const returnToUrlWithSource = getSsoReturnToUrl(returnToUrl, source);

    // tenant/product are static and live server-side in the SAML genericOAuth provider's
    // authorizationUrlParams (better-auth-providers.ts), so the client only selects the provider.
    // Better Auth 1.7 rebuilt genericOAuth onto the built-in social path (ENG-2343), so
    // signIn.oauth2({ providerId }) became signIn.social({ provider }). The callback URL is
    // NOT affected: better-auth-providers.ts pins `redirectURI` to /api/auth/oauth2/callback/saml,
    // the URL already registered at every customer IdP, and legacy-sso-callback.ts serves it.
    const started = await startSsoSignIn({
      provider: "saml",
      callbackURL: returnToUrlWithSource,
      errorMessage: t("common.something_went_wrong"),
    });
    // On success the browser is leaving for the IdP, so the spinner stays; on failure the user retries.
    if (!started) setIsLoading(false);
  };

  return (
    <Button
      type="button"
      onClick={handleLogin}
      variant="secondary"
      className="h-11 w-full min-w-0 justify-center sm:h-9"
      loading={isLoading}>
      <span className="truncate">{t("auth.continue_with_saml")}</span>
      <LockIcon />
      {lastUsed && <span className="shrink-0 text-xs opacity-50">{t("auth.last_used")}</span>}
    </Button>
  );
};
