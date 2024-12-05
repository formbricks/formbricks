"use client";

import { Button } from "@/modules/ui/components/button";
import { GithubIcon } from "@/modules/ui/components/icons";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@formbricks/lib/localStorage";

interface GithubButtonProps {
  inviteUrl?: string | null;
  lastUsed?: boolean;
}

export const GithubButton = ({ inviteUrl, lastUsed }: GithubButtonProps) => {
  const t = useTranslations();
  const handleLogin = async () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(FORMBRICKS_LOGGED_IN_WITH_LS, "Github");
    }
    await signIn("github", {
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
      {t("auth.continue_with_github")}
      <GithubIcon />
      {lastUsed && <span className="absolute right-3 text-xs opacity-50">{t("auth.last_used")}</span>}
    </Button>
  );
};
