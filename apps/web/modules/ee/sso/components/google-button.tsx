"use client";

import { signIn } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@/lib/localStorage";
import { getCallbackUrl } from "@/modules/ee/sso/lib/utils";
import { Button } from "@/modules/ui/components/button";
import { GoogleIcon } from "@/modules/ui/components/icons";

interface GoogleButtonProps {
  inviteUrl?: string;
  lastUsed?: boolean;
  source: "signin" | "signup";
}

export const GoogleButton = ({ inviteUrl, lastUsed, source }: GoogleButtonProps) => {
  const { t } = useTranslation();
  const handleLogin = async () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(FORMBRICKS_LOGGED_IN_WITH_LS, "Google");
    }
    const callbackUrlWithSource = getCallbackUrl(inviteUrl, source);

    await signIn("google", {
      redirect: true,
      callbackUrl: callbackUrlWithSource,
    });
  };

  return (
    <Button
      type="button"
      onClick={handleLogin}
      variant="secondary"
      className="relative w-full justify-center">
      {t("auth.continue_with_google")}
      <GoogleIcon />
      {lastUsed && <span className="absolute right-3 text-xs opacity-50">{t("auth.last_used")}</span>}
    </Button>
  );
};
