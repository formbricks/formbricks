"use client";

import { LockIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@/lib/localStorage";
import { authClient } from "@/modules/auth/lib/auth-client";
import { doesSamlConnectionExistAction } from "@/modules/ee/sso/actions";
import { getSsoReturnToUrl } from "@/modules/ee/sso/lib/utils";
import { Button } from "@/modules/ui/components/button";

interface SamlButtonProps {
  returnToUrl?: string;
  lastUsed?: boolean;
  source: "signin" | "signup";
}

export const SamlButton = ({ returnToUrl, lastUsed, source }: Readonly<SamlButtonProps>) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(FORMBRICKS_LOGGED_IN_WITH_LS, "Saml");
    }
    setIsLoading(true);
    const doesSamlConnectionExist = await doesSamlConnectionExistAction();
    if (!doesSamlConnectionExist?.data) {
      toast.error(t("auth.saml_connection_error"));
      setIsLoading(false);
      return;
    }

    const returnToUrlWithSource = getSsoReturnToUrl(returnToUrl, source);

    // tenant/product are static and live server-side in the SAML genericOAuth provider's
    // authorizationUrlParams (better-auth-providers.ts), so the client only selects the provider.
    // Better Auth 1.7 rebuilt genericOAuth onto the built-in social path (ENG-2343), so
    // signIn.oauth2({ providerId }) became signIn.social({ provider }). The callback URL is
    // NOT affected: better-auth-providers.ts pins `redirectURI` to /api/auth/oauth2/callback/saml,
    // the URL already registered at every customer IdP, and legacy-sso-callback.ts serves it.
    await authClient.signIn.social({
      provider: "saml",
      callbackURL: returnToUrlWithSource,
      // OAuth failures redirect here so the login page's existing ?error= UX surfaces them (parity).
      errorCallbackURL: "/auth/login",
    });
  };

  return (
    <Button
      type="button"
      onClick={handleLogin}
      variant="secondary"
      className="relative w-full justify-center"
      loading={isLoading}>
      {t("auth.continue_with_saml")}

      <LockIcon />
      {lastUsed && <span className="absolute right-3 text-xs opacity-50">{t("auth.last_used")}</span>}
    </Button>
  );
};
