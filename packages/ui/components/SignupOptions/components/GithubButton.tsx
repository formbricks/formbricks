"use client";

import { signIn } from "next-auth/react";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@formbricks/lib/localStorage";
import { Button } from "../../Button";
import { GithubIcon } from "../../icons";

export const GithubButton = ({
  text = "Continue with Github",
  inviteUrl,
  lastUsed,
}: {
  text?: string;
  inviteUrl?: string | null;
  lastUsed?: boolean;
}) => {
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
      size="base"
      type="button"
      EndIcon={GithubIcon}
      startIconClassName="ml-2"
      onClick={handleLogin}
      variant="secondary"
      className="relative w-full justify-center">
      {text}
      {lastUsed && <span className="absolute right-3 text-xs opacity-50">Last Used</span>}
    </Button>
  );
};
