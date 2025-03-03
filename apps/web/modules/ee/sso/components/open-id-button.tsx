"use client";

import { Button } from "@/modules/ui/components/button";
import { useTranslate } from "@tolgee/react";
import { signIn } from "next-auth/react";
import { useCallback, useEffect } from "react";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@formbricks/lib/localStorage";

interface OpenIdButtonProps {
  inviteUrl?: string;
  lastUsed?: boolean;
  directRedirect?: boolean;
  text?: string;
}

export const OpenIdButton = ({ inviteUrl, lastUsed, directRedirect = false, text }: OpenIdButtonProps) => {
  const { t } = useTranslate();
  const handleLogin = useCallback(async () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(FORMBRICKS_LOGGED_IN_WITH_LS, "OpenID");
    }
    await signIn("openid", {
      redirect: true,
      callbackUrl: inviteUrl ? inviteUrl : "/",
    });
  }, [inviteUrl]);

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
      className="relative w-full justify-center">
      {text ? text : t("auth.continue_with_openid")}
      {lastUsed && <span className="absolute right-3 text-xs opacity-50">{t("auth.last_used")}</span>}
    </Button>
  );
};
