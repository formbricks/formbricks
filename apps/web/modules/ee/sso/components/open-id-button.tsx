"use client";

import { signIn } from "next-auth/react";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@/lib/localStorage";
import { getSsoReturnToUrl } from "@/modules/ee/sso/lib/utils";
import { Button } from "@/modules/ui/components/button";

interface OpenIdButtonProps {
  returnToUrl?: string;
  lastUsed?: boolean;
  directRedirect?: boolean;
  text?: string;
  source: "signin" | "signup";
}

export const OpenIdButton = ({
  returnToUrl,
  lastUsed,
  directRedirect = false,
  text,
  source,
}: OpenIdButtonProps) => {
  const { t } = useTranslation();
  const handleLogin = useCallback(async () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(FORMBRICKS_LOGGED_IN_WITH_LS, "OpenID");
    }
    const returnToUrlWithSource = getSsoReturnToUrl(returnToUrl, source);

    await signIn("openid", {
      redirect: true,
      callbackUrl: returnToUrlWithSource,
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
      variant="secondary"
      className="w-full items-center justify-center gap-2 px-2">
      <span className="truncate">{text || t("auth.continue_with_openid")}</span>
      {lastUsed && <span className="shrink-0 text-xs opacity-50">{t("auth.last_used")}</span>}
    </Button>
  );
};
