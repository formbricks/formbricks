"use client";

import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@formbricks/lib/localStorage";
import { Button } from "@formbricks/ui/components/Button";
import { GoogleIcon } from "@formbricks/ui/components/icons";

interface GoogleButtonProps {
  inviteUrl?: string | null;
  lastUsed?: boolean;
}

export const GoogleButton = ({ inviteUrl, lastUsed }: GoogleButtonProps) => {
  const t = useTranslations();
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
      size="base"
      type="button"
      EndIcon={GoogleIcon}
      startIconClassName="ml-3"
      onClick={handleLogin}
      variant="secondary"
      className="relative w-full justify-center">
      {t("auth.continue_with_google")}
      {lastUsed && <span className="absolute right-3 text-xs opacity-50">{t("auth.last_used")}</span>}
    </Button>
  );
};
