"use client";

import { useTranslation } from "react-i18next";
import { startSsoSignIn } from "@/modules/ee/sso/lib/start-sso-sign-in";
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
    const returnToUrlWithSource = getSsoReturnToUrl(returnToUrl, source);

    await startSsoSignIn({
      provider: "google",
      callbackURL: returnToUrlWithSource,
      errorMessage: t("common.something_went_wrong"),
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
