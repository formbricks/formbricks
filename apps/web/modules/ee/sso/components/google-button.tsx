"use client";

import { Button } from "@/modules/ui/components/button";
import { GoogleIcon } from "@/modules/ui/components/icons";
import { useTranslate } from "@tolgee/react";
import { signIn } from "next-auth/react";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@formbricks/lib/localStorage";

interface GoogleButtonProps {
  inviteUrl?: string;
  lastUsed?: boolean;
}

export const GoogleButton = ({ inviteUrl, lastUsed }: GoogleButtonProps) => {
  const { t } = useTranslate();
  const handleLogin = async () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(FORMBRICKS_LOGGED_IN_WITH_LS, "Google");
    }
    await signIn("google", {
      redirect: true,
      callbackUrl: inviteUrl ? inviteUrl : "/", // redirect after login to /
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
