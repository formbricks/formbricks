"use client";

import { useTranslation } from "react-i18next";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@/lib/localStorage";
import { authClient } from "@/modules/auth/lib/auth-client";
import { getSsoReturnToUrl } from "@/modules/ee/sso/lib/utils";
import { Button } from "@/modules/ui/components/button";
import { GithubIcon } from "@/modules/ui/components/icons";

interface GithubButtonProps {
  returnToUrl?: string;
  lastUsed?: boolean;
  variant?: "default" | "secondary";
  source: "signin" | "signup";
}

export const GithubButton = ({
  returnToUrl,
  lastUsed,
  variant = "secondary",
  source,
}: Readonly<GithubButtonProps>) => {
  const { t } = useTranslation();
  const handleLogin = async () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(FORMBRICKS_LOGGED_IN_WITH_LS, "Github");
    }
    const returnToUrlWithSource = getSsoReturnToUrl(returnToUrl, source);

    await authClient.signIn.social({
      provider: "github",
      callbackURL: returnToUrlWithSource,
      // OAuth failures redirect here so the login page's existing ?error= UX surfaces them (parity).
      errorCallbackURL: "/auth/login",
    });
  };

  return (
    <Button type="button" onClick={handleLogin} variant={variant} className="w-full justify-center">
      {t("auth.continue_with_github")}
      <GithubIcon />
      {lastUsed && <span className="shrink-0 text-xs opacity-50">{t("auth.last_used")}</span>}
    </Button>
  );
};
