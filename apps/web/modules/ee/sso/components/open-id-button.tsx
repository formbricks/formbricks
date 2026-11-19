"use client";

import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { startSsoSignIn } from "@/modules/ee/sso/lib/start-sso-sign-in";
import { getSsoReturnToUrl } from "@/modules/ee/sso/lib/utils";
import { Button } from "@/modules/ui/components/button";

interface OpenIdButtonProps {
  returnToUrl?: string;
  lastUsed?: boolean;
  variant?: "default" | "secondary";
  directRedirect?: boolean;
  text?: string;
  source: "signin" | "signup";
}

export const OpenIdButton = ({
  returnToUrl,
  lastUsed,
  variant = "secondary",
  directRedirect = false,
  text,
  source,
}: Readonly<OpenIdButtonProps>) => {
  const { t } = useTranslation();
  const handleLogin = useCallback(async () => {
    const returnToUrlWithSource = getSsoReturnToUrl(returnToUrl, source);

    // Better Auth 1.7 rebuilt genericOAuth onto the built-in social path (ENG-2343), so
    // signIn.oauth2({ providerId }) became signIn.social({ provider }). The callback URL is
    // NOT affected: better-auth-providers.ts pins `redirectURI` to /api/auth/oauth2/callback/openid,
    // the URL already registered at every customer IdP, and legacy-sso-callback.ts serves it.
    await startSsoSignIn({
      provider: "openid",
      callbackURL: returnToUrlWithSource,
      errorMessage: t("common.something_went_wrong"),
    });
  }, [returnToUrl, source, t]);

  useEffect(() => {
    if (directRedirect) {
      void handleLogin();
    }
  }, [directRedirect, handleLogin]);

  return (
    <Button
      type="button"
      onClick={handleLogin}
      variant={variant}
      className="h-11 w-full min-w-0 items-center justify-center gap-2 px-2 sm:h-9">
      <span className="truncate">{text || t("auth.continue_with_openid")}</span>
      {lastUsed && <span className="shrink-0 text-xs opacity-50">{t("auth.last_used")}</span>}
    </Button>
  );
};
