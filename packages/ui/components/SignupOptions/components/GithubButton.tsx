"use client";

import { signIn } from "next-auth/react";
import { Button } from "../../Button";
import { GithubIcon } from "../../icons";

export const GithubButton = ({
  lastUsed,
  text = "Continue with Github",
  inviteUrl,
}: {
  lastUsed?: boolean;
  text?: string;
  inviteUrl?: string | null;
}) => {
  const handleLogin = async () => {
    await signIn("github", {
      redirect: true,
      callbackUrl: inviteUrl ? inviteUrl : "/", // redirect after login to /
    });
  };

  return (
    <Button
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
