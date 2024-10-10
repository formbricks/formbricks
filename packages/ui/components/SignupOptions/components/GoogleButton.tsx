"use client";

import { signIn } from "next-auth/react";
import { Button } from "../../Button";
import { GoogleIcon } from "../../icons";

export const GoogleButton = ({
  lastUsed,
  text = "Continue with Google",
  inviteUrl,
}: {
  lastUsed?: boolean;
  text?: string;
  inviteUrl?: string | null;
}) => {
  const handleLogin = async () => {
    await signIn("google", {
      redirect: true,
      callbackUrl: inviteUrl ? inviteUrl : "/", // redirect after login to /
    });
  };

  return (
    <Button
      type="button"
      EndIcon={GoogleIcon}
      startIconClassName="ml-3"
      onClick={handleLogin}
      variant="secondary"
      className="relative w-full justify-center">
      {text}
      {lastUsed && <span className="absolute right-3 text-xs opacity-50">Last Used</span>}
    </Button>
  );
};
