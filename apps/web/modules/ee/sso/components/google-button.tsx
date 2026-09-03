"use client";

import { useTranslation } from "react-i18next";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@/lib/localStorage";
import { authClient } from "@/modules/auth/lib/auth-client";
import { getSsoReturnToUrl } from "@/modules/ee/sso/lib/utils";
import { Button } from "@/modules/ui/components/button";
import { GoogleIcon } from "@/modules/ui/components/icons";

interface GoogleButtonProps {
  returnToUrl?: string;
  lastUsed?: boolean;
  variant?: "default" | "secondary";
  source: "signin" | "signup";
}

export const GoogleButton = ({
  returnToUrl,
  lastUsed,
  variant = "secondary",
  source,
}: Readonly<GoogleButtonProps>) => {
  const { t } = useTranslation();
  const handleLogin = async () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(FORMBRICKS_LOGGED_IN_WITH_LS, "Google");
    }
    const returnToUrlWithSource = getSsoReturnToUrl(returnToUrl, source);

    await authClient.signIn.social({
      provider: "google",
      callbackURL: returnToUrlWithSource,
      // OAuth failures redirect here so the login page's existing ?error= UX surfaces them (parity).
      errorCallbackURL: "/auth/login",
    });
  };

  return (
    <Button
      type="button"
      onClick={handleLogin}
      variant={variant}
      className="h-11 w-full min-w-0 justify-center sm:h-9">
      <span className="truncate">{t("auth.continue_with_google")}</span>
      <GoogleIcon />
      {lastUsed && <span className="shrink-0 text-xs opacity-50">{t("auth.last_used")}</span>}
    </Button>
  );
};
