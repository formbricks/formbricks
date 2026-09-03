"use client";

import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@/lib/localStorage";
import { authClient } from "@/modules/auth/lib/auth-client";
import { getSsoReturnToUrl } from "@/modules/ee/sso/lib/utils";
import { Button } from "@/modules/ui/components/button";
import { MicrosoftIcon } from "@/modules/ui/components/icons";

interface AzureButtonProps {
  returnToUrl?: string;
  directRedirect?: boolean;
  lastUsed?: boolean;
  variant?: "default" | "secondary";
  source: "signin" | "signup";
}

export const AzureButton = ({
  returnToUrl,
  directRedirect = false,
  lastUsed,
  variant = "secondary",
  source,
}: Readonly<AzureButtonProps>) => {
  const { t } = useTranslation();
  const handleLogin = useCallback(async () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(FORMBRICKS_LOGGED_IN_WITH_LS, "Azure");
    }
    const returnToUrlWithSource = getSsoReturnToUrl(returnToUrl, source);

    // Better Auth 1.7 rebuilt genericOAuth onto the built-in social path (ENG-2343), so
    // signIn.oauth2({ providerId }) became signIn.social({ provider }). The callback URL is
    // NOT affected: better-auth-providers.ts pins `redirectURI` to /api/auth/oauth2/callback/azuread,
    // the URL already registered at every customer IdP, and legacy-sso-callback.ts serves it.
    await authClient.signIn.social({
      provider: "azuread",
      callbackURL: returnToUrlWithSource,
      // OAuth failures redirect here so the login page's existing ?error= UX surfaces them (parity).
      errorCallbackURL: "/auth/login",
    });
  }, [returnToUrl, source]);

  useEffect(() => {
    if (directRedirect) {
      handleLogin();
    }
  }, [directRedirect, handleLogin]);

  return (
    <Button
      type="button"
      onClick={handleLogin}
      variant={variant}
      className="h-11 w-full min-w-0 justify-center sm:h-9">
      <span className="truncate">{t("auth.continue_with_azure")}</span>
      <MicrosoftIcon />
      {lastUsed && <span className="shrink-0 text-xs opacity-50">{t("auth.last_used")}</span>}
    </Button>
  );
};
