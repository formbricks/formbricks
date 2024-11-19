"use client";

import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect } from "react";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@formbricks/lib/localStorage";
import { Button } from "@formbricks/ui/components/Button";

interface OpenIdButtonProps {
  inviteUrl?: string | null;
  lastUsed?: boolean;
  directRedirect?: boolean;
  text?: string;
}

export const OpenIdButton = ({ inviteUrl, lastUsed, directRedirect = false, text }: OpenIdButtonProps) => {
  const t = useTranslations();
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
      size="base"
      type="button"
      startIconClassName="ml-2"
      onClick={handleLogin}
      variant="secondary"
      className="relative w-full justify-center">
      {text ? text : t("auth.continue_with_openid")}
      {lastUsed && <span className="absolute right-3 text-xs opacity-50">{t("auth.last_used")}</span>}
    </Button>
  );
};
