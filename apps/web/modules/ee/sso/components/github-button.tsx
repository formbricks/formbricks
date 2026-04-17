"use client";

import { signIn } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@/lib/localStorage";
import { getSsoReturnToUrl } from "@/modules/ee/sso/lib/utils";
import { Button } from "@/modules/ui/components/button";
import { GithubIcon } from "@/modules/ui/components/icons";

interface GithubButtonProps {
  returnToUrl?: string;
  lastUsed?: boolean;
  source: "signin" | "signup";
}

export const GithubButton = ({ returnToUrl, lastUsed, source }: GithubButtonProps) => {
  const { t } = useTranslation();
  const handleLogin = async () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(FORMBRICKS_LOGGED_IN_WITH_LS, "Github");
    }
    const returnToUrlWithSource = getSsoReturnToUrl(returnToUrl, source);

    await signIn("github", {
      redirect: true,
      callbackUrl: returnToUrlWithSource,
    });
  };

  return (
    <Button
      type="button"
      onClick={handleLogin}
      variant="secondary"
      className="relative w-full justify-center">
      {t("auth.continue_with_github")}
      <GithubIcon />
      {lastUsed && <span className="absolute right-3 text-xs opacity-50">{t("auth.last_used")}</span>}
    </Button>
  );
};
